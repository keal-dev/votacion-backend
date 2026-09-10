import { IsString, IsOptional, Length, IsEnum, IsUUID } from 'class-validator';
import { CargoCandidato } from '../enums/cargo.enum';

export class UpdateCandidatoDto {
  @IsString()
  @IsOptional()
  @Length(2, 150)
  nombre?: string;

  @IsString()
  @IsOptional()
  @Length(2, 150)
  apellidos?: string;

  @IsString()
  @IsOptional()
  @Length(8, 8)
  dni?: string;

  @IsOptional()
  @IsEnum(CargoCandidato)
  cargo?: CargoCandidato;

  @IsUUID()
  @IsOptional()
  partidoId?: string;

  @IsUUID()
  @IsOptional()
  electionId?: string;

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
