import { IsString, IsOptional, Length, IsEnum, IsUUID } from 'class-validator';
import { Role } from '../../auth/enums/role.enum';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  lastname?: string;

  @IsString()
  @IsOptional()
  @Length(8, 8)
  dni?: string;

  @IsString()
  @IsOptional()
  @Length(7, 20)
  phone?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsUUID()
  @IsOptional()
  electionId?: string;
}
