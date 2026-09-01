import { loadToolEnv } from '../config/env.js';
import { buildDryRunPlan, type DryRunRequest } from '../morpho/plan.js';

loadToolEnv();

const request: DryRunRequest = {
  provider: 'morpho-blue',
  chain: process.env.LOAN_CHAIN ?? 'ethereum',
  asset: process.env.LOAN_ASSET ?? 'USDC',
  amount: BigInt(process.env.LOAN_AMOUNT ?? '1000000')
};

console.log(JSON.stringify(buildDryRunPlan(request), (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
