import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, Raw, In, Not, FindManyOptions } from 'typeorm';
import { Job } from './entities/job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { User } from '../users/entities/user.entity';
import { JobSearchQueryDto } from './dto/job-search-query.dto';
import { JobApplication } from '../job-applications/entities/job-application.entity';
import { JobDetailsDto } from './dto/job-details.dto';
import { Employee } from '../employee/entities/employee.entity';

export interface JobRecommendation extends Job {
  matchScore: number;
}

@Injectable()
export class JobsService {
private readonly logger = new Logger(JobsService.name);

constructor(
  @InjectRepository(Job)
  private jobsRepository: Repository<Job>,
  @InjectRepository(JobApplication)
  private applicationRepository: Repository<JobApplication>,
  @InjectRepository(User)
  private usersRepository: Repository<User>,
  @InjectRepository(Employee)
  private employeeRepository: Repository<Employee>,
) {}

// --- create method ---
async create(employerId: number, createJobDto: CreateJobDto): Promise<Job> {
  this.logger.log(`Employer ID ${employerId} creating job: ${createJobDto.title}`);
  const employerExists = await this.usersRepository.count({where: {id: employerId, role: 'employer'}});
  if(employerExists === 0) { throw new NotFoundException(`Employer with ID ${employerId} not found.`); }
  const job = this.jobsRepository.create({ ...createJobDto, employerId: employerId });
  try {
      const savedJob = await this.jobsRepository.save(job);
      this.logger.log(`Job ID ${savedJob.id} created successfully by employer ID ${employerId}`);
      const jobWithEmployer = await this.jobsRepository.findOne({where: {id: savedJob.id}, relations: ['employer']});
      if (jobWithEmployer?.employer) delete (jobWithEmployer.employer as any).password;
      return jobWithEmployer ?? savedJob;
  } catch (error) { throw new InternalServerErrorException('Could not create job.'); }
}

// --- Original findAll method (Implicit AND logic) ---
async findAll(query: JobSearchQueryDto): Promise<Job[]> {
  this.logger.log(`Finding all jobs (AND logic) with query: ${JSON.stringify(query)}`);
  const conditions: FindOptionsWhere<Job> = {}; // Single object for AND

  if (query.title) { conditions.title = ILike(`%${query.title}%`); }
  if (query.location) { conditions.location = ILike(`%${query.location}%`); }
  if (query.skills && query.skills.length > 0) {
     // This part needs refinement for AND logic with simple-array
     // Option 1: Multiple Raw conditions (complex)
     // Option 2: Fetch more and filter in code (less efficient)
     // Option 3 (Best for AND): Use jsonb or text[] with && operator in DB
     // For now, let's keep the OR logic for skills within this AND structure
     conditions.skillsRequired = Raw(alias =>
        query.skills!.map((skill, index) => `${alias} LIKE :skill${index}`).join(' OR '), // Still OR for multiple skills provided
        Object.fromEntries(query.skills!.map((skill, index) => [`skill${index}`, `%${skill}%`]))
    );
    // To make skills AND: use multiple Raw or change DB structure
    // Example (conceptual, might need adjustment):
    // conditions.skillsRequired = Raw(alias =>
    //    query.skills!.map((skill, index) => `(${alias} LIKE :skillStart${index} OR ${alias} LIKE :skillMid${index} OR ${alias} LIKE :skillEnd${index} OR ${alias} = :skillExact${index})`).join(' AND '),
    //    query.skills!.reduce((params, skill, index) => ({
    //        ...params,
    //        [`skillStart${index}`]: `${skill},%`,
    //        [`skillMid${index}`]: `%,${skill},%`,
    //        [`skillEnd${index}`]: `%,${skill}`,
    //        [`skillExact${index}`]: skill,
    //    }), {})
    // );
  }

  const jobs = await this.jobsRepository.find({
      where: conditions, // Single object implies AND between title, location, skills block
      relations: ['employer'],
      order: { postedDate: 'DESC' },
  });
  jobs.forEach(job => { if (job.employer) delete (job.employer as any).password; });
  return jobs;
}
// --- End Original findAll ---


// --- NEW findByTitleOrSkills method (Explicit OR logic) ---
async findByTitleOrSkills(query: JobSearchQueryDto): Promise<Job[]> {
  this.logger.log(`Finding jobs (OR logic) with query: ${JSON.stringify(query)}`);
  const findOptions: FindManyOptions<Job> = {
      relations: ['employer'],
      order: { postedDate: 'DESC' },
  };
  const whereConditions: FindOptionsWhere<Job>[] = []; // Array for OR

  // Title Condition Block
  if (query.title) {
      const titleCondition: FindOptionsWhere<Job> = { title: ILike(`%${query.title}%`) };
      if (query.location) { titleCondition.location = ILike(`%${query.location}%`); } // AND location within this block
      whereConditions.push(titleCondition);
  }

  // Skills Condition Block
  if (query.skills && query.skills.length > 0) {
      const skillsCondition: FindOptionsWhere<Job> = {
           skillsRequired: Raw(alias =>
              query.skills!.map((skill, index) => `${alias} LIKE :skill${index}`).join(' OR '),
              Object.fromEntries(query.skills!.map((skill, index) => [`skill${index}`, `%${skill}%`]))
          )
      };
      if (query.location) { skillsCondition.location = ILike(`%${query.location}%`); } // AND location within this block
      // Avoid adding duplicate skill block if title block already covers it (edge case if title also matches skill)
      // This simple OR doesn't de-duplicate automatically if both title and skill match the same job based on different criteria blocks
      whereConditions.push(skillsCondition);
  }

   // Location Only Condition (if ONLY location is provided)
  if (query.location && !query.title && (!query.skills || query.skills.length === 0)) {
       const locationCondition: FindOptionsWhere<Job> = { location: ILike(`%${query.location}%`) };
       whereConditions.push(locationCondition);
  }

  // Apply WHERE conditions if any criteria were provided
  if (whereConditions.length > 0) {
      findOptions.where = whereConditions; // Array means OR between blocks
  } else {
      // No criteria for title/skill/location OR search? Return empty or all? Let's return empty for this specific endpoint.
      this.logger.log('No title or skills provided for OR search.');
      return [];
      // If you wanted all jobs if no criteria: delete the line above and don't set findOptions.where
  }

  this.logger.debug(`Executing findByTitleOrSkills with options: ${JSON.stringify(findOptions)}`);
  const jobs = await this.jobsRepository.find(findOptions);
  jobs.forEach(job => { if (job.employer) delete (job.employer as any).password; });
  this.logger.log(`Found ${jobs.length} jobs matching OR criteria.`);
  return jobs;
}
// --- End NEW findByTitleOrSkills ---


// --- findOne method ---
async findOne(id: number): Promise<JobDetailsDto> {
  this.logger.debug(`Finding job details for ID: ${id}`);
  const job = await this.jobsRepository.findOne({ where: { id }, relations: ['employer'] });
  if (!job) { throw new NotFoundException(`Job with ID ${id} not found`); }
  const applicationCount = await this.applicationRepository.count({ where: { jobId: id } });
  return JobDetailsDto.fromJob(job, applicationCount);
}

// --- update method ---
async update(id: number, employerId: number, updateJobDto: UpdateJobDto): Promise<Job> {
  this.logger.log(`Employer ID ${employerId} updating job ID: ${id}`);
  const existingJob = await this.jobsRepository.findOne({ where: { id }, relations: ['employer'] });
  if (!existingJob) { throw new NotFoundException(`Job with ID ${id} not found`); }
  if (existingJob.employerId !== employerId) { throw new ForbiddenException('You are not authorized to update this job posting.'); }
  const jobToUpdate = await this.jobsRepository.preload({ id: id, ...updateJobDto });
  if (!jobToUpdate) { throw new NotFoundException(`Job with ID ${id} not found during update preparation.`); }
  try {
      const updatedJob = await this.jobsRepository.save(jobToUpdate);
      this.logger.log(`Job ID ${id} updated successfully by employer ID ${employerId}`);
      if (updatedJob.employer) { delete (updatedJob.employer as any).password; }
      if (!updatedJob.employer && updatedJob.employerId) {
           const employer = await this.usersRepository.findOneBy({ id: updatedJob.employerId });
           if (employer) { delete (employer as any).password; updatedJob.employer = employer; }
       }
      return updatedJob;
  } catch (error) { throw new InternalServerErrorException('Could not update job.'); }
}

// --- remove method ---
async remove(id: number, employerId: number): Promise<void> {
   this.logger.log(`Employer ID ${employerId} deleting job ID: ${id}`);
   const job = await this.jobsRepository.findOne({ where: { id }, select: ['employerId'] });
   if (!job) { throw new NotFoundException(`Job with ID ${id} not found`); }
   if (job.employerId !== employerId) { throw new ForbiddenException('You are not authorized to delete this job posting.'); }
   const result = await this.jobsRepository.delete(id);
   if (result.affected === 0) { throw new NotFoundException(`Job with ID ${id} could not be deleted.`); }
   this.logger.log(`Job ID ${id} deleted successfully by employer ID ${employerId}`);
}

// --- findJobsByEmployer method ---
async findJobsByEmployer(employerId: number): Promise<Job[]> {
    this.logger.log(`Fetching jobs posted by employer ID: ${employerId}`);
    const jobs = await this.jobsRepository.find({ where: { employerId: employerId }, order: { postedDate: 'DESC' } });
    this.logger.log(`Found ${jobs.length} jobs for employer ID: ${employerId}`);
    return jobs;
}

// --- getRecommendations method ---
async getRecommendations(employeeUserId: number, limit: number = 10): Promise<JobRecommendation[]> {
    this.logger.log(`Generating SKILL-BASED job recommendations for employee user ID: ${employeeUserId}`);
    const employeeProfile = await this.employeeRepository.findOne({ where: { userId: employeeUserId }, select: ['id', 'skills', 'userId'] });
    if (!employeeProfile || !employeeProfile.skills || employeeProfile.skills.length === 0) { return []; }
    const employeeSkillsSet = new Set(employeeProfile.skills.map(s => s.trim().toLowerCase()));
    if (employeeSkillsSet.size === 0) { return []; }
    const appliedOrInterestedApps = await this.applicationRepository.find({ where: { employeeId: employeeUserId }, select: ['jobId'] });
    const excludedJobIds = appliedOrInterestedApps.map(app => app.jobId);
    const candidateJobs = await this.jobsRepository.find({
        where: excludedJobIds.length > 0 ? { id: Not(In(excludedJobIds)) } : {},
        relations: ["employer"], order: { postedDate: 'DESC' }, take: 500,
        select: { id: true, title: true, location: true, companyName: true, skillsRequired: true, postedDate: true, employerId: true, employer: { id: true, name: true } }
    });
    const recommendations: JobRecommendation[] = [];
    for (const job of candidateJobs) {
        let matchCount = 0;
        if (job.skillsRequired?.length > 0) { job.skillsRequired.forEach(jobSkill => { if (employeeSkillsSet.has(jobSkill.trim().toLowerCase())) { matchCount++; } }); }
        if (matchCount > 0) { if (job.employer) delete (job.employer as any).password; recommendations.push({ ...job, matchScore: matchCount }); }
    }
    recommendations.sort((a, b) => { if (b.matchScore !== a.matchScore) { return b.matchScore - a.matchScore; } return b.postedDate.getTime() - a.postedDate.getTime(); });
    const finalRecommendations = recommendations.slice(0, limit);
    this.logger.log(`Generated ${finalRecommendations.length} skill-based recommendations (limit ${limit}) for employee user ID ${employeeUserId}`);
    return finalRecommendations;
}

} // End Service Class