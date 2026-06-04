import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
    relatedId?: string;
  }) {
    const notification = this.repo.create(data);
    return this.repo.save(notification);
  }

  async findByUser(userId: string, params: { page?: number; pageSize?: number; isRead?: boolean }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (params.isRead !== undefined) {
      qb.andWhere('n.isRead = :isRead', { isRead: params.isRead });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async countUnread(userId: string) {
    return this.repo.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    await this.repo.update(
      { id, userId },
      { isRead: true, readAt: new Date() },
    );
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await this.repo.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { success: true };
  }
}
