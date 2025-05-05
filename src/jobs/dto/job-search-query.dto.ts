import { IsString, IsOptional, IsArray } from 'class-validator';
import { Transform } from 'class-transformer'; // <<< Import from class-transformer

export class JobSearchQueryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  // <<< Use Transform decorator >>>
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0) // Trim and filter empty strings
      : Array.isArray(value) ? value.map(skill => String(skill).trim()).filter(skill => skill.length > 0) : undefined // Handle array input too
  )
  skills?: string[];

  // Add pagination later if needed (page, limit)
}