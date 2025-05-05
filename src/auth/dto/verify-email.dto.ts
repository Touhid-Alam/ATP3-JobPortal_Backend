import { IsString, IsNotEmpty, MinLength, IsEmail, Length } from 'class-validator';

export class VerifyEmailDto {
    // Added Email Field
    @IsEmail({}, { message: 'Please provide a valid email address.'})
    @IsNotEmpty({ message: 'Email should not be empty.' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'Verification code should not be empty.' })
    @Length(6, 6, { message: 'Verification code must be exactly 6 digits.'}) // Validate length for 6-digit code
    token: string; // This field now holds the 6-digit code

    @IsString()
    @IsNotEmpty({ message: 'Password should not be empty.' })
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    password: string;
}