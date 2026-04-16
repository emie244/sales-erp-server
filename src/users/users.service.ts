import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByName(name: string) {
    return this.repo.findOne({ where: { name } });
  }

  async findByFeishuOpenId(feishuOpenId: string) {
    return this.repo.findOne({ where: { feishuOpenId } });
  }

  findAll() {
    return this.repo.find();
  }

  async create(data: Partial<User>) {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async update(id: string, data: Partial<User>) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, data);
    return this.repo.save(user);
  }
}
