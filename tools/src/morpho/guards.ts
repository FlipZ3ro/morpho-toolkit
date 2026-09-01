import type { EvmChainConfig } from '../config/chains.js';

export type ZeroFeeDeployment = {
  provider: 'morpho-blue';
  chain: EvmChainConfig['key'];
  address: `0x${string}`;
  verifiedAtBlock: bigint;
  feeVerified: boolean;
};

/** Hard guard for the requested invariant: repayment may not exceed principal. */
export function assertZeroFeeRepayment(principal: bigint, repayment: bigint): void {
  if (repayment !== principal) {
    throw new Error(`zero-fee invariant failed: principal=${principal} repayment=${repayment}`);
  }
}

export function assertDeploymentReady(deployment: ZeroFeeDeployment): void {
  if (!deployment.feeVerified) throw new Error(`fee not verified for ${deployment.provider} on ${deployment.chain}`);
  if (deployment.address === '0x0000000000000000000000000000000000000000') throw new Error('zero address deployment');
}
