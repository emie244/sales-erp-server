import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Req,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { Permissions } from '../auth/permissions.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findByUser(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('isRead') isRead?: string,
  ) {
    const userId = req.user?.userId as string;
    return this.service.findByUser(userId, {
      page,
      pageSize,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
    });
  }

  @Get('unread-count')
  async countUnread(@Req() req: Request) {
    const userId = req.user?.userId as string;
    const count = await this.service.countUnread(userId);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.userId as string;
    return this.service.markAsRead(id, userId);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: Request) {
    const userId = req.user?.userId as string;
    return this.service.markAllAsRead(userId);
  }
}
