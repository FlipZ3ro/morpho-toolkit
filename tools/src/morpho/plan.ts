export type DryRunRequest = {
  provider: 'morpho-blue';
  chain: string;
  asset: string;
  amount: bigint;
  callbackData?: string;
};

export type LoanPlan = DryRunRequest & {
  borrow: string;
  middle: string[];
  repay: string;
  feeModel: string;
  broadcasts: false;
};

/** Builds an auditable no-op plan. It never signs or broadcasts. */
export function buildDryRunPlan(request: DryRunRequest): LoanPlan {
  const common = {
    ...request,
    middle: request.callbackData ? [`callback(${request.callbackData})`] : [],
    broadcasts: false as const
  };
  return {
    ...common,
    borrow: 'IMorpho.flashLoan(token, assets, data)',
    repay: 'approve(morpho, assets); Morpho transferFrom(receiver, morpho, assets)',
    feeModel: 'zero-protocol-fee',
  };
}
