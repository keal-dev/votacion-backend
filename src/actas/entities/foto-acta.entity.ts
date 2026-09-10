import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Acta } from './acta.entity';

@Entity('foto_actas')
export class FotoActa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  url: string;

  @ManyToOne(() => Acta, acta => acta.fotos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'acta_id' })
  acta: Acta;

  @CreateDateColumn()
  createdAt: Date;
}
