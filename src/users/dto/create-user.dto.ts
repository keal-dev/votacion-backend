import { IsString, IsNotEmpty, IsOptional, Length, IsEnum, IsUUID } from 'class-validator';
import { Role } from '../../auth/enums/role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  lastname: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  dni: string;

  @IsString()
  @IsOptional()
  @Length(7, 20)
  phone?: string;

  @IsEnum(Role)
  role: Role;

  @IsUUID()
  @IsOptional()
  electionId?: string;
}
