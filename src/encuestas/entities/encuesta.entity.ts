import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { VotoEncuesta } from './voto-encuesta.entity';
import { CargoCandidato } from '../../candidatos/enums/cargo.enum';

@Entity('encuestas')
export class Encuesta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  nombre: string;

  @Column({ length: 50, unique: true })
  codigoAcceso: string;

  @Column({ type: 'int', default: 50 })
  cuotaMax: number;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @Column({ type: 'enum', enum: CargoCandidato, default: CargoCandidato.DISTRITAL })
  cargo: CargoCandidato;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provincia: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  distrito: string | null;

  @OneToMany(() => VotoEncuesta, (voto) => voto.encuesta)
  votos: VotoEncuesta[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
