import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne, // Import ManyToOne for the relationship
  CreateDateColumn,
  JoinColumn, // Import JoinColumn for explicit column naming (optional but good practice)
  Index, // Import Index for potential performance improvement
} from 'typeorm';
import { User } from '../../users/entities/user.entity'; // Import the User entity

@Entity('reset_tokens') // Explicit table name
@Index(['token'], { unique: true }) // Ensure tokens are unique via DB index
export class ResetToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 6, unique: true }) // Store the 6-digit code (or longer if using UUIDs)
  token: string;

  // Define the many-to-one relationship with the User entity
  // Many reset tokens can belong to one user (though typically only one active)
  @ManyToOne(() => User, (user) => user.id, { // Link to User entity
      nullable: false, // A token must belong to a user
      onDelete: 'CASCADE', // If the user is deleted, delete their associated reset tokens
      eager: false // Don't automatically load the user unless specified (use relations option in find)
  })
  @JoinColumn({ name: 'userId' }) // Explicitly define the foreign key column name
  user: User;

  // Store the user ID directly as well for easier querying without joins sometimes
  @Column()
  userId: number; // Foreign key column

  @Column({ type: 'timestamp' }) // Store the expiration date and time
  expiresAt: Date;

  @CreateDateColumn() // Automatically record when the token was created
  createdAt: Date;
}