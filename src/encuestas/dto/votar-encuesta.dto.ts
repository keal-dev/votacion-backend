import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VotarEncuestaDto {
  @IsString()
  @IsNotEmpty()
  codigoAcceso: string;

  @IsString()
  @IsNotEmpty()
  localId: string; // El local seleccionado

  @IsString()
  @IsOptional()
  candidatoId?: string; // uuid
}
