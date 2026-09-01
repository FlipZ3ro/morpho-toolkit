export type EvmChainConfig = {
  key: string; chainId: number; name: string; nativeSymbol: string;
  rpcEnv: string; explorer: string; priceSlug?: string; readRpcFallbacks?: string[];
  status: 'active' | 'testnet-only' | 'verify';
};

// RPC URLs stay in environment variables; never commit keys or private endpoints.
export const evmChains: EvmChainConfig[] = [
  { key: 'ethereum', chainId: 1, name: 'Ethereum', nativeSymbol: 'ETH', rpcEnv: 'ETHEREUM_RPC_URL', explorer: 'https://etherscan.io', priceSlug: 'ethereum', status: 'active' },
  { key: 'base', chainId: 8453, name: 'Base', nativeSymbol: 'ETH', rpcEnv: 'BASE_RPC_URL', explorer: 'https://basescan.org', priceSlug: 'base', readRpcFallbacks: ['https://mainnet.base.org'], status: 'active' },
  { key: 'arbitrum', chainId: 42161, name: 'Arbitrum One', nativeSymbol: 'ETH', rpcEnv: 'ARBITRUM_RPC_URL', explorer: 'https://arbiscan.io', priceSlug: 'arbitrum', readRpcFallbacks: ['https://arb1.arbitrum.io/rpc'], status: 'active' },
  { key: 'polygon', chainId: 137, name: 'Polygon', nativeSymbol: 'POL', rpcEnv: 'POLYGON_RPC_URL', explorer: 'https://polygonscan.com', priceSlug: 'polygon', status: 'active' },
  { key: 'optimism', chainId: 10, name: 'OP Mainnet', nativeSymbol: 'ETH', rpcEnv: 'OPTIMISM_RPC_URL', explorer: 'https://optimistic.etherscan.io', priceSlug: 'optimism', status: 'active' },
  { key: 'robinhood', chainId: 4663, name: 'Robinhood Chain', nativeSymbol: 'ETH', rpcEnv: 'ROBINHOOD_RPC_URL', explorer: 'https://robinhoodchain.blockscout.com', status: 'active' },
  { key: 'hyperevm', chainId: 999, name: 'HyperEVM', nativeSymbol: 'HYPE', rpcEnv: 'HYPEREVM_RPC_URL', explorer: 'https://hyperevmscan.io', priceSlug: 'hyperliquid', status: 'active' },
  { key: 'stable', chainId: 988, name: 'Stable', nativeSymbol: 'USDT0', rpcEnv: 'STABLE_RPC_URL', explorer: 'https://stablescan.xyz', status: 'active' },
  { key: 'monad', chainId: 143, name: 'Monad', nativeSymbol: 'MON', rpcEnv: 'MONAD_RPC_URL', explorer: 'https://monadscan.com', priceSlug: 'monad', status: 'active' },
  { key: 'tempo', chainId: 4217, name: 'Tempo', nativeSymbol: 'pathUSD', rpcEnv: 'TEMPO_RPC_URL', explorer: 'https://explore.tempo.xyz', status: 'active' },
  { key: 'katana', chainId: 747474, name: 'Katana', nativeSymbol: 'ETH', rpcEnv: 'KATANA_RPC_URL', explorer: 'https://katanascan.com', status: 'active' },
];
