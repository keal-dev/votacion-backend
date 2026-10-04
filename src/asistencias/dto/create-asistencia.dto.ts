import { IsNumber, IsOptional } from 'class-validator';

export class CreateAsistenciaDto {
  @IsOptional()
  @IsNumber()
  latitud?: number;

  @IsOptional()
  @IsNumber()
  longitud?: number;
}
