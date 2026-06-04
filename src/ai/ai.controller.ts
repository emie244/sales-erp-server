import { Controller, Post, Get, Body, Param, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { AiService } from './ai.service';
import { ParseOrderRequestDto } from './dto/parse-order-request.dto';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('parse-order')
  @Permissions('order:create')
  async parseOrder(@Body() dto: ParseOrderRequestDto, @Req() req: Request) {
    if (!dto.text?.trim()) {
      throw new BadRequestException('请输入订单描述');
    }
    return this.aiService.parseOrder(dto.text, req.user?.tenantId);
  }

  @Post('chat')
  @Permissions()
  async chat(@Body() dto: ChatRequestDto, @Req() req: Request) {
    if (!dto.text?.trim()) {
      throw new BadRequestException('请输入内容');
    }
    return this.aiService.chat(dto.text, dto.history || [], req.user?.tenantId);
  }

  @Get('recommendations/:customerId')
  @Permissions('order:view')
  async getRecommendations(
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    return this.aiService.getRecommendations(customerId, req.user?.tenantId);
  }
}
