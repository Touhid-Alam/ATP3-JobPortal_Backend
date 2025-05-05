import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToOne
} from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';

// Define possible user account statuses
export enum UserStatus {
    PENDING_EMAIL_VERIFICATION = 'pending_email_verification',
    PENDING_ADMIN_APPROVAL = 'pending_admin_approval',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  // Allow password to be NULL initially for email verification flow
  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ type: 'enum', enum: ['employee', 'employer', 'admin'], nullable: false })
  role: 'employee' | 'employer' | 'admin';

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  // Store 6-digit code (as string), ensure length, nullable
  @Column({ type: 'varchar', length: 6, nullable: true, unique: false })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date | null;

  // --- NEW: Password Changed Timestamp ---
  @Column({ type: 'timestamp', nullable: true, default: null })
  passwordChangedAt: Date | null;
  // --- End NEW Field ---

  // Employer specific fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  companyWebsite: string | null;

  // Relations
  @OneToOne(() => Employee, employee => employee.user, { nullable: true, cascade: ['insert', 'update'] })
  employeeProfile: Employee;
}