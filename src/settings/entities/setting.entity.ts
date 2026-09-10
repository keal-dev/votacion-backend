import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 100 })
  gps_tolerance_meters: number;

  @Column({ type: 'boolean', default: false })
  maintenance_mode: boolean;

  @Column({ type: 'int', default: 5 })
  max_photo_size_mb: number;

  @Column({ type: 'varchar', length: 100, default: 'Sistema Electoral' })
  platform_name: string;

  @Column({ type: 'text', nullable: true })
  global_announcement: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
