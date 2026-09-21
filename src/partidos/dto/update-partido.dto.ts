import { IsString, IsOptional, Length } from 'class-validator';

export class UpdatePartidoDto {
    @IsString()
    @IsOptional()
    @Length(2, 100)
    nombre?: string;

    @IsString()
    @IsOptional()
    @Length(2, 20)
    siglas?: string;

    @IsString()
    @IsOptional()
    electionId?: string;

    @IsString()
    @IsOptional()
    logoUrl?: string;
}
