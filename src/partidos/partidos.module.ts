import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartidosService } from './partidos.service';
import { PartidosController } from './partidos.controller';
import { Partido } from './entities/partido.entity';
import { Election } from '../elections/entities/election.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Partido, Election])],
  controllers: [PartidosController],
  providers: [PartidosService],
})
export class PartidosModule {}
