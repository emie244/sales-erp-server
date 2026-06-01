import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Res,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from './public.decorator';
import { Permissions } from './permissions.decorator';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';
import * as https from 'https';

interface RedirectCacheEntry {
  url: string;
  expires: number;
}

function httpsRequest(
  options: https.RequestOptions,
  body?: string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

interface FeishuBindTokenRes {
  code: number;
  msg?: string;
  error_description?: string;
  data?: { access_token?: string };
  access_token?: string;
}

interface FeishuBindUserRes {
  code: number;
  msg?: string;
  data?: {
    open_id?: string;
    name?: string;
    user_id?: string;
    union_id?: string;
    avatar_url?: string;
    avatar?: string;
  };
}

@Controller('auth')
export class AuthController {
  private readonly redirectCache = new Map<string, RedirectCacheEntry>();

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private config: ConfigService,
  ) {}

  private setRedirectCache(key: string, entry: RedirectCacheEntry) {
    const now = Date.now();
    for (const [k, v] of this.redirectCache.entries()) {
      if (v.expires <= now) {
        this.redirectCache.delete(k);
      }
    }
    this.setRedirectCache(key, entry);
  }

  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Public()
  @Get('feishu/login')
  feishuLogin(@Query('redirect') redirect?: string) {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const redirectUri = encodeURIComponent(
      `${this.config.get<string>('NGROK_URL') || ''}/api/v1/auth/feishu/callback`,
    );
    const scope = encodeURIComponent(
      'auth:user.id:read contact:user.id:readonly',
    );
    // 飞书 state 有长度限制，用内存缓存 + 短 nonce 传递 redirect
    let state = 'erp';
    if (redirect) {
      state = crypto.randomBytes(4).toString('hex');
      this.setRedirectCache(state, { url: redirect, expires: Date.now() + 5 * 60 * 1000 });
    }
    const url = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    return { url };
  }

  @Public()
  @Get('feishu/callback')
  async feishuCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    // 绑定模式：state 以 bind_ 开头
    if (state && state.startsWith('bind_')) {
      const cached = this.redirectCache.get(state);
      this.redirectCache.delete(state);
      const baseUrl = this.config.get<string>('NGROK_URL') || '';
      if (!cached || cached.expires <= Date.now()) {
        return res.redirect(`${baseUrl}/profile?error=${encodeURIComponent('绑定超时，请重试')}`);
      }
      let bindInfo: { userId?: string; type?: string };
      try {
        bindInfo = JSON.parse(cached.url);
      } catch {
        return res.redirect(`${baseUrl}/profile?error=${encodeURIComponent('绑定信息无效')}`);
      }
      const userId = bindInfo.userId;
      if (!userId) {
        return res.redirect(`${baseUrl}/profile?error=${encodeURIComponent('未获取到用户信息')}`);
      }
      try {
        const feishuUser = await this.authService.getFeishuUserInfo(code);
        // 检查是否已被其他用户绑定
        const existing = await this.usersService.findByFeishuOpenId(feishuUser.openId);
        if (existing && existing.id !== userId) {
          return res.redirect(`${baseUrl}/profile?error=${encodeURIComponent('该飞书账号已被其他用户绑定')}`);
        }
        const updates: Record<string, unknown> = {
          feishuOpenId: feishuUser.openId,
        };
        if (feishuUser.feishuUserId) updates.feishuUserId = feishuUser.feishuUserId;
        if (feishuUser.feishuUnionId) updates.feishuUnionId = feishuUser.feishuUnionId;
        if (feishuUser.avatar) updates.avatar = feishuUser.avatar;
        await this.usersService.update(userId, updates);
        return res.redirect(`${baseUrl}/profile?bind=success`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '飞书绑定失败';
        return res.redirect(`${baseUrl}/profile?error=${encodeURIComponent(msg)}`);
      }
    }

    // 从内存缓存解析 redirect origin（state 为 8 位 nonce）
    let baseUrl = this.config.get<string>('NGROK_URL') || '';
    if (state && state !== 'erp' && state.length === 8) {
      const cached = this.redirectCache.get(state);
      if (cached && cached.expires > Date.now()) {
        baseUrl = cached.url;
      }
      this.redirectCache.delete(state);
    }
    try {
      const result = await this.authService.feishuCallback(code);
      const bestId = result.user.feishuUserId || result.user.feishuOpenId || '';
      const idType = result.user.feishuUserId ? 'user_id' : 'open_id';
      const avatarParam = result.user.avatar
        ? `&avatar=${encodeURIComponent(result.user.avatar)}`
        : '';
      const firstLoginParam = result.isFirstLogin ? '&firstLogin=1' : '';
      const redirect = `${baseUrl}/login?token=${result.token}&name=${encodeURIComponent(
        result.user.name,
      )}&feishuUserId=${encodeURIComponent(bestId)}&feishuUserIdType=${encodeURIComponent(idType)}${avatarParam}${firstLoginParam}`;
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

  // ---------- 飞书账号绑定 ----------

  /** 获取飞书绑定授权 URL（已登录用户自助绑定） */
  @Permissions()
  @Get('feishu/bind-url')
  feishuBindUrl(@Req() req: Request) {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const redirectUri = encodeURIComponent(
      `${this.config.get<string>('NGROK_URL') || ''}/api/v1/auth/feishu/callback`,
    );
    const scope = encodeURIComponent(
      'auth:user.id:read contact:user.id:readonly',
    );
    const userId = req.user?.userId;
    const nonce = crypto.randomBytes(4).toString('hex');
    const state = `bind_${nonce}`;
    // 将 userId 存入缓存，回调时识别为绑定模式
    this.setRedirectCache(state, {
      url: JSON.stringify({ userId, type: 'bind' }),
      expires: Date.now() + 5 * 60 * 1000,
    });
    const url = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    return { url };
  }

  /** 已登录用户绑定飞书账号（前端飞书回调后携带 code 调用此接口） */
  @Permissions()
  @Post('bind-feishu')
  async bindFeishu(
    @Req() req: Request,
    @Body() body: { code: string },
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('未登录');
    }
    const code = body.code;
    if (!code) {
      throw new BadRequestException('缺少 code 参数');
    }

    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';

    const tokenRes = (await httpsRequest(
      {
        hostname: 'open.feishu.cn',
        path: '/open-apis/authen/v2/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
      JSON.stringify({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: appSecret,
        code,
        redirect_uri: `${this.config.get<string>('NGROK_URL') || ''}/api/v1/auth/feishu/callback`,
      }),
    )) as FeishuBindTokenRes;

    if (tokenRes.code !== 0) {
      throw new BadRequestException(
        `飞书授权失败: ${tokenRes.msg || tokenRes.error_description || JSON.stringify(tokenRes)}`,
      );
    }

    const accessToken = tokenRes.data?.access_token || tokenRes.access_token;
    if (!accessToken) {
      throw new BadRequestException('飞书授权失败: 未获取到 access_token');
    }

    const userInfo = (await httpsRequest({
      hostname: 'open.feishu.cn',
      path: '/open-apis/authen/v1/user_info',
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    })) as FeishuBindUserRes;

    if (userInfo.code !== 0) {
      throw new BadRequestException(
        `获取飞书用户信息失败: ${userInfo.msg || JSON.stringify(userInfo)}`,
      );
    }

    const info = userInfo.data || {};
    const openId = info.open_id;
    if (!openId) {
      throw new BadRequestException('飞书用户信息中缺少 open_id');
    }

    // 检查是否已被其他用户绑定
    const existing = await this.usersService.findByFeishuOpenId(openId);
    if (existing && existing.id !== userId) {
      throw new BadRequestException('该飞书账号已被其他用户绑定');
    }

    // 更新当前用户的飞书信息
    const updates: Record<string, unknown> = {
      feishuOpenId: openId,
    };
    if (info.user_id) updates.feishuUserId = info.user_id;
    if (info.union_id) updates.feishuUnionId = info.union_id;
    if (info.avatar_url || info.avatar) {
      updates.avatar = info.avatar_url || info.avatar;
    }

    await this.usersService.update(userId, updates);

    return {
      code: 0,
      message: '绑定成功',
      data: {
        feishuOpenId: openId,
        feishuUserId: info.user_id,
        name: info.name,
      },
    };
  }

  /** 解绑飞书账号 */
  @Permissions()
  @Post('unbind-feishu')
  async unbindFeishu(@Req() req: Request) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('未登录');
    }
    await this.usersService.update(userId, {
      feishuOpenId: null as unknown as undefined,
      feishuUserId: null as unknown as undefined,
      feishuUnionId: null as unknown as undefined,
    });
    return { code: 0, message: '解绑成功' };
  }
}
