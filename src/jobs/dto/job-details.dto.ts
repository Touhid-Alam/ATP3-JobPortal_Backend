import { Job } from '../entities/job.entity';
import { User } from '../../users/entities/user.entity';

// DTO for public employer information to avoid exposing sensitive User fields
class EmployerInfoDto {
    id: number;
    name: string;
    // Add other fields like company profile URL if available later
}

// DTO for the response when fetching detailed job information, including insights
export class JobDetailsDto {
    id: number;
    title: string;
    description: string;
    location: string;
    skillsRequired: string[];
    companyName: string;
    salaryMin: number | null;
    salaryMax: number | null;
    postedDate: Date;
    employerId: number;
    employer: EmployerInfoDto; // Use the nested DTO
    applicationCount: number; // Application count insight

    /**
     * Static factory method to create a JobDetailsDto from a Job entity and application count.
     * Ensures sensitive data (like employer password) is not included.
     * @param job - The Job entity fetched from the database (should include 'employer' relation).
     * @param applicationCount - The number of applications for this job.
     * @returns A new JobDetailsDto instance.
     */
    static fromJob(job: Job, applicationCount: number): JobDetailsDto {
        const dto = new JobDetailsDto();

        // Assign job properties
        dto.id = job.id;
        dto.title = job.title;
        dto.description = job.description;
        dto.location = job.location;
        dto.skillsRequired = job.skillsRequired;
        dto.companyName = job.companyName;
        dto.salaryMin = job.salaryMin;
        dto.salaryMax = job.salaryMax;
        dto.postedDate = job.postedDate;
        dto.employerId = job.employerId;

        // Assign application count insight
        dto.applicationCount = applicationCount;

        // Map employer info safely
        if (job.employer) {
            dto.employer = {
                id: job.employer.id,
                name: job.employer.name,
            };
        } else {
            // Fallback if employer relation wasn't loaded (shouldn't happen with current service logic)
            dto.employer = { id: job.employerId, name: 'Information Unavailable' };
        }

        return dto;
    }
}