import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  fallback,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Abi,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { evmChains, type EvmChainConfig } from './config/chains.js';
import { loadToolEnv } from './config/env.js';
import { scanMorphoBalances, type ScanResult, type ScannedAsset } from './morpho/scanner.js';
import { centerBlock, color, joinBlocks, promptText, renderBanner, renderTable, terminalLink, ui } from './ui/index.js';
import {
  artifactPath,
  deploymentFor,
  loadDeployments,
  loadStablecoins,
  saveDeployments,
  type Address,
  type DeploymentRecord,
  type DeploymentRegistry,
} from './config/registry.js';

loadToolEnv();

const executorAbi = parseAbi([
  'function owner() view returns (address)',
  'function morpho() view returns (address)',
  'function allowedToken(address) view returns (bool)',
  'function setTokenAllowed(address,bool)',
  'function flashLoan(address,uint256)',
]);

type ParsedArgs = {
  command: string;
  flags: Map<string, string[]>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv.length === 0 ? 'menu' : argv[0] && !argv[0].startsWith('-') ? argv[0] : 'help';
  const flags = new Map<string, string[]>();
  for (let index = command === 'help' && argv[0]?.startsWith('-') ? 0 : 1; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith('--')) throw new Error(`argumen tidak dikenal: ${value}`);
    const [rawName, inlineValue] = value.slice(2).split('=', 2);
    const next = argv[index + 1];
    const flagValue = inlineValue ?? (next && !next.startsWith('--') ? argv[++index] : 'true');
    flags.set(rawName, [...(flags.get(rawName) ?? []), flagValue]);
  }
  return { command, flags };
}

function withFlag(args: ParsedArgs, name: string, value: string): ParsedArgs {
  const flags = new Map(args.flags);
  flags.set(name, [value]);
  return { ...args, flags };
}

function flag(args: ParsedArgs, name: string): string | undefined {
  return args.flags.get(name)?.at(-1);
}

function hasFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.has(name) && flag(args, name) !== 'false';
}

function numberFlag(args: ParsedArgs, name: string, fallback: number): number {
  const raw = flag(args, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} harus angka >= 0`);
  return value;
}

function chainFromArgs(args: ParsedArgs): EvmChainConfig {
  const key = flag(args, 'chain');
  if (!key) throw new Error('--chain wajib diisi');
  const chain = evmChains.find((item) => item.key === key || String(item.chainId) === key);
  if (!chain) throw new Error(`chain tidak dikenal: ${key}`);
  return chain;
}

function addressList(values: string[] | undefined): Address[] {
  return (values ?? [])
    .flatMap((value) => value.split(','))
    .filter(Boolean)
    .map((value) => getAddress(value) as Address);
}

function morphoAddress(record: DeploymentRecord | undefined, chain: EvmChainConfig): Address {
  if (!record?.morpho) throw new Error(`alamat Morpho belum ada untuk ${chain.key} di ../evm/deployments.json`);
  return getAddress(record.morpho) as Address;
}

function rpcUrl(chain: EvmChainConfig): string {
  const rpc = process.env[chain.rpcEnv];
  if (!rpc) throw new Error(`${chain.rpcEnv} belum diisi di tools/.env`);
  return rpc;
}

async function runScan(args: ParsedArgs): Promise<{ result: ScanResult; registry: DeploymentRegistry; record: DeploymentRecord }> {
  const chain = chainFromArgs(args);
  const registry = await loadDeployments();
  const record = deploymentFor(registry, chain.key);
  if (!record) throw new Error(`deployment registry belum punya chain ${chain.key}`);
  const compact = hasFlag(args, 'compact-ui');
  const progress = hasFlag(args, 'json')
    ? undefined
    : (message: string): void => {
      const line = `${color.cyan('◌')} ${color.dim(message)}`;
      console.log(compact ? centerBlock(line) : line);
    };
  const result = await scanMorphoBalances({
    chain,
    morpho: morphoAddress(record, chain),
    rpcUrl: rpcUrl(chain),
    stablecoins: await loadStablecoins(),
    minimumUsd: numberFlag(args, 'min-usd', 100_000),
    maxPriceAgeHours: numberFlag(args, 'max-price-age-hours', 24),
    manualTokens: addressList(args.flags.get('token')),
    onProgress: progress,
  });
  return { result, registry, record };
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 1_000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(value);
}

function compactAssetTable(assets: ScannedAsset[]): string {
  const renderAssetBox = (items: ScannedAsset[], offset: number, symbolWidth: number): string => {
    const assetLabel = (symbol: string): string => symbol.length > symbolWidth
      ? `${symbol.slice(0, symbolWidth - 1)}…`
      : symbol;
    return renderTable(
      [
        { title: '#', align: 'right' }, { title: 'ASSET' },
        { title: 'AVAILABLE', align: 'right' }, { title: 'VALUE', align: 'right' },
      ],
      items.map((asset, index) => [
        color.magenta(String(offset + index + 1).padStart(2, '0')),
        color.yellow(assetLabel(asset.symbol)),
        color.white(compactNumber(Number(asset.formattedBalance))),
        color.green(`$${compactNumber(asset.usdValue ?? 0)}`),
      ]),
    );
  };

  if (assets.length <= 50) return renderAssetBox(assets, 0, 20);

  const pages: string[] = [];
  for (let offset = 0; offset < assets.length; offset += 100) {
    const left = assets.slice(offset, offset + 50);
    const right = assets.slice(offset + 50, offset + 100);
    const boxes = [renderAssetBox(left, offset, 12)];
    if (right.length) boxes.push(renderAssetBox(right, offset + 50, 12));
    pages.push(joinBlocks(boxes, 5));
  }
  return pages.join('\n\n');
}

function printScan(result: ScanResult, compact = false): void {
  const eligible = result.assets.filter((asset) => asset.eligible);
  if (compact) {
    console.log(`\n${centerBlock(color.bold(color.cyan(`${result.chain.name.toUpperCase()} / LIQUIDITY`)))}`);
    console.log(centerBlock(`${color.green(`${eligible.length} assets ready`)} ${color.dim('•')} minimum ${color.yellow(`$${compactNumber(result.minimumUsd)}`)} ${color.dim('•')} block ${result.blockNumber}`));
  } else {
    ui.section(`${result.chain.name} / LIQUIDITY`);
    console.log(`${color.dim('Morpho')} ${color.cyan(result.morpho)}  ${color.dim('Block')} ${color.white(result.blockNumber)}`);
    console.log(`${color.dim('Filter')} ${color.green(`>= $${result.minimumUsd.toLocaleString('en-US')}`)}  ${color.dim(`price age <= ${result.maxPriceAgeHours}h`)}`);
  }
  if (eligible.length) {
    console.log(compact ? centerBlock(compactAssetTable(eligible)) : renderTable(
      [
        { title: '#', align: 'right' }, { title: 'ASSET' }, { title: 'TOKEN' },
        { title: 'BALANCE', align: 'right' }, { title: 'PRICE', align: 'right' },
        { title: 'VALUE USD', align: 'right' }, { title: 'SOURCE' },
      ],
      eligible.map((asset, index) => [
        color.magenta(index + 1), color.yellow(asset.symbol), color.cyan(shortAddress(asset.address)),
        color.white(asset.formattedBalance), color.white(`$${asset.priceUsd?.toFixed(6)}`),
        color.green(`$${Math.floor(asset.usdValue ?? 0).toLocaleString('en-US')}`), color.dim(asset.priceSource),
      ]),
    ));
  } else {
    ui.warning('Tidak ada aset yang lolos threshold.');
  }
  const excluded = result.assets.filter((asset) => !asset.eligible);
  console.log(compact
    ? centerBlock(color.dim(`${excluded.length} assets hidden • below filter or missing fresh price`))
    : `${color.green(`Eligible ${eligible.length}/${result.assets.length}`)}  ${color.dim(`Excluded ${excluded.length}`)}`);
  if (excluded.length && !compact) {
    const reasons = excluded.reduce<Record<string, number>>((counts, asset) => {
      const reason = asset.exclusionReason?.split(':', 1)[0] ?? 'unknown';
      counts[reason] = (counts[reason] ?? 0) + 1;
      return counts;
    }, {});
    console.log(`${color.dim('Breakdown')} ${Object.entries(reasons).map(([reason, count]) => `${reason}=${count}`).join('  ')}`);
  }
  for (const warning of result.warnings) ui.warning(warning);
}

function selectAssets(assets: ScannedAsset[], raw: string): ScannedAsset[] {
  const eligible = assets.filter((asset) => asset.eligible);
  if (raw.trim().toLowerCase() === 'all') return eligible;
  const selectors = raw.split(',').map((value) => value.trim()).filter(Boolean);
  const selected = new Map<string, ScannedAsset>();
  for (const selector of selectors) {
    const index = Number(selector);
    const matches = Number.isInteger(index) && index >= 1
      ? [eligible[index - 1]].filter(Boolean)
      : eligible.filter((asset) =>
        asset.symbol.toLowerCase() === selector.toLowerCase()
        || asset.address.toLowerCase() === selector.toLowerCase());
    if (!matches.length) throw new Error(`pilihan aset tidak ditemukan/eligible: ${selector}`);
    for (const asset of matches) selected.set(asset.address.toLowerCase(), asset);
  }
  return [...selected.values()];
}

async function promptSelection(result: ScanResult, singleAsset = false): Promise<ScannedAsset[]> {
  if (!process.stdin.isTTY) throw new Error('mode non-interactive membutuhkan --select all atau --select 1,2');
  const readline = createInterface({ input, output });
  try {
    const label = singleAsset ? 'Pilih tepat 1 aset' : 'Pilih aset';
    const hint = singleAsset ? 'nomor atau simbol, contoh: 6 / WETH' : '1,3 / USDC,WETH / all';
    const answer = await readline.question(centerBlock(promptText(label, hint)));
    const selected = selectAssets(result.assets, answer);
    if (singleAsset && selected.length !== 1) {
      throw new Error('flashloan membutuhkan tepat satu aset; pilih satu nomor atau satu simbol');
    }
    return selected;
  } finally {
    readline.close();
  }
}

async function promptChain(requireExecutor = false): Promise<EvmChainConfig> {
  const deployments = await loadDeployments();
  const choices = evmChains.filter((chain) => {
    const record = deploymentFor(deployments, chain.key);
    return Boolean(process.env[chain.rpcEnv] && record?.morpho && (!requireExecutor || record.executor));
  });
  const chainRow = (chain: EvmChainConfig, index: number): string[] => {
    const record = deploymentFor(deployments, chain.key);
    return [
      color.magenta(String(index + 1).padStart(2, '0')),
      color.yellow(chain.name),
      record?.executor ? color.green('LIVE') : color.yellow('SETUP'),
    ];
  };
  console.log(`\n${centerBlock(color.bold(color.cyan('SELECT NETWORK')))}`);
  console.log(centerBlock(renderTable(
    [{ title: '#' }, { title: 'NETWORK' }, { title: 'STATUS' }],
    choices.map(chainRow),
  )));
  const readline = createInterface({ input, output });
  try {
    const answer = (await readline.question(centerBlock(promptText('Pilih nomor chain')))).trim();
    const numeric = Number(answer);
    const selected = Number.isInteger(numeric) && numeric >= 1
      ? choices[numeric - 1]
      : choices.find((chain) => chain.key.toLowerCase() === answer.toLowerCase());
    if (!selected) throw new Error(`pilihan chain tidak valid: ${answer}`);
    return selected;
  } finally {
    readline.close();
  }
}

async function askYesNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const readline = createInterface({ input, output });
  try {
    const answer = (await readline.question(centerBlock(promptText(question, '[y/N]')))).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    readline.close();
  }
}

async function confirmBroadcast(message: string, yes: boolean): Promise<void> {
  if (yes) return;
  if (!process.stdin.isTTY) throw new Error('--broadcast non-interactive membutuhkan --yes');
  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question(centerBlock(promptText(message, 'ketik YES')));
    if (answer !== 'YES') throw new Error('broadcast dibatalkan');
  } finally {
    readline.close();
  }
}

function privateKey(): Hex {
  const value = process.env.PRIVATE_KEY;
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('PRIVATE_KEY belum valid di tools/.env');
  return value as Hex;
}

function viemChain(chain: EvmChainConfig, rpc: string) {
  const readRpcUrls = [...(chain.readRpcFallbacks ?? []), rpc]
    .filter((url, index, urls) => urls.indexOf(url) === index);
  return defineChain({
    id: chain.chainId,
    name: chain.name,
    nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: readRpcUrls } },
    blockExplorers: { default: { name: chain.name, url: chain.explorer } },
  });
}

function readTransport(chain: EvmChainConfig, rpc: string) {
  // Prefer the chain-maintained public endpoint for reads/receipts. The RPC in
  // .env remains the broadcast endpoint and the final read fallback.
  const urls = [...(chain.readRpcFallbacks ?? []), rpc]
    .filter((url, index, values) => values.indexOf(url) === index);
  return urls.length === 1
    ? http(urls[0])
    : fallback(urls.map((url) => http(url)), { retryCount: 0 });
}

async function executorExists(chain: EvmChainConfig, rpc: string, executor: Address | undefined): Promise<boolean> {
  if (!executor) return false;
  const client = createPublicClient({ chain: viemChain(chain, rpc), transport: readTransport(chain, rpc) });
  const code = await client.getBytecode({ address: executor });
  return Boolean(code && code !== '0x');
}

async function saveAllowedAssets(
  registry: DeploymentRegistry,
  chainKey: string,
  record: DeploymentRecord,
  selected: ScannedAsset[],
  transactions: Record<string, string>,
): Promise<void> {
  const symbols = new Set([...(record.allowedAssets ?? []), ...selected.map((asset) => asset.symbol)]);
  record.allowedAssets = [...symbols];
  record.allowlistTransactions = { ...(record.allowlistTransactions ?? {}), ...transactions };
  registry[chainKey] = record;
  await saveDeployments(registry);
}

async function deployExecutor(
  chain: EvmChainConfig,
  rpc: string,
  morpho: Address,
  selected: ScannedAsset[],
): Promise<{ executor: Address; hash: Hash; block: bigint; gasUsed: bigint }> {
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8')) as {
    abi: Abi;
    bytecode: { object: Hex };
  };
  if (!artifact.bytecode.object || artifact.bytecode.object === '0x') throw new Error('artifact bytecode kosong; jalankan forge build');
  const chainConfig = viemChain(chain, rpc);
  const account = privateKeyToAccount(privateKey());
  const publicClient = createPublicClient({ chain: chainConfig, transport: readTransport(chain, rpc) });
  const walletClient = createWalletClient({ account, chain: chainConfig, transport: http(rpc) });
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [morpho, selected.map((asset) => asset.address)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`deployment gagal: ${hash}`);
  return {
    executor: getAddress(receipt.contractAddress) as Address,
    hash,
    block: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

async function syncAllowlist(
  chain: EvmChainConfig,
  rpc: string,
  morpho: Address,
  executor: Address,
  selected: ScannedAsset[],
): Promise<Record<string, string>> {
  const chainConfig = viemChain(chain, rpc);
  const account = privateKeyToAccount(privateKey());
  const publicClient = createPublicClient({ chain: chainConfig, transport: readTransport(chain, rpc) });
  const walletClient = createWalletClient({ account, chain: chainConfig, transport: http(rpc) });
  const [owner, configuredMorpho] = await Promise.all([
    publicClient.readContract({ address: executor, abi: executorAbi, functionName: 'owner' }),
    publicClient.readContract({ address: executor, abi: executorAbi, functionName: 'morpho' }),
  ]);
  if (owner.toLowerCase() !== account.address.toLowerCase()) throw new Error(`wallet bukan owner executor (${owner})`);
  if (configuredMorpho.toLowerCase() !== morpho.toLowerCase()) throw new Error('Morpho executor tidak cocok dengan registry');

  const transactions: Record<string, string> = {};
  for (const asset of selected) {
    const allowed = await publicClient.readContract({
      address: executor, abi: executorAbi, functionName: 'allowedToken', args: [asset.address],
    });
    if (allowed) continue;
    const hash = await walletClient.writeContract({
      address: executor, abi: executorAbi, functionName: 'setTokenAllowed', args: [asset.address, true],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`allowlist gagal ${asset.symbol}: ${hash}`);
    transactions[`${asset.symbol}:${asset.address}`] = hash;
    ui.success(`Allowlisted ${color.yellow(asset.symbol)}  ${color.cyan(`${chain.explorer}/tx/${hash}`)}`);
  }
  return transactions;
}

async function setup(args: ParsedArgs): Promise<void> {
  const { result, registry, record } = await runScan(args);
  printScan(result, hasFlag(args, 'compact-ui'));
  const eligible = result.assets.filter((asset) => asset.eligible);
  if (!eligible.length) throw new Error('setup berhenti: tidak ada aset eligible');
  const selected = flag(args, 'select') ? selectAssets(result.assets, flag(args, 'select')!) : await promptSelection(result);
  if (!selected.length) throw new Error('tidak ada aset dipilih');
  ui.info(`Dipilih: ${selected.map((asset) => `${color.yellow(asset.symbol)} ${color.dim(`(${asset.address})`)}`).join(', ')}`);

  const rpc = rpcUrl(result.chain);
  const registeredExecutor = record.executor ? getAddress(record.executor) as Address : undefined;
  const useExisting = !hasFlag(args, 'redeploy') && await executorExists(result.chain, rpc, registeredExecutor);
  const action = useExisting ? `sync allowlist executor ${registeredExecutor}` : 'deploy executor baru';
  const broadcast = hasFlag(args, 'broadcast')
    || (!hasFlag(args, 'plan') && await askYesNo(`Broadcast ${action}?`));
  if (!broadcast) {
    ui.plan(`${action}. Tambahkan --broadcast untuk transaksi on-chain.`);
    return;
  }
  await confirmBroadcast(`${action} di ${result.chain.name}.`, hasFlag(args, 'yes'));

  if (useExisting && registeredExecutor) {
    const transactions = await syncAllowlist(
      result.chain, rpc, result.morpho, registeredExecutor, selected,
    );
    await saveAllowedAssets(registry, result.chain.key, record, selected, transactions);
    ui.success(Object.keys(transactions).length ? 'Allowlist berhasil disinkronkan.' : 'Semua aset terpilih sudah di-allowlist.');
    return;
  }

  const deployed = await deployExecutor(result.chain, rpc, result.morpho, selected);
  record.executor = deployed.executor;
  record.deploymentTx = deployed.hash;
  record.deploymentBlock = Number(deployed.block);
  record.deploymentGasUsed = Number(deployed.gasUsed);
  record.status = 'deployed-awaiting-live-flashloan-test';
  record.allowedAssets = selected.map((asset) => asset.symbol);
  registry[result.chain.key] = record;
  await saveDeployments(registry);
  ui.success(`Executor: ${color.cyan(deployed.executor)}`);
  ui.success(`Deployment: ${color.cyan(`${result.chain.explorer}/tx/${deployed.hash}`)}`);
}

function parseRequestedAmount(raw: string, asset: ScannedAsset): { amount: bigint; usdTarget?: number } {
  const value = raw.trim().replaceAll(',', '');
  if (value.startsWith('$')) {
    const usdTarget = Number(value.slice(1));
    if (!Number.isFinite(usdTarget) || usdTarget <= 0) throw new Error('nominal USD tidak valid');
    if (!asset.priceUsd || asset.priceUsd <= 0) throw new Error(`harga ${asset.symbol} tidak tersedia`);
    const tokenAmount = usdTarget / asset.priceUsd;
    const precision = Math.min(asset.decimals, 12);
    const formatted = tokenAmount.toFixed(precision).replace(/\.?0+$/, '');
    return { amount: parseUnits(formatted, asset.decimals), usdTarget };
  }
  return { amount: parseUnits(value, asset.decimals) };
}

async function promptAmount(asset: ScannedAsset): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('mode non-interactive membutuhkan --amount');
  const readline = createInterface({ input, output });
  try {
    return await readline.question(centerBlock(promptText(`Masukkan nominal ${asset.symbol}`, '1000 atau $100000')));
  } finally {
    readline.close();
  }
}

async function runFlashLoan(args: ParsedArgs): Promise<void> {
  const { result, registry, record } = await runScan(args);
  printScan(result, hasFlag(args, 'compact-ui'));
  if (!record.executor) throw new Error(`executor ${result.chain.key} belum dideploy`);
  const executor = getAddress(record.executor) as Address;
  const selected = flag(args, 'asset')
    ? selectAssets(result.assets, flag(args, 'asset')!)
    : await promptSelection(result, true);
  if (selected.length !== 1) throw new Error('--asset harus berisi tepat satu nomor, simbol, atau address token');
  const asset = selected[0];
  const rawAmount = flag(args, 'amount') ?? await promptAmount(asset);
  const { amount, usdTarget } = parseRequestedAmount(rawAmount, asset);
  if (amount <= 0n) throw new Error('nominal harus lebih besar dari nol');
  if (amount > asset.balance) {
    throw new Error(`nominal melebihi saldo Morpho ${asset.formattedBalance} ${asset.symbol}`);
  }

  const rpc = rpcUrl(result.chain);
  const chainConfig = viemChain(result.chain, rpc);
  const publicClient = createPublicClient({ chain: chainConfig, transport: readTransport(result.chain, rpc) });
  const [owner, allowed] = await Promise.all([
    publicClient.readContract({ address: executor, abi: executorAbi, functionName: 'owner' }),
    publicClient.readContract({ address: executor, abi: executorAbi, functionName: 'allowedToken', args: [asset.address] }),
  ]);
  const formattedAmount = formatUnits(amount, asset.decimals);
  console.log(`\n${centerBlock(color.bold(color.cyan('FLASHLOAN PLAN')))}`);
  console.log(centerBlock(renderTable(
    [{ title: 'FIELD' }, { title: 'DETAIL' }],
    [
      [color.dim('NETWORK'), color.yellow(result.chain.name)],
      [color.dim('ASSET'), color.yellow(asset.symbol)],
      [color.dim('AMOUNT'), color.bold(color.green(`${formattedAmount} ${asset.symbol}`))],
      ...(usdTarget ? [[color.dim('USD TARGET'), color.green(`$${usdTarget.toLocaleString('en-US')}`)]] : []),
      [color.dim('EXECUTOR'), color.cyan(shortAddress(executor))],
      [color.dim('MODE'), color.green('ATOMIC / ZERO-FEE')],
    ],
  )));
  if (!allowed) {
    console.log(centerBlock(`${color.yellow('!')} ${color.yellow(asset.symbol)} belum aktif ${color.dim('• allowlist otomatis sebelum flashloan')}`));
  }

  if (allowed) {
    await publicClient.simulateContract({
      account: owner,
      address: executor,
      abi: executorAbi,
      functionName: 'flashLoan',
      args: [asset.address, amount],
    });
    console.log(centerBlock(`${color.green('✓')} Simulasi flashloan berhasil`));
  }

  const broadcast = hasFlag(args, 'broadcast')
    || (process.stdin.isTTY && !hasFlag(args, 'plan'));
  if (!broadcast) {
    console.log(centerBlock(`${color.magenta('[PLAN]')} Tidak ada transaksi dikirim`));
    return;
  }
  await confirmBroadcast(
    `Kirim flashloan ${formattedAmount} ${asset.symbol} di ${result.chain.name}.`,
    hasFlag(args, 'yes'),
  );
  const account = privateKeyToAccount(privateKey());
  if (account.address.toLowerCase() !== owner.toLowerCase()) throw new Error(`PRIVATE_KEY bukan owner executor (${owner})`);
  const walletClient = createWalletClient({ account, chain: chainConfig, transport: http(rpc) });

  let allowlistHash: Hash | undefined;
  if (!allowed) {
    const allowHash = await walletClient.writeContract({
      address: executor, abi: executorAbi, functionName: 'setTokenAllowed', args: [asset.address, true],
    });
    const allowReceipt = await publicClient.waitForTransactionReceipt({ hash: allowHash });
    if (allowReceipt.status !== 'success') throw new Error(`allowlist gagal: ${allowHash}`);
    await saveAllowedAssets(registry, result.chain.key, record, [asset], {
      [`${asset.symbol}:${asset.address}`]: allowHash,
    });
    allowlistHash = allowHash;
  }

  await publicClient.simulateContract({
    account: owner,
    address: executor,
    abi: executorAbi,
    functionName: 'flashLoan',
    args: [asset.address, amount],
  });
  const hash = await walletClient.writeContract({
    address: executor,
    abi: executorAbi,
    functionName: 'flashLoan',
    args: [asset.address, amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`flashloan gagal: ${hash}`);
  const liveTests = Array.isArray(record.liveTests) ? record.liveTests : [];
  record.liveTests = [...liveTests, {
    token: asset.symbol,
    amount: amount.toString(),
    formattedAmount: `${formattedAmount} ${asset.symbol}`,
    ...(usdTarget ? { usdTarget: String(usdTarget) } : {}),
    transaction: hash,
    block: Number(receipt.blockNumber),
    gasUsed: Number(receipt.gasUsed),
    status: 'success',
  }];
  registry[result.chain.key] = record;
  await saveDeployments(registry);
  console.log(`\n${centerBlock(color.bold(color.green('TRANSACTION CONFIRMED')))}`);
  if (allowlistHash) {
    const allowUrl = `${result.chain.explorer}/tx/${allowlistHash}`;
    console.log(centerBlock(`${color.green('✓')} ALLOWLIST  ${color.dim(shortHash(allowlistHash))}  ${terminalLink('OPEN ↗', allowUrl)}`));
  }
  const flashloanUrl = `${result.chain.explorer}/tx/${hash}`;
  console.log(centerBlock(`${color.green('✓')} FLASHLOAN  ${color.dim(shortHash(hash))}  ${terminalLink('OPEN ↗', flashloanUrl)}`));
}

async function interactiveMenu(args: ParsedArgs): Promise<void> {
  console.log(renderBanner());
  console.log(centerBlock(color.bold(color.cyan('MAIN MENU'))));
  console.log(centerBlock(renderTable(
    [{ title: '#' }, { title: 'ACTION' }, { title: 'DESCRIPTION' }],
    [
      [color.magenta('1'), color.white('LIQUIDITY SCAN'), color.dim('Find borrowable assets')],
      [color.magenta('2'), color.white('EXECUTOR SETUP'), color.dim('Deploy or sync allowlist')],
      [color.magenta('3'), color.green('RUN FLASHLOAN'), color.dim('Borrow and repay in one tx')],
      [color.dim('0'), color.dim('EXIT'), color.dim('Close toolkit')],
    ],
  )));
  console.log('');
  const readline = createInterface({ input, output });
  let answer: string;
  try {
    answer = (await readline.question(centerBlock(promptText('Pilih menu', '[0-3]')))).trim();
  } finally {
    readline.close();
  }
  if (answer === '0') return;
  if (!['1', '2', '3'].includes(answer)) throw new Error(`menu tidak valid: ${answer}`);
  const chain = await promptChain(answer === '3');
  const chainArgs = withFlag(withFlag(args, 'chain', chain.key), 'compact-ui', 'true');
  if (answer === '1') {
    const { result } = await runScan(chainArgs);
    printScan(result, true);
  } else if (answer === '2') {
    await setup(chainArgs);
  } else {
    await runFlashLoan(chainArgs);
  }
}

async function listChains(): Promise<void> {
  const deployments = await loadDeployments();
  console.log(renderBanner());
  console.log(renderTable(
    [
      { title: 'CHAIN' }, { title: 'ID', align: 'right' }, { title: 'RPC' },
      { title: 'MORPHO' }, { title: 'EXECUTOR' }, { title: 'STATUS' },
    ],
    evmChains.map((chain) => {
    const record = deploymentFor(deployments, chain.key);
      const rpcReady = Boolean(process.env[chain.rpcEnv]);
      const deployed = Boolean(record?.executor);
      return [
        color.yellow(chain.key), color.white(chain.chainId), rpcReady ? color.green('ready') : color.red('missing'),
        record?.morpho ? color.cyan(shortAddress(record.morpho)) : color.dim('unsupported'),
        deployed ? color.cyan(shortAddress(record!.executor!)) : color.dim('not deployed'),
        deployed ? color.green('ACTIVE') : color.yellow(record?.status ?? 'missing registry'),
      ];
    }),
  ));
}

async function scanAll(args: ParsedArgs): Promise<void> {
  const requested = flag(args, 'chains')?.split(',').map((value) => value.trim()).filter(Boolean);
  const selectedChains = requested?.length
    ? evmChains.filter((chain) => requested.includes(chain.key) || requested.includes(String(chain.chainId)))
    : evmChains;
  if (requested?.length && selectedChains.length !== requested.length) {
    throw new Error('satu atau lebih nilai --chains tidak dikenal/duplikat');
  }
  const deployments = await loadDeployments();
  const results: ScanResult[] = [];
  const failures: Array<{ chain: string; error: string }> = [];
  for (const chain of selectedChains) {
    const record = deploymentFor(deployments, chain.key);
    if (!record?.morpho || !process.env[chain.rpcEnv]) {
      failures.push({ chain: chain.key, error: !record?.morpho ? 'morpho-missing' : 'rpc-missing' });
      continue;
    }
    const chainFlags = new Map(args.flags);
    chainFlags.set('chain', [chain.key]);
    try {
      if (!hasFlag(args, 'json')) ui.info(`Scanning ${color.yellow(chain.name)}...`);
      const { result } = await runScan({ ...args, flags: chainFlags });
      results.push(result);
      if (!hasFlag(args, 'json')) printScan(result);
    } catch (error) {
      failures.push({ chain: chain.key, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (hasFlag(args, 'json')) {
    console.log(JSON.stringify({ results, failures }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } else if (failures.length) {
    ui.section('SKIPPED / FAILED');
    console.log(renderTable(
      [{ title: 'CHAIN' }, { title: 'REASON' }],
      failures.map((failure) => [color.yellow(failure.chain), color.red(failure.error)]),
    ));
  }
}

function printHelp(): void {
  console.log(renderBanner());
  console.log(`${color.bold('Usage:')}

Usage:
  npm run cli -- chains
  npm run cli -- scan  --chain ethereum [--min-usd 100000] [--token 0x...]
  npm run cli -- scan-all [--chains ethereum,base,arbitrum] [--min-usd 100000]
  npm run cli -- setup --chain ethereum [--min-usd 100000] [--select all|1,2|USDC,WETH]
  npm run cli -- flashloan --chain ethereum --asset WETH --amount 10 [--broadcast]
  npm run cli -- flashloan --chain ethereum --asset WETH --amount '$100000' [--broadcast]

State-changing flags:
  --broadcast   kirim deployment atau transaksi allowlist
  --yes         lewati prompt konfirmasi (untuk automation)
  --redeploy    deploy executor baru walaupun executor registry masih aktif

Output flags:
  --json
  --max-price-age-hours 24

Default setup adalah plan-only dan tidak mengirim transaksi.`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case 'chains':
      await listChains();
      break;
    case 'scan': {
      const { result } = await runScan(args);
      if (hasFlag(args, 'json')) {
        console.log(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
      } else {
        printScan(result);
      }
      break;
    }
    case 'scan-all':
      await scanAll(args);
      break;
    case 'setup':
      await setup(args);
      break;
    case 'flashloan':
      await runFlashLoan(args);
      break;
    case 'menu':
      await interactiveMenu(args);
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      throw new Error(`command tidak dikenal: ${args.command}`);
  }
}

main().catch((error: unknown) => {
  ui.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
