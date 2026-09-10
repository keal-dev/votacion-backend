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

    return {
      token: this.jwtService.sign(payload),
      user: userWithoutPassword
    };
  }

}
