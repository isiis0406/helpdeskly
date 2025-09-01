import { UsageMetricType } from '.prisma/control';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional } from 'class-validator';

export class UsageRecordDto {
  @ApiProperty({ enum: UsageMetricType, description: 'Type de métrique à enregistrer' })
  @IsEnum(UsageMetricType)
  metricType!: UsageMetricType;

  @ApiProperty({ description: 'Valeur de la métrique', example: 1 })
  @IsInt()
  value!: number;

  @ApiPropertyOptional({ description: 'Métadonnées optionnelles' })
  @IsOptional()
  metadata?: any;
}
