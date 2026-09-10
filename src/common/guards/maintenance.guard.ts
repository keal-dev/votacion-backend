import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const settings = await this.settingsService.getSettings();
    
    // Si el modo mantenimiento no está activado, permitimos el acceso a todos
    if (!settings.maintenance_mode) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Permitir acceso a la ruta de login para que el ADMIN pueda entrar
    if (request.path === '/api/auth/login' || request.path.includes('/auth/login')) {
      return true;
    }

    let role = null;
    
    // MaintenanceGuard se ejecuta antes que JwtAuthGuard, por lo que request.user es undefined.
    // Extraemos el rol del token manualmente.
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = this.jwtService.decode(token) as any;
        if (decoded && decoded.role) {
          role = decoded.role;
        }
      } catch (e) {
        // Ignoramos errores de decodificación, se bloqueará abajo
      }
    }

    // Si está en mantenimiento, solo los ADMIN pueden pasar
    if (role === 'ADMIN') {
      return true;
    }

    // Opcionalmente, permitir que ciertas rutas públicas como el login funcionen
    // pero si queremos que sea estricto y bloquee incluso el login de no-admins,
    // podemos dejarlo así.
    
    throw new ServiceUnavailableException('El sistema se encuentra temporalmente en mantenimiento. Por favor, intenta más tarde.');
  }
}
