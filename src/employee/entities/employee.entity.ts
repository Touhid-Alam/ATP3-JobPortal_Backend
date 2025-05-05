import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Education } from './education.entity';
import { Project } from './project.entity'; // Import Project entity

export enum FeedbackStatus { NONE = 'none', PENDING = 'pending', COMPLETED = 'completed', FAILED = 'failed' }

@Entity('employee')
export class Employee {
  // --- Existing fields ---
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true, type: 'text' }) bio: string;
  @Column('simple-array', { nullable: true }) skills: string[];
  @Column({ type: 'int', default: 0 }) yearsOfExperience: number;
  @OneToOne(() => User, user => user.employeeProfile, { nullable: false, onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @Column() userId: number;
  @Column({ nullable: true, type: 'varchar', length: 255 }) resumeFilename: string | null;
  @OneToMany(() => Education, (education) => education.employee, { cascade: true }) educationHistory: Education[];
  @Column({ type: 'enum', enum: FeedbackStatus, default: FeedbackStatus.NONE }) resumeFeedbackStatus: FeedbackStatus;
  @Column({ type: 'text', nullable: true }) resumeFeedback: string | null;
  @Column({ type: 'timestamp', nullable: true }) resumeFeedbackTimestamp: Date | null;
  // --- End Existing Fields ---

  // --- Relation to Projects ---
  @OneToMany(() => Project, (project) => project.employee, {
      cascade: true, // Allow saving employee to cascade save projects
  })
  projects: Project[]; // Property to access the projects
  // --- End Relation to Projects ---
}