import {
    Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus, UnauthorizedException, Logger, Patch, InternalServerErrorException, Get, Query, Res, BadRequestException, // Import BadRequestException
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forget-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenDenyListService } from './token-deny-list.service';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';

// Define RequestWithUser interface
interface RequestWithUser extends Request {
  user: { userId: number; email: string; role: string; jti: string; };
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
      private readonly authService: AuthService,
      private readonly tokenDenyListService: TokenDenyListService,
      private readonly jwtService: JwtService,
  ) {}

  // --- Register Employee Endpoint ---
  @Post('register/employee')
  @HttpCode(HttpStatus.ACCEPTED) // Use ACCEPTED as action is initiated, not completed
  registerEmployee(@Body() registerDto: RegisterEmployeeDto) {
    return this.authService.registerEmployee(registerDto);
  }

  // --- Register Employer Endpoint ---
  @Post('register/employer')
  @HttpCode(HttpStatus.ACCEPTED) // Use ACCEPTED as action is initiated, not completed
  registerEmployer(@Body() registerDto: RegisterEmployerDto) {
    return this.authService.registerEmployer(registerDto);
  }

  // --- Verify Email POST Endpoint ---
  @Post('verify-email/complete')
  @HttpCode(HttpStatus.OK)
  async completeEmailVerification(@Body() verifyDto: VerifyEmailDto) {
      this.logger.log(`Received email verification completion request for email: ${verifyDto.email}`);
      // DTO validation pipe handles basic checks
      // Service handles token/code validation and activation
      return this.authService.verifyEmail(verifyDto);
  }

  // --- Login Endpoint ---
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // --- Forgot Password Endpoint ---
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK) // Send OK even if email doesn't exist for security
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  // --- Reset Password Endpoint ---
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // --- Logout Endpoint ---
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: RequestWithUser): Promise<{ message: string }> {
      this.logger.log(`Logout request received for user ID: ${req.user.userId}`);
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) { throw new UnauthorizedException('Missing or invalid authorization header.'); }
      const token = authHeader.split(' ')[1];
      try {
          const payload = this.jwtService.decode(token) as { jti?: string; exp?: number; sub?: number };
          if (!payload || !payload.jti || !payload.exp || payload.sub !== req.user.userId) { throw new UnauthorizedException('Invalid token payload during logout.'); }
          this.tokenDenyListService.denyToken(payload.jti, payload.exp);
          this.logger.log(`User ID ${req.user.userId} logged out successfully. Token JTI ${payload.jti} denied.`);
          return { message: 'Logout successful.' }; // <<< RETURN
      } catch (error) { throw new InternalServerErrorException('Logout failed.'); }
  }

  // --- Change Password Endpoint ---
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
      @Req() req: RequestWithUser,
      @Body() changePasswordDto: ChangePasswordDto
  ): Promise<{ message: string }> {
      const userId = req.user.userId;
      const currentTokenJti = req.user.jti;
      let currentTokenExp: number;
      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
              const decoded = this.jwtService.decode(token) as { exp?: number };
              if (!decoded?.exp) { throw new Error('Missing expiration in token'); }
              currentTokenExp = decoded.exp;
          } catch (e) { throw new InternalServerErrorException('Failed to process token details.'); }
      } else { throw new UnauthorizedException('Authorization header missing or invalid.'); }
      this.logger.log(`User ID ${userId} requesting password change.`);
      // Service method handles logic and exceptions, return its result
      return this.authService.changePassword( // <<< RETURN
          userId,
          changePasswordDto,
          currentTokenJti,
          currentTokenExp
      );
  }

} // End AuthController