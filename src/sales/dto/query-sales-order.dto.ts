import { IsOptional, IsString, IsIn, IsUUID } from 'class-validator';
import { SalesOrderType } from '../entities/sales-order.entity';

export class QuerySalesOrderDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn([SalesOrderType.SALES, SalesOrderType.OVERSEAS])
  type?: SalesOrderType;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsUUID()
  salespersonId?: string;

  @IsOptional()
  @IsString()
  migrationSource?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  minAmount?: number;

  @IsOptional()
  maxAmount?: number;
}
