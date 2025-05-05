import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ParseIntPipe, Query, Logger, HttpException, HttpStatus, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { JobsService, JobRecommendation } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guards';
import { Roles } from '../auth/roles.decorator';
import { JobSearchQueryDto } from './dto/job-search-query.dto';
import { Job } from './entities/job.entity';
import { JobDetailsDto } from './dto/job-details.dto';
import { Request } from 'express';

// Define RequestWithUser interface
interface RequestWithUser extends Request {
  user: { userId: number; email: string; role: string; jti: string; };
}

@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobsService: JobsService) {}

  // --- Create Job ---
  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('employer')
  async create(@Req() req: RequestWithUser, @Body() createJobDto: CreateJobDto): Promise<Job> {
    const employerId = req.user.userId;
    this.logger.log(`User ID ${employerId} requesting to create job: ${createJobDto.title}`);
    try { return await this.jobsService.create(employerId, createJobDto); }
    catch (error) { if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND); throw new HttpException('Failed to create job posting.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // --- Find All Jobs (Original - Implicit AND logic) ---
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employee', 'employer')
  async findAll(@Query() query: JobSearchQueryDto): Promise<Job[]> {
    this.logger.log(`Request to find all jobs (AND logic) with query: ${JSON.stringify(query)}`);
    return this.jobsService.findAll(query); // Calls original service method
  }

  // --- NEW Find Jobs (Title OR Skills - Explicit OR logic) ---
  @Get('search/any') // Use a distinct path
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employee', 'employer')
  async findAny(@Query() query: JobSearchQueryDto): Promise<Job[]> {
      this.logger.log(`Request to find jobs (OR logic) with query: ${JSON.stringify(query)}`);
      // Calls the new service method
      return this.jobsService.findByTitleOrSkills(query);
  }
  // --- End NEW Find Jobs ---


  // --- Get Employee Recommendations ---
  @Get('recommendations/my') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('employee')
  async getMyRecommendations(@Req() req: RequestWithUser): Promise<JobRecommendation[]> {
    const employeeUserId = req.user.userId;
    this.logger.log(`Request for job recommendations received for user ID: ${employeeUserId}`);
    try { return await this.jobsService.getRecommendations(employeeUserId); }
    catch (error) { if (error instanceof NotFoundException) { throw new HttpException(error.message, HttpStatus.NOT_FOUND); } throw new HttpException('Failed to retrieve job recommendations.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // --- Get Employer's Posted Jobs ---
  @Get('my/posted') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('employer')
  async findMyPostedJobs(@Req() req: RequestWithUser): Promise<Job[]> {
    const employerId = req.user.userId;
    this.logger.log(`Employer ID ${employerId} requesting their posted jobs.`);
    try { return await this.jobsService.findJobsByEmployer(employerId); }
    catch (error) { throw new HttpException('Failed to retrieve your posted jobs.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // --- Get Single Job Details ---
  // Route order: Specific routes first, then parameterized ':id'
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employee', 'employer')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<JobDetailsDto> {
     this.logger.log(`Request to find job details with ID: ${id}`);
     return this.jobsService.findOne(id);
  }

  // --- Update Job ---
  @Patch(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('employer')
  async update(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Body() updateJobDto: UpdateJobDto): Promise<Job> {
    const employerId = req.user.userId;
    this.logger.log(`User ID ${employerId} requesting to update job ID: ${id}`);
    try { return await this.jobsService.update(id, employerId, updateJobDto); }
    catch (error) { if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND); if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN); throw new HttpException('Failed to update job posting.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // --- Delete Job ---
  @Delete(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('employer')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser): Promise<{ message: string }> {
    const employerId = req.user.userId;
    this.logger.log(`User ID ${employerId} requesting to delete job ID: ${id}`);
     try { await this.jobsService.remove(id, employerId); return { message: `Job posting with ID ${id} deleted successfully.` }; }
     catch (error) { if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND); if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN); throw new HttpException('Failed to delete job posting.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

} // End Controller Class