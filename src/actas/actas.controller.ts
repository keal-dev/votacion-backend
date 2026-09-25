import { Controller, Post, UseInterceptors, UploadedFiles, UseGuards, Body, BadRequestException, Get, Patch, Param, Query, Delete } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ActasService } from './actas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { actasStorage } from '../common/config/cloudinary.config';

@UseGuards(JwtAuthGuard)
@Controller('actas')
export class ActasController {
  constructor(private readonly actasService: ActasService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('fotos_actas', 5, { storage: actasStorage }))
  async createActa(
    @CurrentUser() user: any,
    @Body('mesaId') mesaId: string,
    @Body('observaciones') observaciones: string,
    @Body('votos') votosJson: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    if (!mesaId) {
      throw new BadRequestException('El mesaId es requerido');
    }
    
    if (!files || files.length === 0) {
      throw new BadRequestException('Las fotos son requeridas');
    }

    return this.actasService.create(user.id, mesaId, files, observaciones, votosJson);
  }

  @Post(':id/fotos')
  @UseInterceptors(FilesInterceptor('fotos_actas', 5, { storage: actasStorage }))
  async uploadFotos(
    @Param('id') actaId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Las fotos son requeridas');
    }
    return this.actasService.uploadFotos(actaId, files);
  }

  @Delete(':actaId/fotos/:fotoId')
  async deleteFoto(
    @Param('actaId') actaId: string,
    @Param('fotoId') fotoId: string
  ) {
    return this.actasService.deleteFoto(actaId, fotoId);
  }

  @Get('auditoria')
  getAuditoria(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('local') local?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 25;
    return this.actasService.findAllForAudit(pageNum, limitNum, search, estado, local);
  }

  @Get('auditoria/:id')
  getAuditoriaById(@Param('id') id: string) {
    return this.actasService.findOneForAudit(id);
  }
  @Patch(':id/estado')
  async updateEstado(
    @Param('id') id: string,
    @Body('estado') estado: string
  ) {
    if (!estado) {
      throw new BadRequestException('El estado es requerido');
    }
    return this.actasService.updateEstado(id, estado);
  }


  @Patch('votos/:actaId')
  async updateVotos(
    @Param('actaId') actaId: string,
    @Body('votos') votos: { votoId: string, cantidad: number }[]
  ) {
    if (!votos || !Array.isArray(votos)) {
      throw new BadRequestException('El formato de votos no es válido');
    }
    return this.actasService.updateVotos(actaId, votos);
  }
}
