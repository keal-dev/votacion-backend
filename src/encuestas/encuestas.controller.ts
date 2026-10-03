import { Controller, Get, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { EncuestasService } from './encuestas.service';
import { CreateEncuestaDto } from './dto/create-encuesta.dto';
import { VotarEncuestaDto } from './dto/votar-encuesta.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';


@Controller('encuestas')
export class EncuestasController {
  constructor(private readonly encuestasService: EncuestasService) {}

  // ================= RUTAS PÚBLICAS (Para los encuestadores en la calle) =================
  
  // Obtener la lista de locales de votación
  @Get('locales')
  getLocales() {
    return this.encuestasService.getLocales();
  }

  // Validar si el código sirve
  @Get('validar/:codigo')
  validarCodigo(@Param('codigo') codigo: string) {
    return this.encuestasService.validarCodigo(codigo);
  }

  @Get(':codigo/progreso/:localId')
  getProgreso(@Param('codigo') codigo: string, @Param('localId') localId: string) {
    return this.encuestasService.getProgreso(codigo, localId);
  }

  // Obtener los candidatos filtrados para esta encuesta específica
  @Get(':codigo/candidatos')
  getCandidatosPorEncuesta(@Param('codigo') codigo: string) {
    return this.encuestasService.getCandidatosPorEncuesta(codigo);
  }

  // Enviar un voto usando el código
  @Post('votar')
  registrarVoto(@Body() votarDto: VotarEncuestaDto) {
    return this.encuestasService.registrarVoto(votarDto);
  }

  // ================= RUTAS PROTEGIDAS (Para el Administrador en el panel) =================
  
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createEncuestaDto: CreateEncuestaDto) {
    return this.encuestasService.create(createEncuestaDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.encuestasService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.encuestasService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/resultados')
  getResultados(@Param('id') id: string) {
    return this.encuestasService.getResultados(id);
  }
}
