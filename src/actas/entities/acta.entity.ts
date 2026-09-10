import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Mesa } from '../../mesas/entities/mesa.entity';
import { User } from '../../users/entities/user.entity';
import { Voto } from './voto.entity';
import { FotoActa } from './foto-acta.entity';

@Entity('actas')
export class Acta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => FotoActa, foto => foto.acta, { cascade: true })
  fotos: FotoActa[];

  @Column({ type: 'int', default: 0 })
  ciudadanos_votaron: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'enum', enum: ['PENDIENTE', 'OBSERVADO', 'AUDITADO', 'ANULADO'], default: 'PENDIENTE' })
  estado: string;

  @ManyToOne(() => Mesa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mesa_id' })
  mesa: Mesa;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'personero_id' })
  personero: User | null;

  @OneToMany(() => Voto, (voto) => voto.acta, { cascade: true })
  votos: Voto[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
