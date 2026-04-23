import { Controller, Post, Body, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Public()
  @Get('feishu/login')
  async feishuLogin() {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const redirectUri = encodeURIComponent(
      `${this.config.get<string>('NGROK_URL') || ''}/api/v1/auth/feishu/callback`,
    );
    const scope = encodeURIComponent(
      'auth:user.id:read contact:user.id:readonly',
    );
    const url = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=erp`;
    return { url };
  }

  @Public()
  @Get('feishu/callback')
  async feishuCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const baseUrl = this.config.get<string>('NGROK_URL') || '';
    try {
      const result = await this.authService.feishuCallback(code);
      const bestId = result.user.feishuUserId || result.user.feishuOpenId || '';
      const idType = result.user.feishuUserId ? 'user_id' : 'open_id';
      const redirect = `${baseUrl}/login?token=${result.token}&name=${encodeURIComponent(
        result.user.name,
      )}&feishuUserId=${encodeURIComponent(bestId)}&feishuUserIdType=${encodeURIComponent(idType)}`;
      return res.redirect(redirect);
    } catch (e: any) {
      const redirect = `${baseUrl}/login?error=${encodeURIComponent(
        e.message || '飞书登录失败',
      )}`;
      return res.redirect(redirect);
    }
  }
}
