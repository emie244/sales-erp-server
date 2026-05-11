import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialCategory } from './entities/material-category.entity';
import { CreateMaterialCategoryDto } from './dto/create-material-category.dto';
import { UpdateMaterialCategoryDto } from './dto/update-material-category.dto';

@Injectable()
export class MaterialCategoriesService {
  constructor(
    @InjectRepository(MaterialCategory)
    private readonly repo: Repository<MaterialCategory>,
  ) {}

  async create(dto: CreateMaterialCategoryDto) {
    const level = dto.parentId
      ? await this.calcLevel(dto.parentId)
      : dto.level || 1;
    const category = this.repo.create({
      ...dto,
      level,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(category);
  }

  async findAll() {
    const all = await this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    return this.buildTree(all);
  }

  async findOne(id: string) {
    const category = await this.repo.findOneBy({ id });
    if (!category) throw new NotFoundException('分类不存在');
    return category;
  }

  async update(id: string, dto: UpdateMaterialCategoryDto) {
    const category = await this.findOne(id);
    if (dto.parentId !== undefined) {
      const level = dto.parentId
        ? await this.calcLevel(dto.parentId)
        : dto.level || 1;
      Object.assign(category, dto, { level });
    } else {
      Object.assign(category, dto);
    }
    return this.repo.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    const children = await this.repo.find({
      where: { parentId: id, isActive: true },
    });
    if (children.length > 0) {
      throw new BadRequestException('请先删除子分类');
    }
    category.isActive = false;
    return this.repo.save(category);
  }

  private async calcLevel(parentId: string) {
    const parent = await this.repo.findOneBy({ id: parentId });
    return parent ? parent.level + 1 : 1;
  }

  private buildTree(categories: MaterialCategory[]) {
    type TreeNode = MaterialCategory & { children: TreeNode[] };
    const map = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const c of categories) {
      map.set(c.id, { ...c, children: [] });
    }

    for (const c of categories) {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
