import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { Job } from './entities/job.entity';
import { User } from '../users/entities/user.entity';
import { JobApplication } from '../job-applications/entities/job-application.entity';
import { Employee } from '../employee/entities/employee.entity'; // <<< Ensure Employee is imported
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
        Job,
        User,
        JobApplication, // Needed for excluding applied jobs
        Employee // Needed for getting employee skills
    ]),
    AuthModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}