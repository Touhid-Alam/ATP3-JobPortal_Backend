import { Injectable, UnauthorizedException, Logger, NotFoundException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { TokenDenyListService } from './token-deny-list.service';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '../users/entities/user.entity';

// Define the expected shape of the JWT payload
interface JwtPayload {
  sub: number; // User ID
  email: string;
  role: string;
  jti: string;
  iat: number; // Issued At timestamp (seconds since epoch)
  exp?: number;
}

// Define the shape of the user object attached to the request
interface RequestUser {
    userId: number;
    email: string;
    role: string;
    jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private usersService: UsersService,
    private tokenDenyListService: TokenDenyListService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-strong-secret-key-here',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    this.logger.debug(`Validating JWT payload: ${JSON.stringify(payload)}`);

    // 1. Deny List Check
    if (!payload.jti || this.tokenDenyListService.isTokenDenied(payload.jti)) {
        this.logger.warn(`JWT validation failed: Token JTI ${payload.jti || 'missing'} is denied.`);
        throw new UnauthorizedException('Token has been invalidated.');
    }

    // 2. Basic Payload Structure Check
    if (!payload || typeof payload.sub !== 'number' || !payload.jti || !payload.iat) {
        this.logger.error('Invalid JWT payload structure (sub/jti/iat missing):', payload);
        throw new UnauthorizedException('Invalid token payload.');
    }

    // 3. Fetch User for Validation Checks
    try {
        const user = await this.usersService.findOneForAuth(payload.sub); // Use specific method

        // 4. Check User Existence and Status
        if (!user || user.status !== UserStatus.ACTIVE) {
            this.logger.warn(`User not found or not active during JWT validation for ID: ${payload.sub}`);
            throw new UnauthorizedException('User associated with token not found or inactive.');
        }

        // 5. Password Changed Check
        if (user.passwordChangedAt) {
            const tokenIssuedAtMs = payload.iat * 1000;
            if (tokenIssuedAtMs < user.passwordChangedAt.getTime()) {
                this.logger.warn(`JWT validation failed: Token for user ${user.id} issued before last password change.`);
                throw new UnauthorizedException('Password has changed since this token was issued. Please log in again.');
            }
        }

        // 6. Return user data for request object
        const requestUser: RequestUser = {
            userId: user.id,
            email: payload.email, // Get email from payload
            role: user.role,
            jti: payload.jti,
        };
        this.logger.debug(`JWT validation successful for user ID: ${user.id}, JTI: ${payload.jti}`);
        return requestUser;

    } catch (error) {
        if (error instanceof UnauthorizedException || error instanceof NotFoundException) { throw error; }
        this.logger.error(`Unexpected error during JWT validation for user ${payload?.sub}: ${error.message}`, error.stack);
        throw new UnauthorizedException('Token validation failed due to server error.');
    }
  }
}