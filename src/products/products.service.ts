import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(ProductSku) private skuRepo: Repository<ProductSku>,
    @InjectRepository(PricePolicy) private priceRepo: Repository<PricePolicy>,
  ) {}

  async create(dto: CreateProductDto) {
    const product = this.productRepo.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
    });
    const saved = await this.productRepo.save(product);

    if (dto.skus?.length) {
      const skus = dto.skus.map((s) =>
        this.skuRepo.create({ ...s, productId: saved.id }),
      );
      await this.skuRepo.save(skus);
    }
    return this.findOne(saved.id);
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['skus'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  findAll() {
    return this.productRepo.find({
      relations: ['skus'],
      order: { createdAt: 'DESC' },
    });
  }

  async setPrice(dto: SetPriceDto) {
    const existing = await this.priceRepo.findOne({
      where: { skuId: dto.skuId, customerLevel: dto.customerLevel },
    });
    if (existing) {
      existing.price = dto.price;
      existing.minQty = dto.minQty;
      return this.priceRepo.save(existing);
    }
    return this.priceRepo.save(this.priceRepo.create(dto));
  }

  async getPrice(skuId: string, customerLevel: string) {
    const policy = await this.priceRepo.findOne({
      where: { skuId, customerLevel },
    });
    return policy ?? null;
  }

  async findSkuById(skuId: string) {
    return this.skuRepo.findOne({
      where: { id: skuId },
      relations: ['product'],
    });
  }
}
