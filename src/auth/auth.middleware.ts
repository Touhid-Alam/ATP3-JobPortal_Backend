import {
    Injectable,
    NestMiddleware,
    UnauthorizedException,
    Logger,
  } from '@nestjs/common';
  import { Request, Response, NextFunction } from 'express';
  import { JwtService } from '@nestjs/jwt';
  import { UsersService } from '../users/users.service';
  
  @Injectable()
  export class AuthMiddleware implements NestMiddleware {
    private readonly logger = new Logger(AuthMiddleware.name);
  
    constructor(
      private readonly jwtService: JwtService,
      private readonly usersService: UsersService,
    ) {}
  
    async use(req: Request, res: Response, next: NextFunction) {
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        this.logger.error('No authorization header found');
        throw new UnauthorizedException('Authorization header is missing');
      }
  
      const token = authHeader.split(' ')[1];
      if (!token) {
        this.logger.error('Malformed authorization header');
        throw new UnauthorizedException('Invalid authorization format');
      }
  
      try {
        const payload = this.jwtService.verify(token, {
          secret: 'your-strong-secret-key-here',
        });
        
        const user = await this.usersService.findOne(payload.sub);
        if (!user) {
          this.logger.warn(`User not found for ID: ${payload.sub}`);
          throw new UnauthorizedException('User not found');
        }
  
        req.user = user;
        next();
      } catch (error) {
        this.logger.error(`JWT verification failed: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }
    }
  }