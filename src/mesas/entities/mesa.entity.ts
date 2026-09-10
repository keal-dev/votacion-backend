import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Local } from './local.entity';
import { Election } from '../../elections/entities/election.entity';
import { User } from '../../users/entities/user.entity';
import { Acta } from '../../actas/entities/acta.entity';

export enum EstadoMesa {
  PENDIENTE = 'PENDIENTE',
  ENVIADA = 'ENVIADA',
}

@Entity('mesas')
export class Mesa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  numero_mesa: string;

  @Column({ type: 'int', default: 0 })
  cantidad_electores: number;

  @ManyToOne(() => Local, (local) => local.mesas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'local_id' })
  local: Local;

  @ManyToOne(() => Election, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'election_id' })
  election: Election;

  @ManyToOne(() => User, (user) => user.mesas, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'personero_id' })
  personero: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Acta, acta => acta.mesa)
  actas: Acta[];

  @Column({
    type: 'enum',
    enum: EstadoMesa,
    default: EstadoMesa.PENDIENTE
  })
  estado: EstadoMesa;
}
