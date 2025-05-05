import { PartialType } from '@nestjs/mapped-types';
import { CreateJobDto } from './create-job.dto';

// <<< Add export keyword >>>
export class UpdateJobDto extends PartialType(CreateJobDto) {}