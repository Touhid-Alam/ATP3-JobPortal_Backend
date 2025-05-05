import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  UpdateDateColumn, // Added
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Job } from '../../jobs/entities/job.entity';

// Added INTERESTED status
export enum ApplicationStatus {
    APPLIED = 'applied',
    VIEWED = 'viewed',
    CONTACTED = 'shortlisted',
    INTERESTED = 'interested', // For Quick Apply/Express Interest
}

@Entity('job_applications')
@Unique(['employeeId', 'jobId'])
export class JobApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  applicationDate: Date;

  @UpdateDateColumn() // Track last update
  lastUpdated: Date;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.APPLIED, // Default for full application
  })
  status: ApplicationStatus;

  // --- Relationship to Employee (User) ---
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: User;

  @Index()
  @Column()
  employeeId: number;
  // --- End Relationship ---

  // --- Relationship to Job ---
  @ManyToOne(() => Job, (job) => job.applications, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Index()
  @Column()
  jobId: number;
  // --- End Relationship ---

  // --- Employee Notes Field ---
  @Column({ type: 'text', nullable: true })
  employeeNotes: string | null; // Notes added by the employee
  // --- End Notes Field ---
}