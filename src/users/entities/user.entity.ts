import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Role } from '../../auth/enums/role.enum';
import { Election } from '../../elections/entities/election.entity';
import { Mesa } from '../../mesas/entities/mesa.entity';
import { Asistencia } from '../../asistencias/entities/asistencia.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  lastname: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ unique: true, length: 8 })
  dni: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: Role, nullable: true })
  role: Role | null;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ type: 'text', nullable: true })
  publicId: string | null;

  @ManyToOne(() => Election, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'election_id' })
  election: Election | null;

  @OneToMany(() => Mesa, (mesa) => mesa.personero)
  mesas: Mesa[];

  @OneToMany(() => Asistencia, (asistencia) => asistencia.user)
  asistencias: Asistencia[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
