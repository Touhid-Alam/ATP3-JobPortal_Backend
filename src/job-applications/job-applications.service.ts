import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobApplication, ApplicationStatus } from './entities/job-application.entity';
import { JobsService } from '../jobs/jobs.service';
import { User } from '../users/entities/user.entity';
import { Job } from '../jobs/entities/job.entity';
import { MailerService } from '../mailer/mailer.service'; // <<< IMPORT MailerService

@Injectable()
export class JobApplicationsService {
    private readonly logger = new Logger(JobApplicationsService.name);

    constructor(
        @InjectRepository(JobApplication)
        private applicationRepository: Repository<JobApplication>,
        private readonly jobsService: JobsService,
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        private readonly mailerService: MailerService, // <<< INJECT MailerService
    ) {}

    // --- Apply Method ---
    async apply(employeeId: number, jobId: number): Promise<JobApplication> {
        this.logger.log(`Employee ID ${employeeId} applying for job ID ${jobId}`);
        await this.jobsService.findOne(jobId); // Check job exists, findOne now returns DTO but still throws if not found
        const existingApplication = await this.applicationRepository.findOne({ where: { employeeId, jobId } });
        if (existingApplication) {
            if (existingApplication.status === ApplicationStatus.INTERESTED) { throw new ConflictException('You have already expressed interest in this job.'); }
            this.logger.warn(`Employee ID ${employeeId} already applied to job ID ${jobId}`);
            throw new ConflictException('You have already applied for this job.');
        }
        const newApplication = this.applicationRepository.create({ employeeId, jobId, status: ApplicationStatus.APPLIED, employeeNotes: null });
        try {
            const savedApp = await this.applicationRepository.save(newApplication);
            this.logger.log(`Application ID ${savedApp.id} created successfully for employee ${employeeId}, job ${jobId}`);
            return savedApp;
        } catch (error) { /* Keep error handling */ throw new InternalServerErrorException('Could not submit application.');}
    }

    // --- Express Interest Method ---
    async expressInterest(employeeId: number, jobId: number): Promise<JobApplication> {
        this.logger.log(`Employee ID ${employeeId} expressing interest in job ID ${jobId}`);
        await this.jobsService.findOne(jobId); // Check job exists
        const existingApplication = await this.applicationRepository.findOne({ where: { employeeId, jobId } });
        if (existingApplication) { throw new ConflictException(`You have already ${existingApplication.status === ApplicationStatus.INTERESTED ? 'expressed interest in' : 'applied for'} this job.`); }
        const newInterest = this.applicationRepository.create({ employeeId, jobId, status: ApplicationStatus.INTERESTED, employeeNotes: null });
        try {
            const savedInterest = await this.applicationRepository.save(newInterest);
            this.logger.log(`Interest ID ${savedInterest.id} created successfully for employee ${employeeId}, job ${jobId}`);
            return savedInterest;
        } catch (error) { /* Keep error handling */ throw new InternalServerErrorException('Could not express interest.'); }
    }

    // --- Find By Employee Method ---
    async findByEmployee(employeeId: number): Promise<JobApplication[]> {
        this.logger.log(`Finding applications for employee ID ${employeeId}`);
        const applications = await this.applicationRepository.find({
            where: { employeeId },
            relations: ['job', 'job.employer'],
            select: { id: true, applicationDate: true, lastUpdated: true, status: true, employeeNotes: true, jobId: true, employeeId: true, job: { id: true, title: true, location: true, companyName: true, postedDate: true, employer: { id: true, name: true } } },
            order: { applicationDate: 'DESC' },
        });
        this.logger.log(`Found ${applications.length} applications for employee ID ${employeeId}`);
        return applications;
    }

    // --- Find By Job Method ---
    async findByJob(jobId: number, employerId: number): Promise<JobApplication[]> {
        this.logger.log(`Employer ID ${employerId} finding applications for job ID ${jobId}`);
        const jobDto = await this.jobsService.findOne(jobId); // Check job exists via findOne which returns DTO
        if (jobDto.employerId !== employerId) { throw new ForbiddenException('You are not authorized to view applications for this job.'); }
        const applications = await this.applicationRepository.find({
            where: { jobId }, relations: ['employee'],
            select: { id: true, applicationDate: true, lastUpdated: true, status: true, employeeNotes: false, // Exclude notes
                jobId: true, employeeId: true, employee: { id: true, name: true, email: true, /* Ensure password not selected in User entity or repo! */ } },
            order: { applicationDate: 'ASC' },
        });
        this.logger.log(`Found ${applications.length} applications for job ID ${jobId}`);
        return applications;
    }

    // --- Find One Application Method ---
    async findOne(applicationId: number, userId: number, userRole: string): Promise<JobApplication> {
        this.logger.debug(`User ID ${userId} (Role: ${userRole}) finding application ID ${applicationId}`);
        const application = await this.applicationRepository.findOne({ where: { id: applicationId }, relations: ['employee', 'job', 'job.employer'] });
        if (!application) { throw new NotFoundException(`Application with ID ${applicationId} not found.`); }
        const isApplicant = userRole === 'employee' && application.employeeId === userId;
        const isJobOwner = userRole === 'employer' && application.job?.employerId === userId;
        if (!isApplicant && !isJobOwner) { throw new ForbiddenException('You are not authorized to view this application.'); }
        if (application.employee) delete (application.employee as any).password;
        if (application.job?.employer) delete (application.job.employer as any).password;
        if (userRole === 'employer') { delete (application as any).employeeNotes; }
        return application;
    }

    // --- Update Employee Notes Method ---
    async updateEmployeeNotes(applicationId: number, employeeId: number, notes: string | null): Promise<JobApplication> {
        this.logger.log(`Employee ID ${employeeId} updating notes for application ID ${applicationId}`);
        const application = await this.applicationRepository.findOne({ where: { id: applicationId, employeeId: employeeId } });
        if (!application) {
            const exists = await this.applicationRepository.count({ where: { id: applicationId } });
            if (exists > 0) { throw new ForbiddenException('You can only update notes on your own applications.'); }
            else { throw new NotFoundException(`Application with ID ${applicationId} not found.`); }
        }
        application.employeeNotes = notes;
        try {
            const updatedApp = await this.applicationRepository.save(application);
            this.logger.log(`Notes updated for application ID ${applicationId}`);
            // Reload with relations to return consistent data
            return await this.findOne(updatedApp.id, employeeId, 'employee');
        } catch (error) {
            this.logger.error(`Failed to update notes for application ID ${applicationId}: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Could not update application notes.');
        }
    }

    // --- Modified Update Status Method ---
    async updateStatus(applicationId: number, employerId: number, newStatus: ApplicationStatus): Promise<JobApplication> {
        this.logger.log(`Employer ID ${employerId} attempting to update status for application ID ${applicationId} to ${newStatus}`);

        // Fetch application including necessary relations for verification and notification
        const application = await this.applicationRepository.findOne({
            where: { id: applicationId },
            relations: ['job', 'employee'], // Need employee for email, job for owner check
        });

        if (!application) {
            this.logger.warn(`Application ID ${applicationId} not found for status update.`);
            throw new NotFoundException(`Application with ID ${applicationId} not found.`);
        }
        if (!application.job || !application.employee) {
             this.logger.error(`Application ${applicationId} is missing job or employee relation.`);
             throw new InternalServerErrorException('Application data integrity error. Cannot update status.');
        }

        // Verify employer owns the job associated with the application
        if (application.job.employerId !== employerId) {
             this.logger.error(`Employer ID ${employerId} forbidden to update status for application ID ${applicationId}`);
             throw new ForbiddenException('You are not authorized to update the status for this application.');
        }

        // Proceed only if the status is actually changing
        if(application.status === newStatus) {
            this.logger.log(`Status for application ${applicationId} is already ${newStatus}. No action taken.`);
            return application;
        }

        // Update the status
        application.status = newStatus;

        try {
            const updatedApp = await this.applicationRepository.save(application);
            this.logger.log(`Application ID ${applicationId} status updated to ${newStatus} by employer ${employerId}`);

            // --- Send Email Notification ---
            if (newStatus === ApplicationStatus.CONTACTED && application.employee?.email) {
                this.logger.log(`Status is CONTACTED, attempting email notification to ${application.employee.email}`);
                const mailOptions = {
                    to: application.employee.email,
                    subject: `Update on your application for "${application.job.title}"`,
                    text: `Hello ${application.employee.name},\n\nThere's an update regarding your application for the "${application.job.title}" position at ${application.job.companyName || 'the company'}.\n\nThe employer has indicated they may wish to contact you soon regarding the next steps. Please monitor your email and check the job portal for any messages.\n\nRegards,\nThe Job Portal Team`,
                    html: `<p>Hello ${application.employee.name},</p>
                           <p>There's an update regarding your application for the "<strong>${application.job.title}</strong>" position at <strong>${application.job.companyName || 'the company'}</strong>.</p>
                           <p>The employer has indicated they may wish to contact you soon regarding the next steps. Please monitor your email and check the job portal for any messages.</p>
                           <p>Regards,<br/>The Job Portal Team</p>`,
                };
                // Send email asynchronously, log errors but don't fail the main request
                this.mailerService.sendMail(mailOptions).catch(err => {
                    this.logger.error(`Failed to send CONTACTED status update email to ${application.employee.email} for application ${applicationId}: ${err.message}`, err.stack);
                });
            }
            // --- End Send Email ---

            // Return updated application (reload might be needed if save doesn't return relations)
            // We already have the needed relations loaded here.
            if (updatedApp.employee) delete (updatedApp.employee as any).password; // Clean data
            if (updatedApp.job?.employer) delete (updatedApp.job.employer as any).password; // Clean data

            return updatedApp;

        } catch (error) {
             this.logger.error(`Failed to save updated status for application ID ${applicationId}: ${error.message}`, error.stack);
             throw new InternalServerErrorException('Could not update application status.');
        }
    }
    // --- End Modified Update Status Method ---

} // End Service Class