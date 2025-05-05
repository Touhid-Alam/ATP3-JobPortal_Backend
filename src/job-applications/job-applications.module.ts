import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobApplicationsService } from './job-applications.service';
import { JobApplicationsController } from './job-applications.controller';
import { JobApplication } from './entities/job-application.entity';
import { AuthModule } from '../auth/auth.module'; // Keep AuthModule for guards
import { JobsModule } from '../jobs/jobs.module'; // Keep JobsModule for JobsService
import { User } from '../users/entities/user.entity';
import { Job } from '../jobs/entities/job.entity';
import { MailerModule } from '../mailer/mailer.module'; // <<< Import MailerModule

@Module({
  imports: [
    TypeOrmModule.forFeature([JobApplication, User, Job]), // Keep needed entities
    AuthModule,
    JobsModule,
    MailerModule, // <<< Add MailerModule here
  ],
  controllers: [JobApplicationsController],
  providers: [JobApplicationsService],
  exports: [JobApplicationsService] // Keep export if needed elsewhere
})
export class JobApplicationsModule {}