import { Controller, Post, UseGuards, HttpCode, HttpStatus, Get, Query } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../auth/enums/role.enum';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) { }

  @Post('reset')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resetSystem() {
    return this.systemService.resetSystem();
  }

  @Get('dashboard')
  @Roles(Role.ADMIN, Role.COORDINADOR)
  async getDashboardMetrics() {
    return this.systemService.getDashboardMetrics();
  }

  @Get('resultados')
  @Roles(Role.ADMIN, Role.COORDINADOR)
  async getResultados(@Query('distrito') distrito?: string, @Query('local') local?: string) {
    return this.systemService.getResultados(distrito, local);
  }
}
