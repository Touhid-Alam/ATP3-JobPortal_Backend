import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete, // Keep Delete if needed later
  UseGuards,
  Req,
  ParseIntPipe,
  Logger,
  HttpException,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JobApplicationsService } from './job-applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guards';
import { Roles } from '../auth/roles.decorator';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto'; // <<< This import should now work
import { JobApplication } from './entities/job-application.entity';
import { UpdateApplicationNotesDto } from './dto/update-application-notes.dto'; // <<< This import should now work
import { Request } from 'express'; // Import Request

// Define RequestWithUser interface
interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    role: string;
    jti: string; // Include JTI if needed from strategy
  };
}

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobApplicationsController {
  private readonly logger = new Logger(JobApplicationsController.name);

  constructor(private readonly jobApplicationsService: JobApplicationsService) {}

  // --- Apply for Job ---
  @Post('job/:jobId')
  @Roles('employee')
  async apply(
    @Req() req: RequestWithUser,
    @Param('jobId', ParseIntPipe) jobId: number,
  ): Promise<JobApplication> {
    const employeeId = req.user.userId;
    this.logger.log(`Employee ID ${employeeId} requesting to apply for job ID ${jobId}`);
    try {
        return await this.jobApplicationsService.apply(employeeId, jobId);
    } catch (error) {
        this.logger.error(`Application failed for employee ${employeeId}, job ${jobId}: ${error.message}`, error.stack);
        if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
        if (error instanceof ConflictException) throw new HttpException(error.message, HttpStatus.CONFLICT);
        throw new HttpException('Failed to submit application.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  // --- End Apply for Job ---


  // --- Express Interest ---
  @Post('interest/job/:jobId')
  @Roles('employee')
  async expressInterest(
      @Req() req: RequestWithUser,
      @Param('jobId', ParseIntPipe) jobId: number,
  ): Promise<JobApplication> {
      const employeeId = req.user.userId;
      this.logger.log(`Employee ID ${employeeId} requesting to express interest in job ID ${jobId}`);
      try {
          return await this.jobApplicationsService.expressInterest(employeeId, jobId);
      } catch (error) {
          this.logger.error(`Express interest failed for employee ${employeeId}, job ${jobId}: ${error.message}`, error.stack);
          if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
          if (error instanceof ConflictException) throw new HttpException(error.message, HttpStatus.CONFLICT);
          throw new HttpException('Failed to express interest.', HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }
  // --- End Express Interest ---


  // --- Get My Applications (Employee) ---
  @Get('my')
  @Roles('employee')
  async findMyApplications(@Req() req: RequestWithUser): Promise<JobApplication[]> {
    const employeeId = req.user.userId;
    this.logger.log(`Employee ID ${employeeId} requesting their applications.`);
    return this.jobApplicationsService.findByEmployee(employeeId);
  }
  // --- End Get My Applications ---


  // --- Get Applications for a Job (Employer) ---
  @Get('job/:jobId')
  @Roles('employer')
  async findApplicationsForJob(
      @Req() req: RequestWithUser,
      @Param('jobId', ParseIntPipe) jobId: number
  ): Promise<JobApplication[]> {
      const employerId = req.user.userId;
      this.logger.log(`Employer ID ${employerId} requesting applications for job ID ${jobId}`);
      try {
          return await this.jobApplicationsService.findByJob(jobId, employerId);
      } catch (error) {
           this.logger.error(`Failed getting applications for job ${jobId} by employer ${employerId}: ${error.message}`, error.stack);
           if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
           if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN);
           throw new HttpException('Failed to retrieve job applications.', HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }
  // --- End Get Applications for a Job ---


  // --- Get Single Application ---
   @Get(':id')
   @Roles('employee', 'employer') // Allow both, service checks ownership
   async findOne(
       @Param('id', ParseIntPipe) id: number,
       @Req() req: RequestWithUser
   ): Promise<JobApplication> {
       const userId = req.user.userId;
       const userRole = req.user.role;
       this.logger.log(`User ID ${userId} (Role: ${userRole}) requesting application ID ${id}`);
       try {
            return await this.jobApplicationsService.findOne(id, userId, userRole);
       } catch (error) {
            this.logger.error(`Failed getting application ${id} for user ${userId}: ${error.message}`, error.stack);
           if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
           if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN);
           throw new HttpException('Failed to retrieve application details.', HttpStatus.INTERNAL_SERVER_ERROR);
       }
   }
   // --- End Get Single Application ---


   // --- Update Application Status (Employer) ---
  @Patch(':id/status')
  @Roles('employer')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Body() updateApplicationStatusDto: UpdateApplicationStatusDto, // <<< Uses the imported DTO
  ): Promise<JobApplication> {
    const employerId = req.user.userId;
    this.logger.log(`Employer ID ${employerId} requesting to update status for application ID ${id} to ${updateApplicationStatusDto.status}`);
     try {
        return await this.jobApplicationsService.updateStatus(id, employerId, updateApplicationStatusDto.status);
    } catch (error) {
         this.logger.error(`Status update failed for application ${id} by employer ${employerId}: ${error.message}`, error.stack);
         if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
         if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN);
         throw new HttpException('Failed to update application status.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  // --- End Update Application Status ---


  // --- Update Employee Notes ---
  @Patch(':id/notes')
  @Roles('employee') // Only employee can update their own notes
  async updateEmployeeNotes(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Body() updateApplicationNotesDto: UpdateApplicationNotesDto, // <<< Uses the imported DTO
  ): Promise<JobApplication> {
    const employeeId = req.user.userId;
    this.logger.log(`Employee ID ${employeeId} requesting to update notes for application ID ${id}`);
    try {
      return await this.jobApplicationsService.updateEmployeeNotes(id, employeeId, updateApplicationNotesDto.notes ?? null);
    } catch (error) {
      this.logger.error(`Notes update failed for application ${id} by employee ${employeeId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      throw new HttpException('Failed to update application notes.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  // --- End Update Employee Notes ---

} // End Controller Class