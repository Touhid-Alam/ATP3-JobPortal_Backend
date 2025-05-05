import { IsString, IsNotEmpty, IsEmail, IsEnum, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsEnum(['employee', 'employer'])
  role: 'employee' | 'employer';
}