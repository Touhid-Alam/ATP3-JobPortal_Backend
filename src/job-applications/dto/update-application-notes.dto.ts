import { IsString, IsOptional, MaxLength } from 'class-validator';

// <<< Add 'export' keyword here >>>
export class UpdateApplicationNotesDto {
  @IsString()
  @IsOptional() // Allow sending empty string or null to clear notes
  @MaxLength(2000, { message: 'Notes cannot exceed 2000 characters' }) // Set a reasonable max length
  notes?: string | null;
}