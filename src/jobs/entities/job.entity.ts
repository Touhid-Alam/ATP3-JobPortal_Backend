import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index, // Import Index
  } from 'typeorm';
  import { User } from '../../users/entities/user.entity'; // Assuming employer is a User
  import { JobApplication } from '../../job-applications/entities/job-application.entity'; // Import JobApplication
  
  @Entity('jobs')
  export class Job {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Index({ fulltext: true }) // Add index for full-text search on title
    @Column({ type: 'varchar', length: 255 })
    title: string;
  
    @Index({ fulltext: true }) // Add index for full-text search on description
    @Column({ type: 'text' })
    description: string;
  
    @Index() // Add index for location searches
    @Column({ type: 'varchar', length: 255 })
    location: string;
  
    // Store skills as an array of strings. Use appropriate DB type.
    // simple-array stores as comma-separated string. Consider 'jsonb' for better querying in Postgres.
    @Column('simple-array')
    skillsRequired: string[];
  
    @Column({ type: 'varchar', length: 255, nullable: true }) // e.g., "Tech Innovations Inc."
    companyName: string;
  
    @Column({ type: 'int', nullable: true })
    salaryMin: number | null;
  
    @Column({ type: 'int', nullable: true })
    salaryMax: number | null;
  
    @CreateDateColumn()
    postedDate: Date;
  
    // --- Relationship to Employer (User) ---
    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' }) // Job must have an employer
    @JoinColumn({ name: 'employerId' })
    employer: User;
  
    @Index() // Index the foreign key
    @Column()
    employerId: number; // Foreign key storing the User's ID (Employer)
    // --- End Relationship ---
  
    // --- Relationship to Job Applications ---
    @OneToMany(() => JobApplication, (application) => application.job)
    applications: JobApplication[];
    // --- End Relationship ---
  }