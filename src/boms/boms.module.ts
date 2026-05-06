import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { BomHeader } from './entities/bom-header.entity';
import { BomItem } from './entities/bom-item.entity';
import { BomsService } from './boms.service';
import { BomsController } from './boms.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BomHeader, BomItem]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
  ],
  controllers: [BomsController],
  providers: [BomsService],
  exports: [BomsService],
})
export class BomsModule {}
