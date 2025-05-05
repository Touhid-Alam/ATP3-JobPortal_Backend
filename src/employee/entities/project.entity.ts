import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
  import { Employee } from './employee.entity';
  
  @Entity('projects') // Table name for employee projects
  export class Project {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ type: 'varchar', length: 255 })
    title: string;
  
    @Column({ type: 'text' })
    description: string;
  
    // Store technologies as simple comma-separated string or use jsonb in Postgres
    @Column('simple-array', { nullable: true })
    technologiesUsed: string[] | null;
  
    @Column({ type: 'date', nullable: true })
    startDate: Date | null;
  
    @Column({ type: 'date', nullable: true })
    endDate: Date | null; // Null if ongoing
  
    @Column({ type: 'varchar', length: 500, nullable: true }) // URL for live demo/project
    projectUrl: string | null;
  
    @Column({ type: 'varchar', length: 500, nullable: true }) // URL for code repository
    repositoryUrl: string | null;
  
    // --- Relationship to Employee ---
    @ManyToOne(() => Employee, (employee) => employee.projects, {
      nullable: false,
      onDelete: 'CASCADE', // Delete project if employee profile is deleted
    })
    @JoinColumn({ name: 'employeeId' })
    employee: Employee;
  
    @Column()
    employeeId: number; // Foreign key to Employee profile ID
    // --- End Relationship ---
  }