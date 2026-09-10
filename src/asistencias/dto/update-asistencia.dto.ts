import { IsNumber, IsOptional } from 'class-validator';

export class UpdateAsistenciaDto {
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @IsNumber()
  @IsOptional()
  longitud?: number;
}
