import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciasService } from './asistencias.service';
import { AsistenciasController } from './asistencias.controller';
import { Asistencia } from './entities/asistencia.entity';
import { User } from '../users/entities/user.entity';
import { Election } from '../elections/entities/election.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asistencia, User, Election])],
  controllers: [AsistenciasController],
  providers: [AsistenciasService],
  exports: [AsistenciasService],
})
export class AsistenciasModule {}
