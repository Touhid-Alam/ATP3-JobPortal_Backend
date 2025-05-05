import {
    Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException,
    Logger,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { User, UserStatus } from './entities/user.entity';
  import * as bcrypt from 'bcrypt';
  import { MailerService } from '../mailer/mailer.service';
  
  type PendingEmployerInfo = Omit<User, 'password' | 'emailVerificationToken' | 'emailVerificationExpires' | 'employeeProfile' | 'resetTokens'>;
  
  @Injectable()
  export class UsersService {
    private readonly logger = new Logger(UsersService.name);
  
    constructor(
      @InjectRepository(User)
      private usersRepository: Repository<User>,
      private readonly mailerService: MailerService,
    ) {}
  
    // --- Create Pending User Method ---
    async createPendingUser(userData: Partial<User>, initialStatus: UserStatus, verificationToken?: string | null, tokenExpires?: Date | null): Promise<Omit<User, 'password'>> {
        this.logger.log(`Attempting to create pending user: ${userData.email}, Status: ${initialStatus}`);
        const existingUser = await this.usersRepository.findOne({ where: { email: userData.email } });
        if (existingUser) { /* Keep existing conflict checks */ throw new ConflictException('User with this email already exists.'); }
        let hashedPassword: string | null = null;
        if (userData.password) { hashedPassword = await bcrypt.hash(userData.password, 10); }
        const userToCreate = this.usersRepository.create({ name: userData.name, email: userData.email, role: userData.role, companyName: userData.companyName, companyWebsite: userData.companyWebsite, password: hashedPassword, status: initialStatus, emailVerificationToken: verificationToken, emailVerificationExpires: tokenExpires });
        try { const savedUser = await this.usersRepository.save(userToCreate); this.logger.log(`User created successfully with ID: ${savedUser.id}, Status: ${savedUser.status}`); const { password, ...result } = savedUser; return result; }
        catch (error) { throw new InternalServerErrorException('Could not create user account.'); }
    }
  
    // --- Find By Email Method ---
    async findByEmail(email: string): Promise<User | null> {
      this.logger.debug(`Finding user by email: ${email}`);
      const user = await this.usersRepository.findOne({ where: { email }, select: ['id', 'email', 'password', 'role', 'name', 'status', 'createdAt'] });
      if (!user) { this.logger.debug(`User not found for email: ${email}`); }
      return user || null;
    }
  
    // --- Find One Method ---
    async findOne(id: number): Promise<User> {
      this.logger.debug(`Finding user by ID: ${id}`);
      if (isNaN(id) || id <= 0) { throw new NotFoundException(`Invalid User ID format: ${id}`); }
      const user = await this.usersRepository.findOne({ where: { id }, relations: ['employeeProfile'], select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, companyName: true, companyWebsite: true, emailVerificationExpires: true, emailVerificationToken: true, passwordChangedAt: true, employeeProfile: { id: true, bio: true, skills: true, yearsOfExperience: true, resumeFilename: true, resumeFeedbackStatus: true } } }); // Added passwordChangedAt
      if (!user) { throw new NotFoundException(`User with ID ${id} not found`); }
      this.logger.debug(`User found for ID: ${id}, Status: ${user.status}`);
      return user;
    }
  
    // --- Update Password Method ---
    async updatePassword(userId: number, newHashedPassword: string): Promise<void> {
       this.logger.log(`Attempting to update password for user ID: ${userId}`);
       if (isNaN(userId) || userId <= 0) { throw new NotFoundException(`Invalid User ID format for password update: ${userId}`); }
       if (newHashedPassword === null || newHashedPassword === undefined) { throw new InternalServerErrorException('Invalid password provided for update.'); }
       try {
          // We only update the password here, not the timestamp. AuthService handles timestamp.
          const result = await this.usersRepository.update(userId, { password: newHashedPassword });
          if (result.affected === 0) { throw new NotFoundException(`User with ID ${userId} not found, password not updated.`); }
          this.logger.log(`Password updated successfully in DB for user ID: ${userId}`);
      } catch (error) { throw new InternalServerErrorException('Could not update password due to a database error.'); }
    }
  
    // --- Find By Verification Token Method ---
    async findByVerificationToken(token: string): Promise<User | null> {
        this.logger.debug(`Finding user by verification token: ${token}`);
        // It's better for AuthService to find by email AND check token/expiry
        // This method might not be strictly needed anymore depending on AuthService logic
        return this.usersRepository.findOne({
            where: { emailVerificationToken: token, status: UserStatus.PENDING_EMAIL_VERIFICATION },
            select: ['id', 'emailVerificationExpires', 'status', 'password']
        });
    }
  
    // --- Activate User Method ---
    async activateUser(userId: number, hashedPassword?: string): Promise<User> {
        this.logger.log(`Activating user ID: ${userId}`);
        const user = await this.usersRepository.findOneBy({ id: userId });
        if (!user) { throw new NotFoundException(`User with ID ${userId} not found.`); }
        if (user.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
            this.logger.warn(`Attempted to activate user ${userId} who is not pending verification (Status: ${user.status})`);
            return this.findOne(userId); // Return current state
        }
        const updateData: Partial<User> = { status: UserStatus.ACTIVE, emailVerificationToken: null, emailVerificationExpires: null };
        if (hashedPassword) { updateData.password = hashedPassword; }
        else { throw new InternalServerErrorException('Cannot activate account without setting a password.'); }
        // Also set passwordChangedAt on initial activation/password set
        updateData.passwordChangedAt = new Date();
        await this.usersRepository.update(userId, updateData);
        this.logger.log(`User ID ${userId} activated successfully.`);
        return this.findOne(userId); // Refetch to return clean data
    }
  
    // --- Admin Approve Employer Method ---
    async adminApproveEmployer(employerUserId: number): Promise<PendingEmployerInfo> {
         this.logger.warn(`ADMIN ACTION: Approving employer ID: ${employerUserId}`);
         const user = await this.usersRepository.findOneBy({ id: employerUserId });
         if (!user) { throw new NotFoundException(`Employer user with ID ${employerUserId} not found.`); }
         if (user.role !== 'employer') { throw new BadRequestException(`User ${employerUserId} is not an employer.`); }
         if (user.status === UserStatus.ACTIVE) { this.logger.warn(`Employer ${employerUserId} is already active.`); const { password, ...result } = user; return result as PendingEmployerInfo; }
         if (user.status !== UserStatus.PENDING_ADMIN_APPROVAL) { throw new BadRequestException(`Employer is not pending approval (current status: ${user.status}).`); }
         user.status = UserStatus.ACTIVE;
         try {
             const savedUser = await this.usersRepository.save(user);
             this.logger.log(`ADMIN ACTION: Employer ${employerUserId} approved successfully.`);
             try { // Send email
                 const loginUrl = process.env.FRONTEND_LOGIN_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/auth/login`;
                 await this.mailerService.sendMail({ to: savedUser.email, subject: 'Your Job Portal Employer Account Has Been Approved!', text: `Hello ${savedUser.name}...`, html: `<p>Hello ${savedUser.name}, Your account is approved...</p>` });
                 this.logger.log(`Approval email sent successfully to employer: ${savedUser.email}`);
             } catch (emailError) { this.logger.error(`Failed to send approval email to ${savedUser.email}: ${emailError.message}`, emailError.stack); }
             const { password, ...result } = savedUser;
             return result as PendingEmployerInfo;
         } catch (error) { throw new InternalServerErrorException('Could not approve employer.'); }
     }
  
    // --- Find All Pending Employer Registrations Method ---
    async findPendingEmployers(): Promise<PendingEmployerInfo[]> {
        this.logger.log('ADMIN ACTION: Fetching all pending employer registrations.');
        const pendingEmployers = await this.usersRepository.find({ where: { role: 'employer', status: UserStatus.PENDING_ADMIN_APPROVAL }, select: [ 'id', 'name', 'email', 'companyName', 'companyWebsite', 'createdAt', 'status', 'role' ], order: { createdAt: 'ASC' } });
        this.logger.log(`Found ${pendingEmployers.length} pending employer registrations.`);
        return pendingEmployers as PendingEmployerInfo[];
    }
  
    // --- Find One Specific Pending Employer Method ---
    async findOnePendingEmployer(id: number): Promise<PendingEmployerInfo> {
         this.logger.log(`ADMIN ACTION: Fetching details for pending employer ID: ${id}`);
         const pendingEmployer = await this.usersRepository.findOne({ where: { id: id, role: 'employer', status: UserStatus.PENDING_ADMIN_APPROVAL }, select: [ 'id', 'name', 'email', 'companyName', 'companyWebsite', 'createdAt', 'status', 'role' ] });
         if (!pendingEmployer) {
             const exists = await this.usersRepository.countBy({id: id});
             if (exists > 0) { throw new NotFoundException(`User with ID ${id} found, but is not a pending employer.`); }
             else { throw new NotFoundException(`Pending employer with ID ${id} not found.`); }
         }
         return pendingEmployer as PendingEmployerInfo;
    }
  
    // --- NEW Method: Find User specifically for Auth Validation ---
    async findOneForAuth(id: number): Promise<User | null> {
        this.logger.debug(`Finding user for auth validation by ID: ${id}`);
        if (isNaN(id) || id <= 0) { return null; }
        // Select fields needed by JwtStrategy
        return this.usersRepository.findOne({
            where: { id },
            select: [ 'id', 'role', 'status', 'passwordChangedAt' ] // <<< Select passwordChangedAt
        });
    }
  
  } // End UsersService