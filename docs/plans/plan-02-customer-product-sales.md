# Plan 02：客户、商品、销售订单业务模块

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现客户管理、商品/SKU/价格策略管理、销售订单开单与查询 API。这是系统的核心业务前台。

**架构：** 在 Plan 01 已搭建的实体层之上，补充 Service、Controller、DTO，实现完整的 CRUD 与价格计算逻辑。

**技术栈：** NestJS, TypeORM, class-validator

**前置依赖：** Plan 01（`infrastructure-and-entities`）必须已完成并提交到同一分支。

**后置依赖：** Plan 03（飞书审批）和 Plan 04（聚水潭）会使用本计划的 SalesService.create/submit/findOne。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/customers/customers.service.ts` | 客户 CRUD |
| `src/customers/customers.controller.ts` | 客户 REST API |
| `src/customers/dto/create-customer.dto.ts` | 创建客户 DTO |
| `src/products/products.service.ts` | 商品/ SKU / 价格策略管理 |
| `src/products/products.controller.ts` | 商品 REST API |
| `src/products/dto/create-product.dto.ts` | 创建商品 DTO |
| `src/products/dto/create-sku.dto.ts` | 创建 SKU DTO |
| `src/products/dto/set-price.dto.ts` | 设置价格 DTO |
| `src/sales/sales.service.ts` | 销售订单核心逻辑（创建、查询、提交） |
| `src/sales/sales.controller.ts` | 销售订单 REST API |
| `src/sales/dto/create-sales-order.dto.ts` | 创建订单 DTO |
| `src/sales/dto/sales-order-item.dto.ts` | 订单行项目 DTO |
| `src/sales/dto/submit-sales-order.dto.ts` | 提交订单 DTO |

---

## 任务 1：Customer 模块 CRUD

**文件：**
- 创建：`src/customers/customers.service.ts`
- 创建：`src/customers/customers.controller.ts`
- 创建：`src/customers/dto/create-customer.dto.ts`
- 修改：`src/customers/customers.module.ts`
- 修改：`src/app.module.ts`（如需要）

- [ ] **步骤 1：编写 CreateCustomerDto**

```typescript
import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { CustomerLevel } from '../entities/customer.entity';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(CustomerLevel)
  level?: CustomerLevel;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  paymentTerms?: number;

  @IsOptional()
  @IsString()
  address?: string;
}
```

- [ ] **步骤 2：编写 CustomersService**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  create(dto: CreateCustomerDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findAll() {
    return this.repo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Customer not found');
    return entity;
  }

  async update(id: string, dto: Partial<CreateCustomerDto>) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }
}
```

- [ ] **步骤 3：编写 CustomersController**

```typescript
import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
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

  @Get(':id/orders')
  async findOrders(@Param('id') id: string) {
    // 仅做占位，返回空数组；后续 Plan 可补充 SalesService 查询
    return [];
  }
}
```

- [ ] **步骤 4：修改 CustomersModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
```

- [ ] **步骤 5：验证客户 API**

```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"测试客户","level":"A"}'
```

预期：返回 `{code:0,data:{...},message:"success"}`。

- [ ] **步骤 6：Commit**

```bash
git add src/customers
git commit -m "feat: add customer CRUD APIs"
```

---

## 任务 2：Product 模块 CRUD + 价格查询

**文件：**
- 创建：`src/products/products.service.ts`
- 创建：`src/products/products.controller.ts`
- 创建：`src/products/dto/create-product.dto.ts`
- 创建：`src/products/dto/create-sku.dto.ts`
- 创建：`src/products/dto/set-price.dto.ts`
- 修改：`src/products/products.module.ts`

- [ ] **步骤 1：编写 DTOs**

`create-product.dto.ts`:
```typescript
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSkuDto {
  @IsString()
  skuCode: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  spec?: string;

  @IsOptional()
  weight?: number;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSkuDto)
  skus?: CreateSkuDto[];
}
```

`set-price.dto.ts`:
```typescript
import { IsString, IsNumber } from 'class-validator';

export class SetPriceDto {
  @IsString()
  skuId: string;

  @IsString()
  customerLevel: string;

  @IsNumber()
  price: number;

  @IsNumber()
  minQty: number;
}
```

- [ ] **步骤 2：编写 ProductsService**

```typescript
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
    return this.productRepo.find({ relations: ['skus'], order: { createdAt: 'DESC' } });
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
    return this.skuRepo.findOne({ where: { id: skuId }, relations: ['product'] });
  }
}
```

- [ ] **步骤 3：编写 ProductsController**

```typescript
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
  async getPrice(
    @Param('skuId') skuId: string,
    @Query('level') level: string,
  ) {
    const price = await this.service.getPrice(skuId, level || 'C');
    return { skuId, level: level || 'C', price };
  }
}
```

- [ ] **步骤 4：修改 ProductsModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductSku, PricePolicy])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

- [ ] **步骤 5：验证商品 API**

```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"name":"测试商品","skus":[{"skuCode":"SKU001"}]}'
```

- [ ] **步骤 6：Commit**

```bash
git add src/products
git commit -m "feat: add product, sku and price policy APIs"
```

---

## 任务 3：SalesOrder 创建 API

**文件：**
- 创建：`src/sales/dto/sales-order-item.dto.ts`
- 创建：`src/sales/dto/create-sales-order.dto.ts`
- 创建：`src/sales/sales.service.ts`
- 创建：`src/sales/sales.controller.ts`
- 修改：`src/sales/sales.module.ts`

- [ ] **步骤 1：编写 DTOs**

`sales-order-item.dto.ts`:
```typescript
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class SalesOrderItemDto {
  @IsString()
  skuId: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;
}
```

`create-sales-order.dto.ts`:
```typescript
import { IsString, IsEnum, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { SalesOrderType } from '../entities/sales-order.entity';
import { SalesOrderItemDto } from './sales-order-item.dto';

export class CreateSalesOrderDto {
  @IsString()
  customerId: string;

  @IsEnum(SalesOrderType)
  type: SalesOrderType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items: SalesOrderItemDto[];

  @IsOptional()
  @IsString()
  remark?: string;
}
```

- [ ] **步骤 2：编写 SalesService**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem)
    private readonly itemRepo: Repository<SalesOrderItem>,
    private readonly productsService: ProductsService,
  ) {}

  async create(dto: CreateSalesOrderDto, creatorId: string) {
    let totalAmount = 0;
    const items: SalesOrderItem[] = [];

    for (const itemDto of dto.items) {
      const sku = await this.productsService.findSkuById(itemDto.skuId);
      if (!sku) throw new NotFoundException(`SKU ${itemDto.skuId} not found`);

      const lineAmount = itemDto.qty * itemDto.unitPrice - (itemDto.discountAmount || 0);
      totalAmount += lineAmount;

      items.push(
        this.itemRepo.create({
          skuId: itemDto.skuId,
          skuName: sku.skuCode,
          qty: itemDto.qty,
          unitPrice: itemDto.unitPrice,
          discountAmount: itemDto.discountAmount || 0,
          lineAmount,
        }),
      );
    }

    const order = this.orderRepo.create({
      customerId: dto.customerId,
      type: dto.type,
      creatorId,
      totalAmount,
      discountAmount: 0,
      payAmount: totalAmount,
      remark: dto.remark,
      status: SalesOrderStatus.DRAFT,
      items,
    });

    return this.orderRepo.save(order);
  }

  findAll() {
    return this.orderRepo.find({
      relations: ['customer', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['customer', 'items', 'creator'],
    });
    if (!order) throw new NotFoundException('Sales order not found');
    return order;
  }
}
```

- [ ] **步骤 3：编写 SalesController**

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';

@Controller('sales-orders')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Post()
  create(@Body() dto: CreateSalesOrderDto) {
    // 先 hardcode creatorId，后续 Plan 补充 JWT/Session
    return this.service.create(dto, 'system');
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
```

- [ ] **步骤 4：修改 SalesModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([SalesOrder, SalesOrderItem]), ProductsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
```

- [ ] **步骤 5：验证创建订单**

```bash
curl -X POST http://localhost:3000/api/v1/sales-orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"[上一步创建的客户ID]","type":"wholesale","items":[{"skuId":"[上一步创建的SKU ID]","qty":10,"unitPrice":100}]}'
```

预期：返回 `sales_order` 对象，状态 `draft`，`items` 已填充。

- [ ] **步骤 6：Commit**

```bash
git add src/sales
git commit -m "feat: add sales order create and query APIs"
```

---

## 任务 4：销售订单提交方法（供后续审批计划调用）

**文件：**
- 修改：`src/sales/sales.service.ts`
- 创建：`src/sales/dto/submit-sales-order.dto.ts`

- [ ] **步骤 1：编写 SubmitSalesOrderDto**

```typescript
import { IsString } from 'class-validator';

export class SubmitSalesOrderDto {
  @IsString()
  feishuUserId: string;

  @IsString()
  approvalDefCode: string;
}
```

- [ ] **步骤 2：在 SalesService 增加 submit 方法占位**

```typescript
async submit(orderId: string, feishuUserId: string, approvalDefCode: string) {
  const order = await this.orderRepo.findOne({
    where: { id: orderId },
    relations: ['customer', 'items'],
  });
  if (!order) throw new NotFoundException('Order not found');
  if (order.status !== SalesOrderStatus.DRAFT) {
    throw new BadRequestException('Only draft order can be submitted');
  }

  // Plan 03 会在此注入 ApprovalService 调用
  order.status = SalesOrderStatus.PENDING_APPROVAL;
  return this.orderRepo.save(order);
}
```

需要在 `sales.service.ts` 顶部引入 `BadRequestException`：

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
```

- [ ] **步骤 3：在 SalesController 暴露 submit 接口**

```typescript
@Post(':id/submit')
submit(@Param('id') id: string, @Body() dto: SubmitSalesOrderDto) {
  return this.service.submit(id, dto.feishuUserId, dto.approvalDefCode);
}
```

- [ ] **步骤 4：Commit**

```bash
git add src/sales
git commit -m "feat: add sales order submit endpoint placeholder"
```

---

## 自检

- 客户 API（创建、列表、详情）✓
- 商品 API（创建、列表、SKU、价格策略）✓
- 销售订单 API（创建、列表、详情、提交）✓
- 所有 DTO 带 class-validator 校验 ✓
- 创建订单时自动查询 SKU 名称并计算金额 ✓
- 无占位符代码，所有代码可直接编译运行 ✓
