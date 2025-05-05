import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  Logger,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, FeedbackStatus } from './entities/employee.entity';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { User } from '../users/entities/user.entity';
import { Education } from './entities/education.entity';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AiFeedbackService } from '../ai/ai-feedback.service';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Education) private educationRepo: Repository<Education>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private aiFeedbackService: AiFeedbackService,
  ) {}

  // --- Restored create method ---
  async create(userId: number, createEmployeeDto: CreateEmployeeDto): Promise<Employee> {
    this.logger.debug(`Attempting to create employee profile for user ID: ${userId}`);
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) { throw new InternalServerErrorException(`User with ID ${userId} not found during employee profile creation.`); }
    const existingEmployee = await this.employeeRepo.findOne({ where: { userId } });
    if (existingEmployee) {
      this.logger.warn(`Employee profile already exists for user ID: ${userId}. Returning existing.`);
      if (existingEmployee.user) { delete (existingEmployee.user as any).password; }
      return existingEmployee;
    }
    const newEmployee = this.employeeRepo.create({ ...createEmployeeDto, userId: userId, user: user });
    try {
      const savedEmployee = await this.employeeRepo.save(newEmployee);
      this.logger.log(`Created employee profile for user ID: ${userId}, Employee ID: ${savedEmployee.id}`);
      if (savedEmployee.user) { delete (savedEmployee.user as any).password; }
      return savedEmployee;
    } catch (error) { throw new InternalServerErrorException('Could not create employee profile.'); }
  }

  // --- Restored findOne method ---
  async findOne(userId: number): Promise<Employee> {
      this.logger.debug(`Finding employee profile for user ID: ${userId}`);
      const employee = await this.employeeRepo.findOne({ where: { userId }, relations: ['user', 'educationHistory', 'projects'] });
      if (!employee) {
          const userExists = await this.usersRepository.countBy({ id: userId });
          if (!userExists) { throw new NotFoundException(`User with ID ${userId} not found.`); }
          throw new NotFoundException(`Employee profile not found for User ID: ${userId}.`);
      }
      if (employee.user) { delete (employee.user as any).password; }
      this.logger.debug(`Found employee profile for user ID: ${userId}`);
      return employee;
  }

  // --- Restored update (profile) method ---
  async update(userId: number, updateDto: UpdateEmployeeDto): Promise<Employee> {
    this.logger.debug(`Attempting to update employee profile for user ID: ${userId}`);
    const employee = await this.employeeRepo.findOne({ where: { userId }, relations: ['user'] });
    if (!employee) {
        const userExists = await this.usersRepository.countBy({ id: userId });
        if (!userExists) { throw new NotFoundException(`User with ID ${userId} not found.`); }
        throw new NotFoundException(`Employee profile not found for User ID: ${userId}. Cannot update.`);
    }
    this.employeeRepo.merge(employee, updateDto);
    try {
      const updatedEmployee = await this.employeeRepo.save(employee);
      this.logger.log(`Updated employee profile for user ID: ${userId}, Employee ID: ${updatedEmployee.id}`);
      if (updatedEmployee.user) { delete (updatedEmployee.user as any).password; }
      return updatedEmployee;
    } catch (error) { throw new InternalServerErrorException('Could not update employee profile.'); }
  }

  // --- Restored partialUpdate (profile) method ---
  async partialUpdate(userId: number, updateDto: UpdateEmployeeDto): Promise<Employee> {
    this.logger.debug(`Attempting partial update for employee profile user ID: ${userId}`);
    return this.update(userId, updateDto); // Reuse update logic
  }

  // --- Existing updateResumeFilename method ---
  async updateResumeFilename(userId: number, filename: string): Promise<void> {
      this.logger.log(`Updating resume filename for user ID: ${userId} to ${filename}`);
      const result = await this.employeeRepo.update( { userId }, { resumeFilename: filename, resumeFeedbackStatus: FeedbackStatus.NONE, resumeFeedback: null, resumeFeedbackTimestamp: null });
      if (result.affected === 0) {
          const userExists = await this.usersRepository.countBy({ id: userId });
          if (!userExists) { throw new NotFoundException(`User with ID ${userId} not found.`); }
          throw new NotFoundException(`Employee profile not found for user ID ${userId}. Cannot update resume filename.`);
      }
      this.logger.log(`Resume filename updated successfully for user ID: ${userId}, feedback status reset.`);
  }

  // --- Education CRUD ---
  async addEducation(userId: number, createEducationDto: CreateEducationDto): Promise<Education> {
    this.logger.log(`Adding education for user ID: ${userId}`);
    const employee = await this.employeeRepo.findOneBy({ userId });
    if (!employee) { throw new NotFoundException(`Employee profile not found for user ID ${userId}.`); }
    const newEducation = this.educationRepo.create({ ...createEducationDto, employeeId: employee.id, startDate: new Date(createEducationDto.startDate), endDate: createEducationDto.endDate ? new Date(createEducationDto.endDate) : null });
    try { return await this.educationRepo.save(newEducation); }
    catch (error) { throw new InternalServerErrorException('Could not save education record.'); }
  }

  async getEducation(userId: number): Promise<Education[]> {
    this.logger.log(`Fetching education history for user ID: ${userId}`);
    const employee = await this.employeeRepo.findOneBy({ userId });
    if (!employee) { throw new NotFoundException(`Employee profile not found for user ID ${userId}.`); }
    return this.educationRepo.find({ where: { employeeId: employee.id }, order: { startDate: 'DESC' } });
  }

  async updateEducation(userId: number, educationId: number, updateEducationDto: UpdateEducationDto): Promise<Education> {
    this.logger.log(`Updating education ID: ${educationId} for user ID: ${userId}`);
    const education = await this.educationRepo.findOne({ where: { id: educationId }, relations: ['employee'] });
    if (!education) { throw new NotFoundException(`Education record with ID ${educationId} not found.`); }
    if (education.employee?.userId !== userId) { throw new ForbiddenException('You are not authorized to update this education record.'); }
    // Prepare update data with date conversion
    const { startDate, endDate, ...restOfDto } = updateEducationDto;
    const updateData: Partial<Education> = { ...restOfDto };
    if (startDate !== undefined) { updateData.startDate = new Date(startDate); }
    if (endDate !== undefined) { updateData.endDate = endDate ? new Date(endDate) : null; }
    this.educationRepo.merge(education, updateData);
    try { return await this.educationRepo.save(education); }
    catch (error) { throw new InternalServerErrorException('Could not update education record.'); }
  }

  async deleteEducation(userId: number, educationId: number): Promise<void> {
    this.logger.log(`Deleting education ID: ${educationId} for user ID: ${userId}`);
     const education = await this.educationRepo.findOne({ where: { id: educationId }, relations: ['employee'] });
     if (!education) { throw new NotFoundException(`Education record with ID ${educationId} not found.`); }
    if (education.employee?.userId !== userId) { throw new ForbiddenException('You are not authorized to delete this education record.'); }
    const result = await this.educationRepo.delete(educationId);
    if (result.affected === 0) { throw new NotFoundException(`Education record with ID ${educationId} not found.`); }
    this.logger.log(`Education record ID ${educationId} deleted successfully.`);
  }

  // --- Project CRUD ---
  async addProject(userId: number, createProjectDto: CreateProjectDto): Promise<Project> {
    this.logger.log(`Adding project for user ID: ${userId}, Title: ${createProjectDto.title}`);
    const employee = await this.employeeRepo.findOneBy({ userId });
    if (!employee) { throw new NotFoundException(`Employee profile not found for user ID ${userId}.`); }
    const newProject = this.projectRepo.create({ ...createProjectDto, employeeId: employee.id, startDate: createProjectDto.startDate ? new Date(createProjectDto.startDate) : null, endDate: createProjectDto.endDate ? new Date(createProjectDto.endDate) : null });
    try { return await this.projectRepo.save(newProject); }
    catch (error) { throw new InternalServerErrorException('Could not save project.'); }
  }

  async getProjects(userId: number): Promise<Project[]> {
      this.logger.log(`Fetching projects for user ID: ${userId}`);
      const employee = await this.employeeRepo.findOneBy({ userId });
      if (!employee) { throw new NotFoundException(`Employee profile not found for user ID ${userId}.`); }
      return this.projectRepo.find({ where: { employeeId: employee.id }, order: { endDate: 'DESC', startDate: 'DESC' } });
  }

   async updateProject(userId: number, projectId: number, updateProjectDto: UpdateProjectDto): Promise<Project> {
        this.logger.log(`Updating project ID: ${projectId} for user ID: ${userId}`);
        const project = await this.projectRepo.findOne({ where: { id: projectId }, relations: ['employee'] });
        if (!project) { throw new NotFoundException(`Project with ID ${projectId} not found.`); }
        if (project.employee?.userId !== userId) { throw new ForbiddenException('You are not authorized to update this project.'); }
        // Prepare update data with date conversion
        const { startDate, endDate, ...restOfDto } = updateProjectDto;
        const updateData: Partial<Project> = { ...restOfDto };
        if (startDate !== undefined) { updateData.startDate = startDate ? new Date(startDate) : null; }
        if (endDate !== undefined) { updateData.endDate = endDate ? new Date(endDate) : null; }
        this.projectRepo.merge(project, updateData);
        try { return await this.projectRepo.save(project); }
        catch (error) { throw new InternalServerErrorException('Could not update project.'); }
    }

    async deleteProject(userId: number, projectId: number): Promise<void> {
        this.logger.log(`Deleting project ID: ${projectId} for user ID: ${userId}`);
        const project = await this.projectRepo.findOne({ where: { id: projectId }, relations: ['employee'] });
        if (!project) { throw new NotFoundException(`Project with ID ${projectId} not found.`); }
        if (project.employee?.userId !== userId) { throw new ForbiddenException('You are not authorized to delete this project.'); }
        const result = await this.projectRepo.delete(projectId);
        if (result.affected === 0) { throw new NotFoundException(`Project with ID ${projectId} not found.`); }
        this.logger.log(`Project ID ${projectId} deleted successfully.`);
    }

  // --- Restored extractResumeText method ---
  private async extractResumeText(filePath: string): Promise<string> {
    this.logger.log(`Extracting text from file: ${filePath}`);
    if (!existsSync(filePath)) { throw new NotFoundException('Resume file not found on server.'); }
    const extension = filePath.split('.').pop()?.toLowerCase();
    try {
        if (extension === 'pdf') { const data = await pdfParse(readFileSync(filePath)); return data.text; }
        else if (extension === 'docx') { const result = await mammoth.extractRawText({ path: filePath }); return result.value; }
        else if (extension === 'doc') {
             try { const result = await mammoth.extractRawText({ path: filePath }); return result.value; }
             catch (docError) { throw new InternalServerErrorException(`Unsupported or potentially corrupted .doc file.`); }
        } else { throw new InternalServerErrorException('Unsupported resume file type for feedback.'); }
    } catch (error) { throw new InternalServerErrorException(`Failed to read or parse the resume file.`); }
  }

  // --- Restored generateResumeFeedback method ---
  async generateResumeFeedback(userId: number): Promise<{ status: FeedbackStatus; feedback: string | null }> {
    this.logger.log(`Request received to generate resume feedback for user ID: ${userId}`);
    const employee = await this.employeeRepo.findOneBy({ userId });
    if (!employee) { throw new NotFoundException(`Employee profile not found for user ID ${userId}.`); }
    if (!employee.resumeFilename) { throw new HttpException('No resume uploaded.', HttpStatus.BAD_REQUEST); }
    employee.resumeFeedbackStatus = FeedbackStatus.PENDING; employee.resumeFeedback = 'Feedback generation in progress...'; employee.resumeFeedbackTimestamp = new Date();
    await this.employeeRepo.save(employee);
    const filePath = join(process.cwd(), 'uploads', 'resumes', employee.resumeFilename);
    let resumeText: string;
    try { resumeText = await this.extractResumeText(filePath); if (!resumeText || resumeText.trim().length < 50) { throw new Error('Could not extract meaningful content.'); } }
    catch (error) {
        employee.resumeFeedbackStatus = FeedbackStatus.FAILED; employee.resumeFeedback = `Failed to read or parse resume file: ${error.message}`; await this.employeeRepo.save(employee);
        if (error instanceof NotFoundException) throw error; throw new InternalServerErrorException(`Failed to read resume file: ${error.message}`);
    }
    try {
        const feedback = await this.aiFeedbackService.getResumeFeedback(resumeText);
        employee.resumeFeedbackStatus = FeedbackStatus.COMPLETED; employee.resumeFeedback = feedback; employee.resumeFeedbackTimestamp = new Date(); await this.employeeRepo.save(employee);
        return { status: FeedbackStatus.COMPLETED, feedback: feedback };
    } catch (error) {
        employee.resumeFeedbackStatus = FeedbackStatus.FAILED; employee.resumeFeedback = `AI feedback generation failed: ${error.message}`; await this.employeeRepo.save(employee);
        throw error;
    }
  }

  // --- Restored getResumeFeedback method ---
  async getResumeFeedback(userId: number): Promise<{ status: FeedbackStatus; feedback: string | null; timestamp: Date | null }> {
      this.logger.debug(`Fetching resume feedback status for user ID: ${userId}`);
      const employee = await this.employeeRepo.findOne({ where: { userId }, select: ['resumeFeedbackStatus', 'resumeFeedback', 'resumeFeedbackTimestamp'] });
      if (!employee) { throw new NotFoundException(`Employee profile not found for user ID ${userId}.`); }
      return { status: employee.resumeFeedbackStatus, feedback: employee.resumeFeedback, timestamp: employee.resumeFeedbackTimestamp };
  }

} // End Service Class