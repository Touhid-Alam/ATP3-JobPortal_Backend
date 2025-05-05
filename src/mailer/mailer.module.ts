import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule
import { MailerService } from './mailer.service';

@Module({
  imports: [ConfigModule], // Make ConfigService available for injection into MailerService
  providers: [MailerService],
  exports: [MailerService], // Export MailerService so other modules can use it
})
export class MailerModule {}