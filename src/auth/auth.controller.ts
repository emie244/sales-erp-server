import { Controller, Post, Body, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from './public.decorator';
import { Permissions } from './permissions.decorator';
import { AuthService } from './auth.service';
import * as crypto from 'crypto';

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
  feishuLogin() {
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
      const avatarParam = result.user.avatar
        ? `&avatar=${encodeURIComponent(result.user.avatar)}`
        : '';
      const redirect = `${baseUrl}/login?token=${result.token}&name=${encodeURIComponent(
        result.user.name,
      )}&feishuUserId=${encodeURIComponent(bestId)}&feishuUserIdType=${encodeURIComponent(idType)}${avatarParam}`;
      return res.redirect(redirect);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '飞书登录失败';
      const redirect = `${baseUrl}/login?error=${encodeURIComponent(msg)}`;
      return res.redirect(redirect);
    }
  }

  // ---------- 聚水潭授权（商家自研系统） ----------

  private jushuitanSign(
    params: Record<string, string | number>,
    appSecret: string,
  ): string {
    const sorted = Object.keys(params)
      .filter((k) => k !== 'sign' && params[k] != null && params[k] !== '')
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join('');
    const raw = appSecret + sorted;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /** 获取当前 token 状态（仅管理员） */
  @Permissions('admin:settings')
  @Get('jushuitan/token')
  jushuitanToken() {
    return {
      accessToken: this.config.get<string>('JUSHUITAN_ACCESS_TOKEN') || '',
      refreshToken: this.config.get<string>('JUSHUITAN_REFRESH_TOKEN') || '',
    };
  }

  /** 获取初始 token（商家自研系统：仅管理员） */
  @Permissions('admin:settings')
  @Post('jushuitan/init-token')
  async jushuitanInitToken(@Body() body: { code?: string }) {
    const appKey = this.config.get<string>('JUSHUITAN_APP_KEY') || '';
    const appSecret = this.config.get<string>('JUSHUITAN_APP_SECRET') || '';
    const code =
      body?.code || Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = String(Math.floor(Date.now() / 1000));

    const params: Record<string, string | number> = {
      app_key: appKey,
      code,
      grant_type: 'authorization_code',
      timestamp,
      charset: 'utf-8',
    };
    params.sign = this.jushuitanSign(params, appSecret);

    const reqBody = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      reqBody.append(k, String(v));
    }

    try {
      const res = await fetch(
        'https://openapi.jushuitan.com/openWeb/auth/getInitToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: reqBody.toString(),
        },
      );
      const data = await res.json();

      if (data.code === 0 && data.data?.access_token) {
        return {
          code: 0,
          data: data.data,
          message: '获取成功',
        };
      }
      return {
        code: -1,
        data: data,
        message: data.msg || '获取失败',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请求失败';
      return { code: -1, message: msg };
    }
  }

  /** 刷新 token（仅管理员） */
  @Permissions('admin:settings')
  @Post('jushuitan/refresh')
  async jushuitanRefresh() {
    const appKey = this.config.get<string>('JUSHUITAN_APP_KEY') || '';
    const appSecret = this.config.get<string>('JUSHUITAN_APP_SECRET') || '';
    const refreshToken =
      this.config.get<string>('JUSHUITAN_REFRESH_TOKEN') || '';

    if (!refreshToken) {
      return {
        code: -1,
        message: '未配置 refresh_token，请先调用 init-token 获取',
      };
    }

    const timestamp = String(Math.floor(Date.now() / 1000));
    const params: Record<string, string | number> = {
      app_key: appKey,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      timestamp,
      charset: 'utf-8',
      scope: 'all',
    };
    params.sign = this.jushuitanSign(params, appSecret);

    const reqBody = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      reqBody.append(k, String(v));
    }

    try {
      const res = await fetch(
        'https://openapi.jushuitan.com/openWeb/auth/refreshToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: reqBody.toString(),
        },
      );
      const data = await res.json();

      if (data.code === 0 && data.data?.access_token) {
        return {
          code: 0,
          data: data.data,
          message: '刷新成功',
        };
      }
      return {
        code: -1,
        data: data,
        message: data.msg || '刷新失败',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请求失败';
      return { code: -1, message: msg };
    }
  }
}
