import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsNumber,
  Min,
  ValidateIf, // Keep ValidateIf if needed for other rules, but not for Min comparison
  MaxLength,
} from 'class-validator';
import { IsGreaterThanOrEqual } from '../../validation/is-greater-than-or-equal.validator'; // <<< Import custom validator

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  location: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  skillsRequired: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @IsOptional()
  @IsNumber()
  @Min(0) // Ensure min salary is non-negative
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0) // Ensure max salary is non-negative
  // <<< Use custom validator to compare with salaryMin >>>
  @IsGreaterThanOrEqual('salaryMin', {
      message: 'Maximum salary must not be less than minimum salary',
  })
  salaryMax?: number;

  // employerId is added in the service based on the authenticated user
}