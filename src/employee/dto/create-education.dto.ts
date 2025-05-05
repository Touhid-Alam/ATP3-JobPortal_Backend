import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsDateString, // Use IsDateString for date inputs from client
    MaxLength,
  } from 'class-validator';
  
  export class CreateEducationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    institution: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    degree: string;
  
    @IsString()
    @IsOptional()
    @MaxLength(255)
    fieldOfStudy?: string;
  
    @IsDateString() // Validates ISO 8601 date string e.g., "2024-05-04"
    @IsNotEmpty()
    startDate: string; // Receive as string, convert to Date in service if needed
  
    @IsDateString()
    @IsOptional()
    endDate?: string; // Optional, receive as string
  
    @IsString()
    @IsOptional()
    description?: string;
  
    // employeeId is not part of the DTO, it's derived from the logged-in user/context
  }