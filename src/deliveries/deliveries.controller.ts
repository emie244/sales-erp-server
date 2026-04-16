import { Controller, Get, Param } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';

@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly service: DeliveriesService) {}

  @Get('order/:salesOrderId')
  findByOrder(@Param('salesOrderId') salesOrderId: string) {
    return this.service.findBySalesOrder(salesOrderId);
  }
}
