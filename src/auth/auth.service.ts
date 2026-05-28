import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as https from 'https';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

interface FeishuTokenRes {
  code: number;
  msg?: string;
  error_description?: string;
  data?: { access_token?: string };
  access_token?: string;
}

interface FeishuUserRes {
  code: number;
  msg?: string;
  data?: {
    open_id?: string;
    name?: string;
    email?: string;
    enterprise_email?: string;
    user_id?: string;
    union_id?: string;
    avatar_url?: string;
    avatar?: string;
  };
}

interface FeishuTenantTokenRes {
  tenant_access_token?: string;
}

interface FeishuContactRes {
  code: number;
  data?: { user?: { user_id?: string } };
}

function request(
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

const DEFAULT_USER_PERMISSIONS = [
  'order:view',
  'order:create',
  'order:edit',
  'order:submit',
  'order:push_jst',
  'order:collect',
  'customer:view',
  'customer:create',
  'customer:edit',
  'product:view',
  'product:create',
  'product:edit',
  'prepayment:view',
  'prepayment:create',
  'prepayment:edit',
  'approval:view',
  'approval:handle',
  'report:view',
  'stock:view',
  'bom:view',
  'supplier:view',
  'purchase_order:view',
  'purchase_request:view',
  'production_order:view',
  'material_category:view',
  'invoice:view',
  'invoice:create',
  'invoice:edit',
  'invoice:delete',
  'voucher:view',
  'voucher:create',
  'voucher:edit',
  'voucher:delete',
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private config: ConfigService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async login(username: string, password: string) {
    let user = await this.usersService.findByName(username);
    if (!user) {
      user = await this.usersService.findByEmail(username);
    }
    if (!user) {
      user = await this.usersService.findByPhone(username);
    }
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.password) {
      const isHashed = user.password.startsWith('$2');
      if (isHashed) {
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          throw new UnauthorizedException('用户名或密码错误');
        }
      } else {
        // 兼容旧明文密码：自动迁移为 bcrypt 哈希
        if (user.password !== password) {
          throw new UnauthorizedException('用户名或密码错误');
        }
        await this.usersService.update(user.id, {
          password: await bcrypt.hash(password, 10),
        });
      }
    }
    const perms = this.ensureDefaultPermissions(user.permissions || []);
    const payload = {
      sub: user.id,
      username: user.name,
      role: user.role,
      permissions: perms,
      tenantId: user.tenantId,
    };
    return {
      token: this.jwtService.sign(payload),
      isFirstLogin: user.isFirstLogin,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        feishuOpenId: user.feishuOpenId,
        feishuUserId: user.feishuUserId,
        feishuUnionId: user.feishuUnionId,
        avatar: user.avatar,
        role: user.role,
        permissions: perms,
      },
    };
  }

  private ensureDefaultPermissions(perms: string[]): string[] {
    if (perms.includes('*')) return perms;
    const merged = new Set([...DEFAULT_USER_PERMISSIONS, ...perms]);
    return Array.from(merged);
  }

  async feishuCallback(code: string) {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';
    const redirectUri = `${this.config.get<string>('NGROK_URL') || ''}/api/v1/auth/feishu/callback`;

    const tokenRes = (await request(
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
        redirect_uri: redirectUri,
      }),
    )) as FeishuTokenRes;

    if (tokenRes.code !== 0) {
      throw new UnauthorizedException(
        `Feishu auth failed: ${tokenRes.msg || tokenRes.error_description || JSON.stringify(tokenRes)}`,
      );
    }

    const accessToken = tokenRes.data?.access_token || tokenRes.access_token;
    if (!accessToken) {
      throw new UnauthorizedException(
        `Feishu auth failed: no access_token. Response: ${JSON.stringify(tokenRes)}`,
      );
    }

    const userInfo = (await request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/authen/v1/user_info',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })) as FeishuUserRes;

    if (userInfo.code !== 0) {
      throw new UnauthorizedException(
        `Feishu user info failed: ${userInfo.msg || JSON.stringify(userInfo)}`,
      );
    }

    const info = userInfo.data || {};
    const openId = info.open_id;
    if (!openId) {
      throw new UnauthorizedException('Feishu user info failed: no open_id');
    }

    const name = info.name || '飞书用户';
    const email =
      info.email || info.enterprise_email || `${openId}@feishu.local`;
    let feishuUserId = info.user_id || undefined;
    const feishuUnionId = info.union_id || undefined;
    const avatar = info.avatar_url || info.avatar || undefined;

    if (!feishuUserId) {
      try {
        const tenantTokenRes = (await request(
          {
            hostname: 'open.feishu.cn',
            path: '/open-apis/auth/v3/tenant_access_token/internal',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          JSON.stringify({ app_id: appId, app_secret: appSecret }),
        )) as FeishuTenantTokenRes;
        const tenantToken = tenantTokenRes.tenant_access_token;
        if (tenantToken) {
          const contactRes = (await request({
            hostname: 'open.feishu.cn',
            path: `/open-apis/contact/v3/users/${encodeURIComponent(openId)}?user_id_type=open_id`,
            method: 'GET',
            headers: {
              Authorization: `Bearer ${tenantToken}`,
            },
          })) as FeishuContactRes;
          this.logger.log(
            `Feishu contact/v3/users response: ${JSON.stringify(contactRes)}`,
          );
          if (contactRes.code === 0 && contactRes.data?.user?.user_id) {
            feishuUserId = contactRes.data.user.user_id;
          }
        }
      } catch (err) {
        this.logger.error(
          `Feishu contact/v3/users error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    let user = await this.usersService.findByFeishuOpenId(openId);
    if (!user) {
      const defaultPassword = await bcrypt.hash('admin123', 10);
      user = await this.usersService.create({
        name,
        email,
        feishuOpenId: openId,
        feishuUserId,
        feishuUnionId,
        avatar,
        isActive: true,
        password: defaultPassword,
        isFirstLogin: true,
      });
    } else {
      const updates: Record<string, unknown> = {};
      if (feishuUserId && !user.feishuUserId)
        updates.feishuUserId = feishuUserId;
      if (feishuUnionId && !user.feishuUnionId)
        updates.feishuUnionId = feishuUnionId;
      if (avatar) updates.avatar = avatar;
      if (Object.keys(updates).length) {
        user = await this.usersService.update(user.id, updates);
      }
    }

    const perms = this.ensureDefaultPermissions(user.permissions || []);
    const payload = {
      sub: user.id,
      username: user.name,
      role: user.role,
      permissions: perms,
      tenantId: user.tenantId,
    };
    return {
      token: this.jwtService.sign(payload),
      isFirstLogin: user.isFirstLogin,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        feishuOpenId: user.feishuOpenId,
        feishuUserId: user.feishuUserId,
        feishuUnionId: user.feishuUnionId,
        avatar: user.avatar,
        role: user.role,
        permissions: perms,
      },
    };
  }
}
