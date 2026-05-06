import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { Permissions } from '../auth/permissions.decorator';
import { CustomerAddressesService } from './customer-addresses.service';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';

@Controller('customer-addresses')
export class CustomerAddressesController {
  constructor(private readonly service: CustomerAddressesService) {}

  @Post()
  @Permissions('customer:edit')
  create(@Body() dto: CreateCustomerAddressDto) {
    return this.service.create(dto);
  }

  @Get('customer/:customerId')
  @Permissions('customer:view')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.service.findByCustomer(customerId);
  }

  @Put(':id')
  @Permissions('customer:edit')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCustomerAddressDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('customer:edit')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Put(':id/default')
  @Permissions('customer:edit')
  setDefault(@Param('id') id: string) {
    return this.service.setDefault(id);
  }
}
