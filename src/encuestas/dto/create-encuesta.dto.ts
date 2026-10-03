import { IsString, IsNotEmpty, IsNumber, IsBoolean, Min, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { CargoCandidato } from '../../candidatos/enums/cargo.enum';

export class CreateEncuestaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10, { message: 'El código de acceso no puede tener más de 10 caracteres' })
  codigoAcceso: string;

  @IsNumber()
  @Min(1)
  cuotaMax: number;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;

  @IsEnum(CargoCandidato)
  cargo: CargoCandidato;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  provincia?: string;

  @IsString()
  @IsOptional()
  distrito?: string;
}
