import { IsNumber, IsOptional } from 'class-validator';

export class CreateAsistenciaDto {
  @IsNumber()
  latitud: number;

  @IsNumber()
  longitud: number;
}
