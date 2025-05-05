import { IsString, IsNotEmpty, IsOptional, IsArray, IsUrl, MaxLength, IsDateString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologiesUsed?: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string; // Can be null/absent if ongoing

  @IsOptional()
  @IsUrl({}, { message: 'Project URL must be a valid URL.' })
  @MaxLength(500)
  projectUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Repository URL must be a valid URL.' })
  @MaxLength(500)
  repositoryUrl?: string;
}