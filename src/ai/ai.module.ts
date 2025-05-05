import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule
import { AiFeedbackService } from './ai-feedback.service';

@Module({
  imports: [ConfigModule], // Make ConfigService available for injection
  providers: [AiFeedbackService],
  exports: [AiFeedbackService], // Export service for other modules to use
})
export class AiModule {}