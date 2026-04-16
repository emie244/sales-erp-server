import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as Lark from '@larksuiteoapi/node-sdk';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private larkClient: Lark.Client;

  constructor(
    private config: ConfigService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {
    this.larkClient = new Lark.Client({
      appId: this.config.get<string>('FEISHU_APP_ID') || '',
      appSecret: this.config.get<string>('FEISHU_APP_SECRET') || '',
    });
  }

  async login(username: string) {
    const user = await this.usersService.findByName(username);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    const payload = { sub: user.id, username: user.name };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        feishuOpenId: user.feishuOpenId,
      },
    };
  }

  async feishuCallback(code: string) {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';
    const redirectUri = `${this.config.get<string>('NGROK_URL') || ''}/api/v1/auth/feishu/callback`;

    const tokenRes: any = await this.larkClient.request({
      method: 'POST',
      url: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
      data: {
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: appSecret,
        code,
        redirect_uri: redirectUri,
      },
    });

    if (tokenRes.code !== 0) {
      throw new UnauthorizedException(
        `Feishu auth failed: ${tokenRes.msg || tokenRes.error_description}`,
      );
    }

    const accessToken = tokenRes.access_token;
    const userInfo: any = await this.larkClient.authen.v1.userInfo.get(
      {},
      Lark.withUserAccessToken(accessToken),
    );

    if (userInfo.code !== 0) {
      throw new UnauthorizedException(
        `Feishu user info failed: ${userInfo.msg}`,
      );
    }

    const openId = userInfo.data?.open_id;
    const name = userInfo.data?.name || '飞书用户';
    const email =
      userInfo.data?.email ||
      userInfo.data?.enterprise_email ||
      `${openId}@feishu.local`;

    let user = await this.usersService.findByFeishuOpenId(openId);
    if (!user) {
      user = await this.usersService.create({
        name,
        email,
        feishuOpenId: openId,
        isActive: true,
      });
    }

    const payload = { sub: user.id, username: user.name };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        feishuOpenId: user.feishuOpenId,
      },
    };
  }
}
