import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Get, Param, BadRequestException, Patch, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MesasService } from './mesas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('mesas')
export class MesasController {
  constructor(private readonly mesasService: MesasService) { }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('El archivo no se recibió correctamente en el servidor');
    }
    return this.mesasService.processCsv(file);
  }

  @Get('election/:electionId')
  findByElection(@Param('electionId') electionId: string) {
    return this.mesasService.findAllMesasByElection(electionId);
  }

  @Get('me')
  getMyMesas(@CurrentUser() user: any) {
    return this.mesasService.findByPersonero(user.id);
  }

  @Get('ubicaciones')
  getUbicaciones() {
    return this.mesasService.getUbicaciones();
  }

  @Get('locales/nombres')
  getLocalesNombres() {
    return this.mesasService.getLocalesNombres();
  }

  @Patch(':id/asignar')
  assignPersonero(
    @Param('id') id: string,
    @Body('personeroId') personeroId: string | null
  ) {
    return this.mesasService.assignPersonero(id, personeroId);
  }
}
