import { IsString, IsArray, IsNumber, IsOptional, Min, IsNotEmpty } from 'class-validator';

export class CreateEmployeeDto {
  // This 'name' field might be passed during initial creation (e.g., from registerDto),
  // but it's NOT a direct column on the Employee entity itself.
  // The EmployeeService.create method needs to handle this (e.g., it uses the User's name).
  // It's generally better practice for DTOs to map directly to entity fields
  // or represent the intended data structure for the operation.
  // We'll keep it optional here if the service logic expects it.
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional() // Bio can be optional initially
  @IsString()
  bio?: string;

  @IsOptional() // Skills can be optional initially
  @IsArray()
  @IsString({ each: true }) // Validates each element in the array is a string
  skills?: string[];

  @IsOptional() // Years of experience can be optional or default
  @IsNumber()
  @Min(0) // Years of experience cannot be negative
  yearsOfExperience?: number;

  // userId should NOT typically be part of the Create DTO body.
  // It's usually derived from the authenticated user or context.
  // Including it here could pose a security risk if not handled carefully.
  // @IsNumber()
  // @IsNotEmpty()
  // userId: number;
}