import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) { }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByDni(dto.dni);

    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { id: user.id, dni: user.dni, role: user.role };
    const { password, ...userWithoutPassword } = user
    const isDefaultPassword = password === user.dni;

    return {
      token: this.jwtService.sign(payload),
      user: { ...userWithoutPassword, isDefaultPassword }
    };
  }

  async changePassword(userId: string, dto: any) {
    const user = await this.usersService.findOne(userId);
    if (!user || user.password !== dto.currentPassword) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }
    await this.usersService.updatePassword(userId, dto.newPassword);
    return { message: 'Contraseña actualizada con éxito' };
  }

}
