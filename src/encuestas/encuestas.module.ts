import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncuestasService } from './encuestas.service';
import { EncuestasController } from './encuestas.controller';
import { Encuesta } from './entities/encuesta.entity';
import { VotoEncuesta } from './entities/voto-encuesta.entity';
import { Candidato } from '../candidatos/entities/candidato.entity';
import { Local } from '../mesas/entities/local.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Encuesta, VotoEncuesta, Candidato, Local])],
  controllers: [EncuestasController],
  providers: [EncuestasService],
  exports: [EncuestasService],
})
export class EncuestasModule {}
