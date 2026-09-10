import { Controller, Post, Patch, UseInterceptors, UploadedFile, Body, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PartidosService } from './partidos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePartidoDto } from './dto/create-partido.dto';
import { UpdatePartidoDto } from './dto/update-partido.dto';
import { partidosStorage } from '../common/config/cloudinary.config';

@UseGuards(JwtAuthGuard)
@Controller('partidos')
export class PartidosController {
  constructor(private readonly partidosService: PartidosService) { }

  @Post()
  @UseInterceptors(FileInterceptor('logo', { storage: partidosStorage }))
  create(@Body() createPartidoDto: CreatePartidoDto, @UploadedFile() file?: any) {
    // Cloudinary devuelve la URL de la imagen subida en `file.path`
    const logoUrl = file ? file.path : null;
    return this.partidosService.create({ ...createPartidoDto, logoUrl });
  }

  @Get('election/:electionId')
  findByElection(@Param('electionId') electionId: string) {
    return this.partidosService.findByElection(electionId);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo', { storage: partidosStorage }))
  update(@Param('id') id: string, @Body() updatePartidoDto: UpdatePartidoDto, @UploadedFile() file?: any) {
    // Si no se envía un nuevo logo, `file` será undefined,
    // por lo que el logo original no se perderá en la BD.
    const logoUrl = file ? file.path : undefined;
    return this.partidosService.update(id, { ...updatePartidoDto, logoUrl });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.partidosService.remove(id);
  }
}
