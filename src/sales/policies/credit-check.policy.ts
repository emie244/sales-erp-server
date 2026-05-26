export interface CreditCheckInput {
  creditLimit: number;
  isCreditBlocked: boolean;
  usedCredit: number;
  orderAmount: number;
}

export interface CreditCheckResult {
  passed: boolean;
  mode: 'strict' | 'warning' | 'off';
  reason?: string;
  remainingCredit?: number;
  excessAmount?: number;
}

export interface CreditCheckConfig {
  mode: 'strict' | 'warning' | 'off';
}

export class CreditCheckPolicy {
  constructor(private readonly config: CreditCheckConfig) {}

  check(input: CreditCheckInput): CreditCheckResult {
    const { mode } = this.config;

    if (mode === 'off') {
      return { passed: true, mode };
    }

    if (input.isCreditBlocked) {
      const result: CreditCheckResult = {
        passed: mode === 'warning',
        mode,
        reason: '该客户已被信用冻结，禁止下单',
      };
      if (mode === 'strict') return result;
      return result;
    }

    const remainingCredit = input.creditLimit - input.usedCredit;
    const excessAmount = input.orderAmount - remainingCredit;

    if (excessAmount > 0.001) {
      const result: CreditCheckResult = {
        passed: mode === 'warning',
        mode,
        reason: `信用额度不足：剩余额度 ¥${remainingCredit.toFixed(2)}，本次订单金额 ¥${input.orderAmount.toFixed(2)}，超额 ¥${excessAmount.toFixed(2)}`,
        remainingCredit,
        excessAmount,
      };
      if (mode === 'strict') return result;
      return result;
    }

    return { passed: true, mode, remainingCredit };
  }
}
