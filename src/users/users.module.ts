import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
// Removed: import { AuthModule } from '../auth/auth.module'; // <<< REMOVE THIS LINE
import { MailerModule } from '../mailer/mailer.module'; // <<< Keep MailerModule

@Module({
  imports: [
      TypeOrmModule.forFeature([User]),
      // Removed: AuthModule // <<< REMOVE AuthModule FROM IMPORTS ARRAY
      MailerModule, // Keep MailerModule as UsersService now depends on MailerService
    ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService], // Keep exporting UsersService
})
export class UsersModule {}