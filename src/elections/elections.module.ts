import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectionsService } from './elections.service';
import { ElectionsController } from './elections.controller';
import { Election } from './entities/election.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Election])],
  controllers: [ElectionsController],
  providers: [ElectionsService],
  exports: [ElectionsService],
})
export class ElectionsModule {}
