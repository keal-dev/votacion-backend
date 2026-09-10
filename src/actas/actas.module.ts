import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActasController } from './actas.controller';
import { ActasService } from './actas.service';
import { Acta } from './entities/acta.entity';
import { Voto } from './entities/voto.entity';
import { FotoActa } from './entities/foto-acta.entity';
import { Mesa } from '../mesas/entities/mesa.entity';
import { Candidato } from '../candidatos/entities/candidato.entity';
import { Election } from '../elections/entities/election.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Acta, Voto, FotoActa, Mesa, Candidato, Election])],
  controllers: [ActasController],
  providers: [ActasService],
})
export class ActasModule {}
