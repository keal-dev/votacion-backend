import { IsString, IsNotEmpty, IsOptional, Length, IsEnum, IsUUID } from 'class-validator';
import { CargoCandidato } from '../enums/cargo.enum';

export class CreateCandidatoDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  apellidos: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  dni: string;

  @IsEnum(CargoCandidato)
  cargo: CargoCandidato;

  @IsUUID()
  @IsNotEmpty()
  partidoId: string;

  @IsUUID()
  @IsNotEmpty()
  electionId: string;

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
