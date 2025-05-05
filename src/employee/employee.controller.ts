import {
  Controller, Get, Put, Patch, Post, Delete, UseGuards, Req, Body, Logger, UseInterceptors, UploadedFile, HttpException, HttpStatus, Res, Param, ParseIntPipe, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guards';
import { Roles } from '../auth/roles.decorator';
import { EmployeeService } from './employee.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Request, Response } from 'express';
import { resumeStorage, resumeFileFilter, resumeLimits } from '../config/multer.config';
import { join } from 'path';
import { existsSync } from 'fs';
import { Employee, FeedbackStatus } from './entities/employee.entity'; // Import FeedbackStatus
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { Education } from './entities/education.entity';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

// Interface and Type Alias
interface RequestWithUser extends Request { user: { userId: number; email: string; role: string; jti: string; }; }
// Include feedback status in the response type
type EmployeeProfileResponse = Omit<Employee, 'user'> & { user: {id: number; name: string; email: string; role: string;}; resumeUrl: string | null; }; // Example refinement

@Controller('employee')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeController {
  private readonly logger = new Logger(EmployeeController.name);

  constructor(private readonly employeeService: EmployeeService) {}

  // --- Profile Endpoints ---
  @Get('profile')
  @Roles('employee')
  async getProfile(@Req() req: RequestWithUser): Promise<EmployeeProfileResponse> {
    this.logger.log(`Fetching profile for user ID: ${req.user.userId}`);
    const profile = await this.employeeService.findOne(req.user.userId);
    this.logger.log(`Profile retrieved successfully for user ID: ${req.user.userId}`);
    // Construct response DTO manually or use class-transformer
    const response: EmployeeProfileResponse = {
        id: profile.id,
        bio: profile.bio,
        skills: profile.skills,
        yearsOfExperience: profile.yearsOfExperience,
        userId: profile.userId,
        resumeFilename: profile.resumeFilename, // Keep filename if needed
        educationHistory: profile.educationHistory, // Include if loaded
        projects: profile.projects, // Include if loaded
        resumeFeedbackStatus: profile.resumeFeedbackStatus,
        resumeFeedback: profile.resumeFeedback, // Maybe exclude full feedback from profile GET?
        resumeFeedbackTimestamp: profile.resumeFeedbackTimestamp,
        user: { // Exclude sensitive user fields
            id: profile.user.id,
            name: profile.user.name,
            email: profile.user.email,
            role: profile.user.role,
        },
        resumeUrl: null // Initialize
    };
    if (profile.resumeFilename) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        response.resumeUrl = `${baseUrl}/uploads/resumes/${profile.resumeFilename}`;
    }
    return response;
  }

  @Put('profile')
  @Roles('employee')
  async updateProfile(@Req() req: RequestWithUser, @Body() updateDto: UpdateEmployeeDto): Promise<EmployeeProfileResponse> {
    this.logger.log(`Updating profile (PUT) for user ID: ${req.user.userId}`);
    const updatedProfile = await this.employeeService.update(req.user.userId, updateDto);
    // Construct response DTO similarly to getProfile
    const response: EmployeeProfileResponse = { /* ... map fields ... */ } as EmployeeProfileResponse; // Map fields properly
    return response;
  }

  @Patch('profile')
  @Roles('employee')
  async partialUpdateProfile(@Req() req: RequestWithUser, @Body() updateDto: UpdateEmployeeDto): Promise<EmployeeProfileResponse> {
    this.logger.log(`Updating profile (PATCH) for user ID: ${req.user.userId}`);
    const updatedProfile = await this.employeeService.partialUpdate(req.user.userId, updateDto);
    // Construct response DTO similarly to getProfile
    const response: EmployeeProfileResponse = { /* ... map fields ... */ } as EmployeeProfileResponse; // Map fields properly
    return response;
  }

  // --- Resume Endpoints ---
  @Post('resume')
  @Roles('employee')
  @UseInterceptors(FileInterceptor('resume', { storage: resumeStorage, fileFilter: resumeFileFilter, limits: resumeLimits }))
  async uploadResume(@UploadedFile() file: Express.Multer.File, @Req() req: RequestWithUser): Promise<{ message: string; filename: string; path: string }> {
    const userId = req.user.userId; this.logger.log(`Received resume upload request for user ID: ${userId}`);
    if (!file) { throw new HttpException('Resume file is required or file type is unsupported.', HttpStatus.BAD_REQUEST); }
    this.logger.log(`File ${file.filename} uploaded successfully for user ID: ${userId}. Path: ${file.path}`);
    try { await this.employeeService.updateResumeFilename(userId, file.filename); }
    catch (error) { if (error instanceof NotFoundException) { throw new HttpException(error.message, HttpStatus.NOT_FOUND); } throw new HttpException('Failed to save resume information.', HttpStatus.INTERNAL_SERVER_ERROR); }
    const accessiblePath = `/uploads/resumes/${file.filename}`;
    return { message: 'Resume uploaded successfully!', filename: file.filename, path: accessiblePath };
  }

  @Get('resume/info')
  @Roles('employee', 'employer')
  async getResumeInfo(@Req() req: RequestWithUser): Promise<{ resumeUrl: string | null }> {
      const userId = req.user.userId; this.logger.log(`Fetching resume info for user ID: ${userId}`);
      const employee = await this.employeeService.findOne(userId); // findOne loads profile
      if (!employee.resumeFilename) { return { resumeUrl: null }; }
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const resumeUrl = `${baseUrl}/uploads/resumes/${employee.resumeFilename}`;
      return { resumeUrl };
  }

  @Get('resume/download')
  @Roles('employee', 'employer')
  async downloadResume(@Req() req: RequestWithUser, @Res() res: Response) {
      const userId = req.user.userId; this.logger.log(`Request to download resume for user ID: ${userId}`);
      const employee = await this.employeeService.findOne(userId);
      if (!employee || !employee.resumeFilename) { throw new HttpException('Resume not found for this user.', HttpStatus.NOT_FOUND); }
      const filePath = join(process.cwd(), 'uploads', 'resumes', employee.resumeFilename);
      this.logger.log(`Attempting to send file: ${filePath}`);
      if (!existsSync(filePath)) { throw new HttpException('Resume file not found on server.', HttpStatus.NOT_FOUND); }
      res.setHeader('Content-Disposition', `attachment; filename="${employee.resumeFilename}"`);
      res.sendFile(filePath, (err) => { if (err) { this.logger.error(`Error sending file ${filePath}: ${err.message}`, err.stack); if (!res.headersSent) { res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error downloading the resume file.' }); } else { console.error("Headers already sent..."); } } else { this.logger.log(`Resume file ${employee.resumeFilename} sent successfully for user ID: ${userId}`); } });
  }

  // --- Education Endpoints ---
   @Post('education')
  @Roles('employee')
  async addEducation(@Req() req: RequestWithUser, @Body() createEducationDto: CreateEducationDto): Promise<Education> {
    const userId = req.user.userId; this.logger.log(`Request to add education for user ID: ${userId}`);
    try { return await this.employeeService.addEducation(userId, createEducationDto); }
    catch (error) { if (error instanceof NotFoundException) { throw new HttpException(error.message, HttpStatus.NOT_FOUND); } throw new HttpException('Failed to add education record.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('education')
  @Roles('employee', 'employer')
  async getEducation(@Req() req: RequestWithUser): Promise<Education[]> {
    const userId = req.user.userId; this.logger.log(`Request to get education history for user ID: ${userId}`);
    try { return await this.employeeService.getEducation(userId); }
    catch (error) { if (error instanceof NotFoundException) { throw new HttpException(error.message, HttpStatus.NOT_FOUND); } throw new HttpException('Failed to retrieve education history.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Patch('education/:educationId')
  @Roles('employee')
  async updateEducation(@Req() req: RequestWithUser, @Param('educationId', ParseIntPipe) educationId: number, @Body() updateEducationDto: UpdateEducationDto): Promise<Education> {
    const userId = req.user.userId; this.logger.log(`Request to update education ID: ${educationId} for user ID: ${userId}`);
    try { return await this.employeeService.updateEducation(userId, educationId, updateEducationDto); }
    catch (error) { if (error instanceof NotFoundException) { throw new HttpException(error.message, HttpStatus.NOT_FOUND); } if (error instanceof ForbiddenException) { throw new HttpException(error.message, HttpStatus.FORBIDDEN); } throw new HttpException('Failed to update education record.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Delete('education/:educationId')
  @Roles('employee')
  async deleteEducation(@Req() req: RequestWithUser, @Param('educationId', ParseIntPipe) educationId: number): Promise<{ message: string }> {
    const userId = req.user.userId; this.logger.log(`Request to delete education ID: ${educationId} for user ID: ${userId}`);
     try { await this.employeeService.deleteEducation(userId, educationId); return { message: `Education record ID ${educationId} deleted successfully.` }; }
     catch (error) { if (error instanceof NotFoundException) { throw new HttpException(error.message, HttpStatus.NOT_FOUND); } if (error instanceof ForbiddenException) { throw new HttpException(error.message, HttpStatus.FORBIDDEN); } throw new HttpException('Failed to delete education record.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // --- Project Endpoints ---
  @Post('projects')
  @Roles('employee')
  async addProject(@Req() req: RequestWithUser, @Body() createProjectDto: CreateProjectDto): Promise<Project> {
      const userId = req.user.userId; this.logger.log(`User ID ${userId} adding project: ${createProjectDto.title}`);
      try { return await this.employeeService.addProject(userId, createProjectDto); }
      catch (error) { if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND); throw new HttpException('Failed to add project.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('projects')
  @Roles('employee', 'employer')
  async getProjects(@Req() req: RequestWithUser): Promise<Project[]> {
      const userId = req.user.userId; this.logger.log(`User ID ${userId} fetching projects.`);
       try { return await this.employeeService.getProjects(userId); }
       catch (error) { if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND); throw new HttpException('Failed to retrieve projects.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Patch('projects/:projectId')
  @Roles('employee')
  async updateProject(@Req() req: RequestWithUser, @Param('projectId', ParseIntPipe) projectId: number, @Body() updateProjectDto: UpdateProjectDto): Promise<Project> {
      const userId = req.user.userId; this.logger.log(`User ID ${userId} updating project ID: ${projectId}`);
       try { return await this.employeeService.updateProject(userId, projectId, updateProjectDto); }
       catch (error) { if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND); if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN); throw new HttpException('Failed to update project.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Delete('projects/:projectId')
  @Roles('employee')
  async deleteProject(@Req() req: RequestWithUser, @Param('projectId', ParseIntPipe) projectId: number): Promise<{ message: string }> {
      const userId = req.user.userId; this.logger.log(`User ID ${userId} deleting project ID: ${projectId}`);
       try { await this.employeeService.deleteProject(userId, projectId); return { message: `Project ID ${projectId} deleted successfully.` }; }
       catch (error) { if (error instanceof NotFoundException) throw new HttpException(error.message, HttpStatus.NOT_FOUND); if (error instanceof ForbiddenException) throw new HttpException(error.message, HttpStatus.FORBIDDEN); throw new HttpException('Failed to delete project.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  // --- AI Feedback Endpoints ---
  @Post('resume/feedback')
  @Roles('employee')
  async triggerResumeFeedback(@Req() req: RequestWithUser): Promise<{ message: string; status?: FeedbackStatus; feedback?: string | null }> {
      const userId = req.user.userId; this.logger.log(`User ID ${userId} requested AI resume feedback generation.`);
      try { const result = await this.employeeService.generateResumeFeedback(userId); return { message: result.status === FeedbackStatus.COMPLETED ? 'Feedback generated successfully.' : 'Feedback generation failed.', status: result.status, feedback: result.feedback }; }
      catch (error) { if (error instanceof HttpException) { throw error; } throw new HttpException('Failed to process resume feedback request.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }

  @Get('resume/feedback')
  @Roles('employee')
  async getResumeFeedback(@Req() req: RequestWithUser): Promise<{ status: FeedbackStatus; feedback: string | null; timestamp: Date | null }> {
      const userId = req.user.userId; this.logger.log(`User ID ${userId} requesting to view resume feedback.`);
      try { return await this.employeeService.getResumeFeedback(userId); }
      catch (error) { if (error instanceof NotFoundException) { throw new HttpException(error.message, HttpStatus.NOT_FOUND); } throw new HttpException('Failed to retrieve resume feedback.', HttpStatus.INTERNAL_SERVER_ERROR); }
  }
  // --- End AI Feedback Endpoints ---

} // End Controller Class