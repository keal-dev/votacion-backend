import { IsString, IsOptional, Length, IsEnum, IsUUID } from 'class-validator';
import { Role } from '../../auth/enums/role.enum';

export class UpdateUserDto {
  @IsString({ message: 'El nombre debe ser un texto válido.' })
  @IsOptional()
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres.' })
  name?: string;

  @IsString({ message: 'Los apellidos deben ser un texto válido.' })
  @IsOptional()
  @Length(2, 100, { message: 'Los apellidos deben tener entre 2 y 100 caracteres.' })
  lastname?: string;

  @IsString({ message: 'El DNI debe ser un texto válido.' })
  @IsOptional()
  @Length(8, 8, { message: 'El DNI debe tener exactamente 8 dígitos.' })
  dni?: string;

  @IsString({ message: 'El teléfono debe ser un texto válido.' })
  @IsOptional()
  @Length(7, 20, { message: 'El teléfono debe tener entre 7 y 20 dígitos.' })
  phone?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'El rol seleccionado no es válido.' })
  role?: Role;

  @IsString({ message: 'La contraseña debe ser un texto válido.' })
  @IsOptional()
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres.' })
  password?: string;

  @IsUUID('all', { message: 'El ID de la elección no es válido.' })
  @IsOptional()
  electionId?: string;
}
