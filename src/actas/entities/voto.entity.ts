import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Acta } from './acta.entity';
import { Candidato } from '../../candidatos/entities/candidato.entity';
import { CargoCandidato } from '../../candidatos/enums/cargo.enum';

export enum TipoVoto {
  CANDIDATO = 'CANDIDATO',
  BLANCO = 'BLANCO',
  NULO = 'NULO',
  IMPUGNADO = 'IMPUGNADO',
}

@Entity('votos')
export class Voto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Acta, (acta) => acta.votos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'acta_id' })
  acta: Acta;

  @Column({ type: 'enum', enum: TipoVoto })
  tipo: TipoVoto;

  @Column({ type: 'enum', enum: CargoCandidato })
  nivel: CargoCandidato;

  @ManyToOne(() => Candidato, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidato_id' })
  candidato: Candidato | null;

  @Column({ type: 'int', default: 0 })
  cantidad: number;
}
