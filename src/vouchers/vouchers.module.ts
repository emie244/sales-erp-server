import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Voucher } from './entities/voucher.entity';
import { VoucherItem } from './entities/voucher-item.entity';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher, VoucherItem])],
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
