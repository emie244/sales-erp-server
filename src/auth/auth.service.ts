import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as https from 'https';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

function request(options: https.RequestOptions, body?: string): Promise<any> {
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

@Injectable()
export class AuthService {
  constructor(
    private config: ConfigService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByName(username);
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
    const perms = this.ensureReportPermission(user.permissions || []);
    const payload = {
      sub: user.id,
      username: user.name,
      role: user.role,
      permissions: perms,
      tenantId: user.tenantId,
    };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        feishuOpenId: user.feishuOpenId,
        feishuUserId: user.feishuUserId,
        feishuUnionId: user.feishuUnionId,
        role: user.role,
        permissions: perms,
      },
    };
  }

  private ensureReportPermission(perms: string[]): string[] {
    if (perms.includes('*')) return perms;
    if (!perms.includes('report:view')) {
      return [...perms, 'report:view'];
    }
    return perms;
  }

  async feishuCallback(code: string) {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';
    const redirectUri = `${this.config.get<string>('NGROK_URL') || ''}/api/v1/auth/feishu/callback`;

    const tokenRes: any = await request(
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
    );

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

    const userInfo: any = await request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/authen/v1/user_info',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

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
    let feishuUserId = info.user_id || null;
    const feishuUnionId = info.union_id || null;

    if (!feishuUserId) {
      try {
        const tenantTokenRes: any = await request(
          {
            hostname: 'open.feishu.cn',
            path: '/open-apis/auth/v3/tenant_access_token/internal',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          JSON.stringify({ app_id: appId, app_secret: appSecret }),
        );
        const tenantToken = tenantTokenRes.tenant_access_token;
        if (tenantToken) {
          const contactRes: any = await request({
            hostname: 'open.feishu.cn',
            path: `/open-apis/contact/v3/users/${encodeURIComponent(openId)}?user_id_type=open_id`,
            method: 'GET',
            headers: {
              Authorization: `Bearer ${tenantToken}`,
            },
          });
          console.log(
            'Feishu contact/v3/users response:',
            JSON.stringify(contactRes),
          );
          if (contactRes.code === 0 && contactRes.data?.user?.user_id) {
            feishuUserId = contactRes.data.user.user_id;
          }
        }
      } catch (err) {
        console.error('Feishu contact/v3/users error:', err);
      }
    }

    let user = await this.usersService.findByFeishuOpenId(openId);
    if (!user) {
      user = await this.usersService.create({
        name,
        email,
        feishuOpenId: openId,
        feishuUserId,
        feishuUnionId,
        isActive: true,
      });
    } else {
      const updates: any = {};
      if (feishuUserId && !user.feishuUserId)
        updates.feishuUserId = feishuUserId;
      if (feishuUnionId && !user.feishuUnionId)
        updates.feishuUnionId = feishuUnionId;
      if (Object.keys(updates).length) {
        user = await this.usersService.update(user.id, updates);
      }
    }

    const perms = this.ensureReportPermission(user.permissions || []);
    const payload = {
      sub: user.id,
      username: user.name,
      role: user.role,
      permissions: perms,
      tenantId: user.tenantId,
    };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        feishuOpenId: user.feishuOpenId,
        feishuUserId: user.feishuUserId,
        feishuUnionId: user.feishuUnionId,
        role: user.role,
        permissions: perms,
      },
    };
  }
}
