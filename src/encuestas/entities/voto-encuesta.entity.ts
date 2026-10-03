import { Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Encuesta } from './encuesta.entity';
import { Candidato } from '../../candidatos/entities/candidato.entity';
import { Local } from '../../mesas/entities/local.entity';

@Entity('votos_encuesta')
export class VotoEncuesta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Encuesta, (encuesta) => encuesta.votos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encuesta_id' })
  encuesta: Encuesta;

  @ManyToOne(() => Candidato, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'candidato_id' })
  candidato: Candidato; // Si es null, podría representar voto blanco/viciado dependiendo de la lógica

  @ManyToOne(() => Local, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'local_id' })
  local: Local;

  @CreateDateColumn()
  fechaVoto: Date;
}
