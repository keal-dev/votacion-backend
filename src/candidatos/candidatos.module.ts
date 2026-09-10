import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatosService } from './candidatos.service';
import { CandidatosController } from './candidatos.controller';
import { Candidato } from './entities/candidato.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { Election } from '../elections/entities/election.entity';
import { Mesa } from '../mesas/entities/mesa.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidato, Partido, Election, Mesa])],
  controllers: [CandidatosController],
  providers: [CandidatosService],
})
export class CandidatosModule {}
