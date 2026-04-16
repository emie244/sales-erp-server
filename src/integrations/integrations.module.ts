import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationLog } from './entities/integration-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IntegrationLog])],
  exports: [TypeOrmModule],
})
export class IntegrationsModule {}
