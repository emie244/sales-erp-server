import { Injectable } from '@nestjs/common';
import { ProductLifecycleStage } from '../../products/entities/product.entity';

export interface CommissionContext {
  launchDate: Date | null;
  lifecycleStage: ProductLifecycleStage | null;
  orderDate: Date;
}

@Injectable()
export class CommissionPolicy {
  calculateRate(ctx: CommissionContext): number {
    const { launchDate, lifecycleStage, orderDate } = ctx;

    // 优先使用显式设置的生命周期阶段
    if (lifecycleStage === 'new') return 0.03;
    if (lifecycleStage === 'growth') return 0.02;
    if (
      lifecycleStage === 'mature' ||
      lifecycleStage === 'decline' ||
      lifecycleStage === 'discontinued'
    )
      return 0.01;

    // 未设置阶段时，根据 launchDate 时间差推断
    if (!launchDate) return 0.01;

    const diffMs = orderDate.getTime() - new Date(launchDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 90) return 0.03;
    if (diffDays <= 180) return 0.02;
    return 0.01;
  }

  calculateAmount(lineAmount: number, rate: number): number {
    return lineAmount * rate;
  }
}
