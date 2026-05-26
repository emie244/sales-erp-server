export interface FloorPriceInput {
  floorPrice: number | null;
  quotedPrice: number;
}

export interface FloorPriceResult {
  passed: boolean;
  mode: 'strict' | 'warning' | 'off';
  reason?: string;
  floorPrice?: number;
}

export interface FloorPriceConfig {
  mode: 'strict' | 'warning' | 'off';
}

export class FloorPricePolicy {
  constructor(private readonly config: FloorPriceConfig) {}

  check(input: FloorPriceInput): FloorPriceResult {
    const { mode } = this.config;

    if (mode === 'off') {
      return { passed: true, mode };
    }

    if (input.floorPrice == null) {
      return { passed: true, mode };
    }

    if (input.quotedPrice < input.floorPrice - 0.001) {
      const result: FloorPriceResult = {
        passed: mode === 'warning',
        mode,
        reason: `报价低于底价：报价 ¥${input.quotedPrice.toFixed(2)}，底价 ¥${input.floorPrice.toFixed(2)}`,
        floorPrice: input.floorPrice,
      };
      if (mode === 'strict') return result;
      return result;
    }

    return { passed: true, mode, floorPrice: input.floorPrice };
  }
}
