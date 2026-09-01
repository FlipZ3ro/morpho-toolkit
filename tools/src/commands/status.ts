import { evmChains } from '../config/chains.js';
import { loadToolEnv } from '../config/env.js';

loadToolEnv();

for (const chain of evmChains) {
  const configured = Boolean(process.env[chain.rpcEnv]);
  console.log(`${chain.key}: chainId=${chain.chainId} rpc=${configured ? 'configured' : 'missing'}`);
}

console.log('Scanner scaffold ready. No transactions are sent by this entrypoint.');
