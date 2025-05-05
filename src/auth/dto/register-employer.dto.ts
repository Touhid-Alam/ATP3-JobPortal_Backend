import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength, IsUrl } from 'class-validator';

export class RegisterEmployerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string; // Contact person name

  @IsEmail()
  @IsNotEmpty()
  email: string; // Contact person email

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string; // Employer sets password initially, but account is inactive

  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  @MaxLength(255)
  companyName: string;

  @IsUrl({}, { message: 'Please provide a valid company website URL (e.g., https://company.com)'})
  @IsNotEmpty({ message: 'Company website is required' })
  @MaxLength(500)
  companyWebsite: string;
}