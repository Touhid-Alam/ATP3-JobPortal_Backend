import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity'; // Import Employee entity
// Remove this line: import { Education } from './education.entity'; // <<< REMOVE THIS SELF-IMPORT

@Entity('education') // Table name
export class Education { // <<< ADD 'export' HERE
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  institution: string;

  @Column({ type: 'varchar', length: 255 })
  degree: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fieldOfStudy: string | null;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // --- Relationship to Employee ---
  // TypeORM can usually infer the type here once exports are fixed
  @ManyToOne(() => Employee, (employee) => employee.educationHistory, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column()
  employeeId: number;
  // --- End Relationship ---
}