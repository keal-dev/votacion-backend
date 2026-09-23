import { Controller, Post, Patch, UseInterceptors, UploadedFile, Body, Get, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
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

  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('logo', { storage: partidosStorage }))
  uploadLogo(@UploadedFile() file?: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return { logoUrl: file.path };
  }

  @Post()
  create(@Body() createPartidoDto: CreatePartidoDto) {
    return this.partidosService.create({
      ...createPartidoDto,
      logoUrl: createPartidoDto.logoUrl || null,
    });
  }

  @Post(':electionId/bulk-csv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBulkCsv(
    @Param('electionId') electionId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.partidosService.createManyFromCsv(electionId, file.buffer);
  }

  @Get('election/:electionId')
  findByElection(@Param('electionId') electionId: string) {
    return this.partidosService.findByElection(electionId);
  }

  @Patch('reorder')
  reorder(@Body() updates: { id: string; orden: number }[]) {
    return this.partidosService.reorder(updates);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePartidoDto: UpdatePartidoDto) {
    return this.partidosService.update(id, updatePartidoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.partidosService.remove(id);
  }
}
