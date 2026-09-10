import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('asistencias')
export class Asistencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.asistencias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  latitud_llegada: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  longitud_llegada: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_llegada: Date;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitud_salida: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitud_salida: number;

  @Column({ type: 'timestamp', nullable: true })
  fecha_salida: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
