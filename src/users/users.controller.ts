import {
  Controller, Post, Body, InternalServerErrorException, Logger, Get, Param, ParseIntPipe, Patch, UseGuards, // <<< Import Get, Patch, UseGuards
  HttpException, HttpStatus, // <<< Import HttpException, HttpStatus
} from '@nestjs/common';
import { UsersService } from './users.service';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // <<< Import Guards
import { RolesGuard } from '../auth/roles.guards';
import { Roles } from '../auth/roles.decorator'; // <<< Import Roles Decorator

// Define safe return type (adjust Omit as needed)
type PendingEmployerInfo = Omit<User, 'password' | 'emailVerificationToken' | 'emailVerificationExpires' | 'employeeProfile' | 'resetTokens'>;

@Controller('users') // Base path /users
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // --- Keep Test Endpoint (DEBUG ONLY) ---
  @Post('test-update-password')
  async testUpdatePassword(@Body() body: { userId: number; password?: string }) {
    this.logger.log(`Received request to test password update for user ID: ${body.userId}`);
    if (!body.password) { throw new InternalServerErrorException('Password is required for testing update.'); }
    try {
      const hashedPassword = await bcrypt.hash(body.password, 10);
      await this.usersService.updatePassword(body.userId, hashedPassword);
      this.logger.log(`Test updatePassword successful for user ID: ${body.userId}`);
      return { message: 'Test password update successful' };
    } catch (error) { throw new InternalServerErrorException(`Failed to update password during test: ${error.message}`); }
  }


  // --- NEW Admin Endpoint: List Pending Employers ---
  @Get('admin/pending-employers') // Clear admin-specific path
  @UseGuards(JwtAuthGuard, RolesGuard) // Secure the endpoint
  @Roles('admin') // Only allow users with 'admin' role
  async getPendingEmployers(): Promise<PendingEmployerInfo[]> {
      this.logger.log('ADMIN ACTION: Request received for pending employer list.');
      try {
          return await this.usersService.findPendingEmployers();
      } catch (error) {
           this.logger.error(`ADMIN ACTION: Failed to fetch pending employers: ${error.message}`, error.stack);
           throw new HttpException('Failed to retrieve pending employers.', HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }
  // --- End List Pending Employers ---


  // --- NEW Admin Endpoint: View Single Pending Employer ---
  @Get('admin/pending-employer/:id') // Use User ID as param
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getOnePendingEmployer(@Param('id', ParseIntPipe) id: number): Promise<PendingEmployerInfo> {
      this.logger.log(`ADMIN ACTION: Request received for pending employer details, ID: ${id}`);
      // Service method handles NotFoundException
      return this.usersService.findOnePendingEmployer(id);
  }
  // --- End View Single Pending Employer ---


  // --- SECURED Admin Endpoint: Approve Employer ---
  // Changed from POST to PATCH, added guards and roles
  @Patch('admin/approve-employer/:id') // Use PATCH for state change
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async approveEmployer(@Param('id', ParseIntPipe) id: number): Promise<PendingEmployerInfo> {
      this.logger.log(`ADMIN ACTION: Request received to approve employer ID: ${id}`);
      // Service method handles logic and NotFoundException/BadRequestException
      // It already returns the user without the password
      return await this.usersService.adminApproveEmployer(id);
  }
  // --- End Approve Employer ---


  // Example: Add an endpoint to get a user by ID (excluding password) - Keep if needed
  // @Get(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard) // Secure appropriately
  // @Roles('admin') // Example: Only admin can get arbitrary user by ID
  // async findUserById(@Param('id', ParseIntPipe) id: number): Promise<Omit<User, 'password'>> {
  //   this.logger.log(`Fetching user by ID: ${id}`);
  //   const user = await this.usersService.findOne(id); // findOne should handle NotFoundException & exclude pwd
  //   return user;
  // }

} // End Controller