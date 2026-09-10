import { Controller, Get, Post, Body, Patch, UseGuards } from '@nestjs/common';
import { AsistenciasService } from './asistencias.service';
import { CreateAsistenciaDto } from './dto/create-asistencia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('asistencias')
@UseGuards(JwtAuthGuard)
export class AsistenciasController {
  constructor(private readonly asistenciasService: AsistenciasService) {}

  @Post('check-in')
  checkIn(@CurrentUser() user: any, @Body() createAsistenciaDto: CreateAsistenciaDto) {
    return this.asistenciasService.checkIn(user.id, createAsistenciaDto);
  }

  @Patch('check-out')
  checkOut(@CurrentUser() user: any, @Body() updateDto: CreateAsistenciaDto) {
    return this.asistenciasService.checkOut(user.id, updateDto);
  }

  @Get('me/today')
  getTodayStatus(@CurrentUser() user: any) {
    return this.asistenciasService.getTodayStatus(user.id);
  }
}
