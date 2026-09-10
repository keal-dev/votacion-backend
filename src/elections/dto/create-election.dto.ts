import { IsString, IsNotEmpty, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class CreateElectionDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;

  @IsString()
  @IsOptional()
  estado?: string;
}
