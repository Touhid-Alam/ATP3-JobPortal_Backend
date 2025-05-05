import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApplicationStatus } from '../entities/job-application.entity';

// <<< Add 'export' keyword here >>>
export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  @IsNotEmpty()
  status: ApplicationStatus;
}