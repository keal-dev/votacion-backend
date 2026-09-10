import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MesasService } from './mesas.service';
import { MesasController } from './mesas.controller';
import { Local } from './entities/local.entity';
import { Mesa } from './entities/mesa.entity';
import { Election } from '../elections/entities/election.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Local, Mesa, Election, User])],
  controllers: [MesasController],
  providers: [MesasService],
})
export class MesasModule {}
