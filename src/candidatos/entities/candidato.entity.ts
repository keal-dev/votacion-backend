import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Partido } from '../../partidos/entities/partido.entity';
import { Election } from '../../elections/entities/election.entity';
import { CargoCandidato } from '../enums/cargo.enum';

@Entity('candidatos')
export class Candidato {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  nombre: string;

  @Column({ length: 150 })
  apellidos: string;

  @Column({ length: 8 })
  dni: string;

  @Column({ type: 'enum', enum: CargoCandidato })
  cargo: CargoCandidato;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provincia: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  distrito: string | null;

  @Column({ type: 'text', nullable: true })
  foto_url: string | null;

  @ManyToOne(() => Partido, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partido_id' })
  partido: Partido;

  @ManyToOne(() => Election, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'election_id' })
  election: Election;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
