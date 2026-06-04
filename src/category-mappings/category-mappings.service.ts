import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryMapping } from './entities/category-mapping.entity';

@Injectable()
export class CategoryMappingsService {
  constructor(
    @InjectRepository(CategoryMapping)
    private readonly repo: Repository<CategoryMapping>,
  ) {}

  async create(data: { erpCategory: string; jstCategory: string; jstCategoryId?: string }) {
    const existing = await this.repo.findOne({
      where: { erpCategory: data.erpCategory },
    });
    if (existing) {
      existing.jstCategory = data.jstCategory;
      existing.jstCategoryId = data.jstCategoryId || null;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create(data));
  }

  async findAll() {
    return this.repo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async findByErpCategory(erpCategory: string) {
    return this.repo.findOne({
      where: { erpCategory, isActive: true },
    });
  }

  async update(id: string, data: Partial<CategoryMapping>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string) {
    await this.repo.update(id, { isActive: false });
    return { success: true };
  }
}
