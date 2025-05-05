import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // <<< Ensure imported
import { EmployeeModule } from '../employee/employee.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResetToken } from './entities/reset-token.entity';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/entities/user.entity'; // <<< Needed for InjectRepository
import { TokenDenyListService } from './token-deny-list.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    UsersModule, // <<< Ensure UsersModule is imported
    EmployeeModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-strong-secret-key-here',
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([ResetToken, User]), // <<< Ensure User is here
    MailerModule,
  ],
  controllers: [AuthController],
  providers: [
      AuthService,
      JwtStrategy,
      TokenDenyListService
  ],
  exports: [
      AuthService,
      JwtModule,
      TokenDenyListService
  ],
})
export class AuthModule {}