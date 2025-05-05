import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength } from 'class-validator';

// <<< ADD 'export' HERE >>>
export class RegisterEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  // Password is NOT included here, user sets it during verification
}