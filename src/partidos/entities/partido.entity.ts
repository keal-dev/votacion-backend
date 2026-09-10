import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Election } from '../../elections/entities/election.entity';

@Entity('partidos')
export class Partido {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  nombre: string;

  @Column({ length: 20 })
  siglas: string;

  @Column({ type: 'text', nullable: true })
  logo_url: string | null;

  @ManyToOne(() => Election)
  @JoinColumn({ name: 'election_id' })
  election: Election;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
