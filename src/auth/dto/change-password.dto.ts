import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { Match } from '../../validation/match.validator'; // <<< Import custom decorator

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password should not be empty' })
  oldPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'New password should not be empty' })
  @MinLength(6, { message: 'New password must be at least 6 characters long' })
  // Add more complexity rules here if desired (e.g., @Matches regex)
  newPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Password confirmation should not be empty' })
  @MinLength(6, { message: 'Password confirmation must be at least 6 characters long' })
  @Match('newPassword', { message: 'Password confirmation must match new password' }) // <<< Use custom decorator
  confirmPassword: string;
}