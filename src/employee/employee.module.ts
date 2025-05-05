import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { Employee } from './entities/employee.entity';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt'; // Keep if needed by controller/service directly
import { Education } from './entities/education.entity';
import { Project } from './entities/project.entity';
import { AiModule } from '../ai/ai.module'; // <<< Import AiModule

@Module({
  imports: [
    TypeOrmModule.forFeature([
        Employee,
        User, // Needed if service interacts with User repo
        Education,
        Project
    ]),
    AiModule // <<< Import AiModule to make AiFeedbackService available
  ],
  controllers: [EmployeeController],
  providers: [EmployeeService, JwtService], // Provide JwtService if controller needs it
  exports: [EmployeeService], // Keep export if other modules need EmployeeService
})
export class EmployeeModule {}