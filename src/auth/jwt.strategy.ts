import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  permissions: string[];
  tenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_SECRET') || 'default-secret-change-me',
    });
  }

  async validate(payload: JwtPayload) {
    let permissions = payload.permissions || [];
    // 兼容旧数据：admin 角色若权限为空则赋予通配符
    if (payload.role === 'admin' && permissions.length === 0) {
      permissions = ['*'];
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      permissions,
      tenantId: payload.tenantId,
    };
  }
}
