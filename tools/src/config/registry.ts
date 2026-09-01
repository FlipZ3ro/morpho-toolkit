import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type Address = `0x${string}`;

export type DeploymentRecord = {
  chainId: number;
  rpcEnv: string;
  morpho?: Address | '';
  executor?: Address | '';
  status?: string;
  allowedAssets?: string[];
  allowlistTransactions?: Record<string, string>;
  [key: string]: unknown;
};

export type DeploymentRegistry = Record<string, DeploymentRecord | Record<string, unknown>>;
export type StablecoinRegistry = Record<string, Record<string, { address: Address; decimals: number }>>;

export const deploymentsPath = fileURLToPath(new URL('../../../evm/deployments.json', import.meta.url));
export const stablecoinsPath = fileURLToPath(new URL('../../../evm/stablecoins.json', import.meta.url));
export const artifactPath = fileURLToPath(
  new URL('../../../evm/out/FlashLoanExecutor.sol/FlashLoanExecutor.json', import.meta.url),
);

export async function loadDeployments(): Promise<DeploymentRegistry> {
  return JSON.parse(await readFile(deploymentsPath, 'utf8')) as DeploymentRegistry;
}

export async function loadStablecoins(): Promise<StablecoinRegistry> {
  return JSON.parse(await readFile(stablecoinsPath, 'utf8')) as StablecoinRegistry;
}

export function deploymentFor(registry: DeploymentRegistry, chainKey: string): DeploymentRecord | undefined {
  const value = registry[chainKey];
  if (!value || chainKey === '_meta' || typeof value.chainId !== 'number') return undefined;
  return value as DeploymentRecord;
}

export async function saveDeployments(registry: DeploymentRegistry): Promise<void> {
  await writeFile(deploymentsPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}
