import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ElectionsService } from './elections.service';
import { CreateElectionDto } from './dto/create-election.dto';
import { UpdateElectionDto } from './dto/update-election.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('elections')
export class ElectionsController {
  constructor(private readonly electionsService: ElectionsService) { }

  @Post()
  create(@Body() createElectionDto: CreateElectionDto) {
    return this.electionsService.create(createElectionDto);
  }

  @Get()
  findAll() {
    return this.electionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.electionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateElectionDto: UpdateElectionDto) {
    return this.electionsService.update(id, updateElectionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.electionsService.remove(id);
  }
}
