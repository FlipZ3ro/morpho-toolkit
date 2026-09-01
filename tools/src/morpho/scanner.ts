import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type PublicClient,
} from 'viem';
import type { EvmChainConfig } from '../config/chains.js';
import type { Address, StablecoinRegistry } from '../config/registry.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MORPHO_API = 'https://api.morpho.org/graphql';
const PRICE_API = 'https://coins.llama.fi/prices/current/';
const PAGE_SIZE = 1_000;
const PRICE_SCALE = 100_000_000n;
const REQUEST_TIMEOUT_MS = 15_000;
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address;

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

type ApiPrice = { usd: number; timestamp: number } | null;
type ApiAsset = { address: Address; symbol: string; decimals: number; price: ApiPrice };
type MarketItem = { loanAsset: ApiAsset | null; collateralAsset: ApiAsset | null };
type ApiResponse = {
  data?: { markets?: { items?: MarketItem[] } };
  errors?: Array<{ message?: string }>;
};

type Candidate = {
  address: Address;
  symbol?: string;
  decimals?: number;
  priceUsd?: number;
  priceTimestamp?: number;
  priceSource?: 'morpho-api' | 'defillama';
  sources: Set<string>;
};

export type ScannedAsset = {
  address: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
  priceUsd: number | null;
  priceTimestamp: number | null;
  priceSource: 'morpho-api' | 'defillama' | null;
  usdValue: number | null;
  eligible: boolean;
  sources: string[];
  exclusionReason?: string;
};

export type ScanResult = {
  chain: EvmChainConfig;
  morpho: Address;
  blockNumber: bigint;
  minimumUsd: number;
  maxPriceAgeHours: number;
  assets: ScannedAsset[];
  warnings: string[];
};

export type ScanOptions = {
  chain: EvmChainConfig;
  morpho: Address;
  rpcUrl: string;
  stablecoins: StablecoinRegistry;
  minimumUsd?: number;
  maxPriceAgeHours?: number;
  manualTokens?: Address[];
  onProgress?: (message: string) => void;
};

const marketQuery = `
  query ScanMorphoAssets($chainId: Int!, $first: Int!, $skip: Int!) {
    markets(first: $first, skip: $skip, where: { chainId_in: [$chainId] }) {
      items {
        loanAsset { address symbol decimals price(maxLag: 24) { usd timestamp } }
        collateralAsset { address symbol decimals price(maxLag: 24) { usd timestamp } }
      }
    }
  }
`;

function candidateKey(address: string): string {
  return address.toLowerCase();
}

function addCandidate(map: Map<string, Candidate>, asset: Partial<ApiAsset> & { address: Address }, source: string): void {
  if (asset.address.toLowerCase() === ZERO_ADDRESS) return;
  const address = getAddress(asset.address) as Address;
  const key = candidateKey(address);
  const current = map.get(key) ?? { address, sources: new Set<string>() };
  current.sources.add(source);
  if (asset.symbol) current.symbol = asset.symbol;
  if (asset.decimals !== undefined) current.decimals = asset.decimals;
  if (asset.price && Number.isFinite(asset.price.usd) && asset.price.usd > 0) {
    if (!current.priceTimestamp || asset.price.timestamp >= current.priceTimestamp) {
      current.priceUsd = asset.price.usd;
      current.priceTimestamp = asset.price.timestamp;
      current.priceSource = 'morpho-api';
    }
  }
  map.set(key, current);
}

async function fetchMarketCandidates(chainId: number, candidates: Map<string, Candidate>): Promise<void> {
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const response = await fetch(MORPHO_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: marketQuery, variables: { chainId, first: PAGE_SIZE, skip } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Morpho API HTTP ${response.status}`);
    const body = await response.json() as ApiResponse;
    if (body.errors?.length) throw new Error(body.errors.map((error) => error.message ?? 'unknown error').join('; '));
    const items = body.data?.markets?.items ?? [];
    for (const item of items) {
      if (item.loanAsset) addCandidate(candidates, item.loanAsset, 'morpho-market-loan');
      if (item.collateralAsset) addCandidate(candidates, item.collateralAsset, 'morpho-market-collateral');
    }
    if (items.length < PAGE_SIZE) return;
  }
}

async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    output.push(...await Promise.all(items.slice(offset, offset + size).map(task)));
  }
  return output;
}

async function hydrateMetadata(client: PublicClient, candidates: Candidate[], warnings: string[]): Promise<Candidate[]> {
  return inBatches(candidates, 10, async (candidate) => {
    try {
      if (candidate.decimals === undefined) {
        candidate.decimals = Number(await client.readContract({
          address: candidate.address,
          abi: erc20Abi,
          functionName: 'decimals',
        }));
      }
      if (!candidate.symbol) {
        candidate.symbol = await client.readContract({
          address: candidate.address,
          abi: erc20Abi,
          functionName: 'symbol',
        });
      }
      return candidate;
    } catch (error) {
      warnings.push(`metadata gagal ${candidate.address}: ${errorMessage(error)}`);
      return candidate;
    }
  });
}

async function fetchFallbackPrices(
  chain: EvmChainConfig,
  candidates: Candidate[],
  warnings: string[],
): Promise<void> {
  if (!chain.priceSlug) return;
  const missing = candidates.filter((candidate) => candidate.priceUsd === undefined);
  const batches: Candidate[][] = [];
  for (let offset = 0; offset < missing.length; offset += 50) {
    batches.push(missing.slice(offset, offset + 50));
  }
  await Promise.all(batches.map(async (batch) => {
    const selectors = batch.map((candidate) => `${chain.priceSlug}:${candidate.address}`).join(',');
    try {
      const response = await fetch(`${PRICE_API}${selectors}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as {
        coins?: Record<string, { price?: number; timestamp?: number }>;
      };
      for (const candidate of batch) {
        const exact = `${chain.priceSlug}:${candidate.address}`;
        const lower = exact.toLowerCase();
        const entry = body.coins?.[exact]
          ?? Object.entries(body.coins ?? {}).find(([key]) => key.toLowerCase() === lower)?.[1];
        if (entry?.price && Number.isFinite(entry.price) && entry.price > 0) {
          candidate.priceUsd = entry.price;
          candidate.priceTimestamp = entry.timestamp;
          candidate.priceSource = 'defillama';
        }
      }
    } catch (error) {
      warnings.push(`fallback harga gagal: ${errorMessage(error)}`);
    }
  }));
}

async function readBalances(
  client: PublicClient,
  candidates: Candidate[],
  morpho: Address,
  blockNumber: bigint,
  warnings: string[],
): Promise<Map<string, bigint | Error>> {
  const balances = new Map<string, bigint | Error>();
  const applyResults = (
    targets: Candidate[],
    results: readonly {
      status: 'success' | 'failure';
      result?: unknown;
      error?: unknown;
    }[],
  ): void => {
    for (let index = 0; index < targets.length; index++) {
      const result = results[index];
      balances.set(
        candidateKey(targets[index].address),
        result.status === 'success' ? result.result as bigint : new Error(errorMessage(result.error)),
      );
    }
  };

  try {
    const results = await client.multicall({
      allowFailure: true,
      batchSize: 4_096,
      blockNumber,
      multicallAddress: MULTICALL3,
      contracts: candidates.map((candidate) => ({
        address: candidate.address,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [morpho] as const,
      })),
    });
    applyResults(candidates, results);

    const failed = candidates.filter((candidate) =>
      balances.get(candidateKey(candidate.address)) instanceof Error);
    if (failed.length > 0) {
      const retryResults = await client.multicall({
        allowFailure: true,
        batchSize: 512,
        blockNumber,
        multicallAddress: MULTICALL3,
        contracts: failed.map((candidate) => ({
          address: candidate.address,
          abi: erc20Abi,
          functionName: 'balanceOf' as const,
          args: [morpho] as const,
        })),
      });
      applyResults(failed, retryResults);
    }

    const successes = [...balances.values()].filter((result) => typeof result === 'bigint').length;
    if (successes === 0 && candidates.length > 0) {
      const firstFailure = [...balances.values()].find((result) => result instanceof Error);
      throw new Error(`semua ${candidates.length} panggilan gagal: ${errorMessage(firstFailure)}`);
    }
    return balances;
  } catch (error) {
    warnings.push(`Multicall3 gagal, fallback individual: ${errorMessage(error)}`);
  }

  const results = await inBatches(candidates, 10, async (candidate) => {
    try {
      const balance = await client.readContract({
        address: candidate.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [morpho],
        blockNumber,
      });
      return [candidateKey(candidate.address), balance] as const;
    } catch (error) {
      return [candidateKey(candidate.address), new Error(errorMessage(error))] as const;
    }
  });
  for (const [key, result] of results) balances.set(key, result);
  return balances;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split('\n', 1)[0];
  return firstLine.length > 300 ? `${firstLine.slice(0, 297)}...` : firstLine;
}

function hasFreshPrice(candidate: Candidate, now: number, maxPriceAgeHours: number): boolean {
  return candidate.priceUsd !== undefined
    && candidate.priceTimestamp !== undefined
    && now - candidate.priceTimestamp <= maxPriceAgeHours * 3600
    && candidate.priceTimestamp <= now + 300;
}

export function meetsUsdThreshold(balance: bigint, decimals: number, priceUsd: number, minimumUsd: number): boolean {
  if (balance < 0n || decimals < 0 || priceUsd <= 0 || minimumUsd < 0) return false;
  const scaledPrice = BigInt(Math.round(priceUsd * Number(PRICE_SCALE)));
  const scaledMinimum = BigInt(Math.ceil(minimumUsd)) * (10n ** BigInt(decimals)) * PRICE_SCALE;
  return balance * scaledPrice >= scaledMinimum;
}

export async function scanMorphoBalances(options: ScanOptions): Promise<ScanResult> {
  const minimumUsd = options.minimumUsd ?? 100_000;
  const maxPriceAgeHours = options.maxPriceAgeHours ?? 24;
  const warnings: string[] = [];
  const candidates = new Map<string, Candidate>();
  const client = createPublicClient({
    // Public RPCs commonly reject very large JSON-RPC batches. Multicall already
    // aggregates contract reads, so keep the outer RPC batch deliberately small.
    transport: http(options.rpcUrl, {
      batch: { batchSize: 5 },
      retryCount: 1,
      timeout: REQUEST_TIMEOUT_MS,
    }),
  });

  options.onProgress?.('Connecting to RPC and validating Morpho...');
  const actualChainId = await client.getChainId();
  if (actualChainId !== options.chain.chainId) {
    throw new Error(`RPC chainId ${actualChainId}, expected ${options.chain.chainId} (${options.chain.key})`);
  }
  const bytecode = await client.getBytecode({ address: options.morpho });
  if (!bytecode || bytecode === '0x') throw new Error(`Morpho tidak punya bytecode: ${options.morpho}`);

  options.onProgress?.('Discovering assets from Morpho markets...');
  try {
    await fetchMarketCandidates(options.chain.chainId, candidates);
  } catch (error) {
    warnings.push(`discovery API Morpho tidak tersedia: ${errorMessage(error)}`);
  }

  for (const [symbol, token] of Object.entries(options.stablecoins[options.chain.key] ?? {})) {
    addCandidate(candidates, { address: token.address, symbol, decimals: token.decimals }, 'local-stablecoin-registry');
  }
  for (const address of options.manualTokens ?? []) {
    addCandidate(candidates, { address }, 'manual-token');
  }
  if (candidates.size === 0) {
    throw new Error('tidak ada kandidat token; tambahkan --token 0x... atau isi stablecoins.json');
  }

  options.onProgress?.(`Validating metadata for ${candidates.size} assets...`);
  const hydrated = await hydrateMetadata(client, [...candidates.values()], warnings);
  const blockNumber = await client.getBlockNumber();
  const balanceCandidates = hydrated.filter((candidate) =>
    candidate.decimals !== undefined && candidate.symbol);

  options.onProgress?.(`Reading ${balanceCandidates.length} balances at block ${blockNumber}...`);
  const balances = await readBalances(client, balanceCandidates, options.morpho, blockNumber, warnings);
  const fundedCandidates = balanceCandidates.filter((candidate) => {
    const balance = balances.get(candidateKey(candidate.address));
    return typeof balance === 'bigint' && balance > 0n;
  });

  const missingPrices = fundedCandidates.filter((candidate) => candidate.priceUsd === undefined).length;
  if (missingPrices > 0) {
    options.onProgress?.(`Fetching fallback prices for ${missingPrices} funded assets...`);
    await fetchFallbackPrices(options.chain, fundedCandidates, warnings);
  }

  options.onProgress?.(`Finalizing ${fundedCandidates.length} funded assets...`);
  const now = Math.floor(Date.now() / 1000);

  const assets = hydrated.map((candidate): ScannedAsset => {
    if (candidate.decimals === undefined || !candidate.symbol) {
      return {
        address: candidate.address, symbol: candidate.symbol ?? '?', decimals: candidate.decimals ?? 0,
        balance: 0n, formattedBalance: '0', priceUsd: candidate.priceUsd ?? null,
        priceTimestamp: candidate.priceTimestamp ?? null, priceSource: candidate.priceSource ?? null,
        usdValue: null, eligible: false, sources: [...candidate.sources], exclusionReason: 'metadata-unavailable',
      };
    }
    const balanceResult = balances.get(candidateKey(candidate.address));
    if (balanceResult instanceof Error || balanceResult === undefined) {
      return {
        address: candidate.address, symbol: candidate.symbol, decimals: candidate.decimals,
        balance: 0n, formattedBalance: '0', priceUsd: candidate.priceUsd ?? null,
        priceTimestamp: candidate.priceTimestamp ?? null, priceSource: candidate.priceSource ?? null,
        usdValue: null, eligible: false, sources: [...candidate.sources],
        exclusionReason: `balance-read-failed: ${balanceResult?.message ?? 'missing result'}`,
      };
    }
    const balance = balanceResult;
    const priceFresh = hasFreshPrice(candidate, now, maxPriceAgeHours);
    if (!priceFresh) {
      return {
        address: candidate.address, symbol: candidate.symbol, decimals: candidate.decimals,
        balance, formattedBalance: formatUnits(balance, candidate.decimals), priceUsd: candidate.priceUsd ?? null,
        priceTimestamp: candidate.priceTimestamp ?? null, priceSource: candidate.priceSource ?? null,
        usdValue: null, eligible: false, sources: [...candidate.sources],
        exclusionReason: 'price-missing-or-stale',
      };
    }
    const numericBalance = Number(formatUnits(balance, candidate.decimals));
    const usdValue = numericBalance * candidate.priceUsd!;
    const eligible = meetsUsdThreshold(balance, candidate.decimals, candidate.priceUsd!, minimumUsd);
    return {
      address: candidate.address,
      symbol: candidate.symbol,
      decimals: candidate.decimals,
      balance,
      formattedBalance: formatUnits(balance, candidate.decimals),
      priceUsd: candidate.priceUsd ?? null,
      priceTimestamp: candidate.priceTimestamp ?? null,
      priceSource: candidate.priceSource ?? null,
      usdValue,
      eligible,
      sources: [...candidate.sources].sort(),
      exclusionReason: eligible ? undefined : 'below-minimum-usd',
    };
  });

  assets.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));
  return { chain: options.chain, morpho: options.morpho, blockNumber, minimumUsd, maxPriceAgeHours, assets, warnings };
}
