import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmployeeModule } from './employee/employee.module';
import { User } from './users/entities/user.entity'; // <<< Ensure User is imported
import { ResetToken } from './auth/entities/reset-token.entity';
import { Employee } from './employee/entities/employee.entity';
import { Education } from './employee/entities/education.entity';
import { Job } from './jobs/entities/job.entity';
import { JobApplication } from './job-applications/entities/job-application.entity';
import { Project } from './employee/entities/project.entity';
// Removed Chat imports
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { JobsModule } from './jobs/jobs.module';
import { JobApplicationsModule } from './job-applications/job-applications.module';
import { AiModule } from './ai/ai.module';
import { MailerModule } from './mailer/mailer.module';
// Removed ChatModule import

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: 'src/.env' }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'admin123',
      database: process.env.DB_DATABASE || 'jobportal',
      entities: [
          User, // <<< Ensure User is listed with new field
          ResetToken, Employee, Education, Project, Job, JobApplication,
      ],
      synchronize: process.env.NODE_ENV !== 'production', // Will add passwordChangedAt column
    }),
    ServeStaticModule.forRoot({ rootPath: join(process.cwd(), 'uploads'), serveRoot: '/uploads' }),
    AuthModule, UsersModule, EmployeeModule, JobsModule, JobApplicationsModule, AiModule, MailerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) { /* ... */ }
}