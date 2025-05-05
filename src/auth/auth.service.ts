import {
    Injectable, ConflictException, NotFoundException, UnauthorizedException, InternalServerErrorException, BadRequestException, Logger,
  } from '@nestjs/common';
  import { UsersService } from '../users/users.service';
  import { EmployeeService } from '../employee/employee.service';
  import { JwtService } from '@nestjs/jwt';
  import { LoginDto } from './dto/login.dto';
  import { RegisterEmployeeDto } from './dto/register-employee.dto';
  import { RegisterEmployerDto } from './dto/register-employer.dto';
  import { VerifyEmailDto } from './dto/verify-email.dto';
  import { ForgotPasswordDto } from './dto/forget-password.dto';
  import { ResetPasswordDto } from './dto/reset-password.dto';
  import { ChangePasswordDto } from './dto/change-password.dto';
  import * as bcrypt from 'bcrypt';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { ResetToken } from './entities/reset-token.entity';
  import { User, UserStatus } from '../users/entities/user.entity';
  import { CreateEmployeeDto } from '../employee/dto/create-employee.dto';
  import { v4 as uuidv4 } from 'uuid';
  import { MailerService } from '../mailer/mailer.service';
  import { TokenDenyListService } from './token-deny-list.service';
  // Removed randomBytes import
  
  @Injectable()
  export class AuthService {
    private readonly logger = new Logger(AuthService.name);
  
    // Inject UserRepository directly to update timestamp
    @InjectRepository(User) private usersRepository: Repository<User>;
    @InjectRepository(ResetToken) private readonly resetTokenRepository: Repository<ResetToken>;
  
    constructor(
      private readonly usersService: UsersService,
      private readonly employeeService: EmployeeService,
      private readonly jwtService: JwtService,
      private readonly mailerService: MailerService,
      private readonly tokenDenyListService: TokenDenyListService,
    ) { this.logger.log('AuthService initialized.'); }
  
    // --- Helper to generate 6-digit code ---
    private generateVerificationCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
  
    // --- Register Employee Method ---
    async registerEmployee(registerDto: RegisterEmployeeDto): Promise<{ message: string }> {
        this.logger.log(`Attempting employee registration request for email: ${registerDto.email}`);
        const code = this.generateVerificationCode();
        const expires = new Date(); expires.setMinutes(expires.getMinutes() + 15);
        const userData: Partial<User> = { name: registerDto.name, email: registerDto.email, role: 'employee', password: null };
        const existingUser = await this.usersRepository.findOne({ where: { email: registerDto.email }});
        if (existingUser) {
             if (existingUser.status === UserStatus.PENDING_EMAIL_VERIFICATION) {
                 this.logger.log(`Resending verification code for existing pending user: ${registerDto.email}`);
                 existingUser.emailVerificationToken = code; existingUser.emailVerificationExpires = expires;
                 await this.usersRepository.save(existingUser);
             } else {
                   if (existingUser.status === UserStatus.PENDING_ADMIN_APPROVAL) { throw new ConflictException('This email is registered and pending administrator approval.'); }
                   if (existingUser.status === UserStatus.ACTIVE) { throw new ConflictException('An active account with this email already exists.'); }
                   throw new ConflictException('User with this email already exists.');
             }
        } else {
            try { await this.usersService.createPendingUser(userData, UserStatus.PENDING_EMAIL_VERIFICATION, code, expires); }
            catch (error) { if (error instanceof ConflictException || error instanceof BadRequestException) { throw error; } throw new InternalServerErrorException('Employee registration failed.'); }
        }
        await this.mailerService.sendMail({
            to: registerDto.email, subject: 'Your Job Portal Verification Code',
            text: `Hello ${registerDto.name},\n\nYour verification code is: ${code}\n\nPlease use this code on the verification page...\n\nThis code expires in 15 minutes...`,
            html: `<p>Hello ${registerDto.name},</p><p>Your verification code is: <strong>${code}</strong></p><p>Please use this code on the verification page...</p><p>This code expires in 15 minutes.</p>`,
        });
        this.logger.log(`Verification code email sent to employee: ${registerDto.email}`);
        return { message: 'Registration initiated. Please check your email for your verification code.' };
    }
  
    // --- Verify Email Method ---
    async verifyEmail(verifyDto: VerifyEmailDto): Promise<{ message: string }> {
        const code = verifyDto.token; const password = verifyDto.password; const email = verifyDto.email;
        this.logger.log(`Attempting email verification for email: ${email} with code: ${code}`);
        const user = await this.usersRepository.findOne({ where: { email: email, status: UserStatus.PENDING_EMAIL_VERIFICATION } });
        if (!user) { throw new BadRequestException('Invalid verification request. User not found or already verified.'); }
        if (!user.emailVerificationToken || !user.emailVerificationExpires) { throw new InternalServerErrorException('Verification data missing for user.'); }
        if (user.emailVerificationToken !== code) { throw new BadRequestException('Invalid verification code.'); }
        if (user.emailVerificationExpires < new Date()) { throw new BadRequestException('Verification code has expired. Please register again.'); }
        const hashedPassword = await bcrypt.hash(password, 10);
        try {
            await this.usersService.activateUser(user.id, hashedPassword);
             try {
                  this.logger.log(`Creating employee profile for newly verified user ID: ${user.id}`);
                  const employeeDto: CreateEmployeeDto = { bio: '', skills: [], yearsOfExperience: 0 };
                  await this.employeeService.create(user.id, employeeDto);
                  this.logger.log(`Employee profile created successfully for verified user ID: ${user.id}`);
             } catch (profileError) { this.logger.error(`Failed to create employee profile for verified user ${user.id}: ${profileError.message}`, profileError.stack); }
            this.logger.log(`Email verified and user ${user.id} activated successfully.`);
            return { message: 'Email verified successfully. You can now log in.' };
        } catch (error) { throw new InternalServerErrorException('Failed to complete email verification.'); }
    }
  
    // --- Register Employer Method ---
    async registerEmployer(registerDto: RegisterEmployerDto): Promise<{ message: string }> {
        this.logger.log(`Attempting employer registration request for email: ${registerDto.email}`);
        const userData: Partial<User> = { name: registerDto.name, email: registerDto.email, role: 'employer', password: registerDto.password, companyName: registerDto.companyName, companyWebsite: registerDto.companyWebsite };
        try {
            await this.usersService.createPendingUser(userData, UserStatus.PENDING_ADMIN_APPROVAL);
            this.logger.log(`Employer registration pending approval for: ${registerDto.email}`);
            return { message: 'Registration submitted successfully. Your account requires administrator approval before you can log in.' };
        } catch (error) { if (error instanceof ConflictException || error instanceof BadRequestException) { throw error; } throw new InternalServerErrorException('Employer registration failed.'); }
    }
  
    // --- Login Method ---
    async login(loginDto: LoginDto): Promise<{ access_token: string; userId: number; role: string; name: string }> {
      this.logger.log(`Login attempt for email: ${loginDto.email}`);
      const user = await this.usersService.findByEmail(loginDto.email);
      if (!user || !user.password) { throw new UnauthorizedException('Invalid email or password'); }
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
      if (!isPasswordValid) { throw new UnauthorizedException('Invalid email or password'); }
      if (user.status === UserStatus.PENDING_EMAIL_VERIFICATION) { throw new UnauthorizedException('Account not verified. Please check your email.'); }
      if (user.status === UserStatus.PENDING_ADMIN_APPROVAL) { throw new UnauthorizedException('Account pending administrator approval.'); }
       if (user.status === UserStatus.SUSPENDED) { throw new UnauthorizedException('Your account has been suspended.'); }
      if (user.status !== UserStatus.ACTIVE) { throw new UnauthorizedException('Account is not active.'); }
      const payload = { sub: user.id, email: user.email, role: user.role, jti: uuidv4() };
      const accessToken = this.jwtService.sign(payload);
      this.logger.log(`Login successful for user ID: ${user.id}. Status: ${user.status}. Token JTI: ${payload.jti}`);
      return { access_token: accessToken, userId: user.id, role: user.role, name: user.name };
    }
  
    // --- Forgot Password Method ---
    async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
      this.logger.log(`Forgot password request for email: ${forgotPasswordDto.email}`);
      const user = await this.usersService.findByEmail(forgotPasswordDto.email);
      if (!user) { return { message: 'If an account with this email exists, a password reset code has been sent.' }; }
      const code = await this.generatePasswordResetCode();
      const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 1);
      try { await this.resetTokenRepository.delete({ user: { id: user.id } }); } catch (dbError) { this.logger.error(`Non-critical error deleting old reset tokens: ${dbError.message}`); }
      const resetToken = this.resetTokenRepository.create({ token: code, user: user, expiresAt });
      try { await this.resetTokenRepository.save(resetToken); } catch (dbError) { throw new InternalServerErrorException('Could not save password reset token.'); }
      const mailOptions = { to: user.email, subject: 'Your Password Reset Code', text: `Hello ${user.name}... Code: ${code}...`, html: `<p>Hello ${user.name}, code: <strong>${code}</strong>...</p>` };
      try { await this.mailerService.sendMail(mailOptions); return { message: 'Password reset code sent successfully.' }; }
      catch (error) { throw new InternalServerErrorException('Failed to send password reset email.'); }
    }
  
    // --- Reset Password Method (Updates passwordChangedAt) ---
    async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
      this.logger.log(`Attempting password reset with token: ${resetPasswordDto.token}`);
      const resetToken = await this.resetTokenRepository.findOne({ where: { token: resetPasswordDto.token }, relations: ['user'] });
      if (!resetToken) { throw new BadRequestException('Invalid or expired reset token.'); }
      if (resetToken.expiresAt < new Date()) { await this.resetTokenRepository.delete(resetToken.id); throw new BadRequestException('Reset token has expired.'); }
      if (!resetToken.user) { await this.resetTokenRepository.delete(resetToken.id); throw new InternalServerErrorException('Invalid reset token state.'); }
  
      const userId = resetToken.user.id;
      const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 10);
  
      try {
          // Update password
          await this.usersService.updatePassword(userId, hashedPassword);
          // Update timestamp
          await this.usersRepository.update(userId, { passwordChangedAt: new Date() });
          this.logger.log(`Updated passwordChangedAt timestamp for user ID: ${userId} after reset.`);
      } catch (error) {
          this.logger.error(`Error during password reset DB update for user ${userId}: ${error.message}`, error.stack);
          if (error instanceof NotFoundException) { throw error; }
          throw new InternalServerErrorException('Failed to update password information.');
      }
      await this.resetTokenRepository.delete(resetToken.id);
      this.logger.log(`Password successfully reset and token deleted for user ID: ${userId}`);
      return { message: 'Password has been reset successfully.' };
    }
  
    // --- Generate Password Reset Code Method ---
    private async generatePasswordResetCode(): Promise<string> {
      let code: string; let attempts = 0; const maxAttempts = 10;
      do {
        if (attempts >= maxAttempts) { throw new InternalServerErrorException("Could not generate password reset code."); }
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const existingToken = await this.resetTokenRepository.findOne({ where: { token: code } });
        if (!existingToken) { return code; }
        attempts++;
      } while (true);
    }
  
    // --- Change Password Method (Updates passwordChangedAt) ---
    async changePassword(
        userId: number,
        changePasswordDto: ChangePasswordDto,
        currentTokenJti: string,
        currentTokenExp: number
    ): Promise<{ message: string }> {
        this.logger.log(`Attempting password change for user ID: ${userId}`);
        const userWithPassword = await this.usersRepository.findOne({ where: { id: userId }, select: ['id', 'password'] });
         if (!userWithPassword?.password) { throw new InternalServerErrorException('Could not retrieve user credentials.'); }
        const isOldPasswordValid = await bcrypt.compare(changePasswordDto.oldPassword, userWithPassword.password);
        if (!isOldPasswordValid) { throw new UnauthorizedException('Incorrect current password.'); }
  
        const saltRounds = 10;
        const newHashedPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);
  
        try {
            // Update password
            await this.usersService.updatePassword(userId, newHashedPassword);
            // Update timestamp
            await this.usersRepository.update(userId, { passwordChangedAt: new Date() });
            this.logger.log(`Updated passwordChangedAt timestamp for user ID: ${userId} after change.`);
        } catch (error) {
            this.logger.error(`Failed to update password/timestamp in DB for user ${userId}: ${error.message}`, error.stack);
            if (error instanceof NotFoundException) { throw error; }
            throw new InternalServerErrorException('Failed to update password.');
        }
  
        // Deny the current token
        try {
            this.tokenDenyListService.denyToken(currentTokenJti, currentTokenExp);
            this.logger.log(`Denied token JTI ${currentTokenJti} for user ID ${userId} after password change.`);
        } catch (error) {
            this.logger.error(`Non-critical: Failed to deny token ${currentTokenJti} after password change for user ${userId}: ${error.message}`, error.stack);
        }
  
        return { message: 'Password changed successfully. Please log in again.' };
    }
  
  } // End AuthService