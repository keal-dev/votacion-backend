import { Controller, Post, Patch, UseInterceptors, UploadedFile, Body, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CandidatosService } from './candidatos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CargoCandidato } from './enums/cargo.enum';
import { CreateCandidatoDto } from './dto/create-candidato.dto';
import { UpdateCandidatoDto } from './dto/update-candidato.dto';
import { candidatosStorage } from '../common/config/cloudinary.config';

@UseGuards(JwtAuthGuard)
@Controller('candidatos')
export class CandidatosController {
  constructor(private readonly candidatosService: CandidatosService) { }

  @Post()
  @UseInterceptors(FileInterceptor('foto', { storage: candidatosStorage }))
  create(
    @Body() createCandidatoDto: CreateCandidatoDto,
    @UploadedFile() file?: any
  ) {
    const fotoUrl = file ? file.path : null;
    return this.candidatosService.create({ ...createCandidatoDto, fotoUrl });
  }

  @Get('election/:electionId')
  findByElection(@Param('electionId') electionId: string) {
    return this.candidatosService.findByElection(electionId);
  }

  @Get('mesa/:mesaId')
  findByMesa(@Param('mesaId') mesaId: string) {
    return this.candidatosService.findByMesa(mesaId);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('foto', { storage: candidatosStorage }))
  update(
    @Param('id') id: string,
    @Body() updateCandidatoDto: UpdateCandidatoDto,
    @UploadedFile() file?: any
  ) {
    const fotoUrl = file ? file.path : undefined;
    return this.candidatosService.update(id, { ...updateCandidatoDto, fotoUrl });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.candidatosService.remove(id);
  }
}
