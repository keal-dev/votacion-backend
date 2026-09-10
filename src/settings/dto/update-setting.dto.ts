import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(5000)
  gps_tolerance_meters?: number;

  @IsOptional()
  @IsBoolean()
  maintenance_mode?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  max_photo_size_mb?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  platform_name?: string;

  @IsOptional()
  @IsString()
  global_announcement?: string | null;
}
