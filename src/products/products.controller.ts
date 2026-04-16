import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('prices')
  setPrice(@Body() dto: SetPriceDto) {
    return this.service.setPrice(dto);
  }

  @Get('skus/:skuId/price')
  async getPrice(@Param('skuId') skuId: string, @Query('level') level: string) {
    const price = await this.service.getPrice(skuId, level || 'C');
    return { skuId, level: level || 'C', price };
  }
}
