import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreatePartidoDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  siglas: string;

  @IsString()
  @IsNotEmpty()
  electionId: string;
}
