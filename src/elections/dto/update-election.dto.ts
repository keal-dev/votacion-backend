import { IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateElectionDto {
    @IsString()
    @IsOptional()
    nombre?: string;

    @IsDateString()
    @IsOptional()
    fecha?: string;

    @IsBoolean()
    @IsOptional()
    activa?: boolean;

    @IsString()
    @IsOptional()
    estado?: string;
}
