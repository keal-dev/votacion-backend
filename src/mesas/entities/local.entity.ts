import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Mesa } from './mesa.entity';

@Entity('locales')
export class Local {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nombre: string;

  @Column({ length: 255, nullable: true })
  direccion: string;

  @Column({ length: 100 })
  region: string;

  @Column({ length: 100 })
  provincia: string;

  @Column({ length: 100 })
  distrito: string;

  @OneToMany(() => Mesa, (mesa) => mesa.local)
  mesas: Mesa[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
