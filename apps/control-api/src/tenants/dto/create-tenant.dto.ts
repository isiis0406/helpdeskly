import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Slug unique du tenant (utilisé dans les URLs)',
    example: 'ma-super-entreprise',
    pattern: '^[a-z0-9-]+$',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Slug must be a string' })
  @IsNotEmpty({ message: 'Slug is required' })
  @MinLength(2, { message: 'Slug must be at least 2 characters long' })
  @MaxLength(50, { message: 'Slug must not exceed 50 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @ApiProperty({
    description: 'Nom du tenant (organisation)',
    example: 'Ma Super Entreprise',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Tenant name must be a string' })
  @IsNotEmpty({ message: 'Tenant name is required' })
  @MinLength(2, { message: 'Tenant name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Tenant name must not exceed 100 characters' })
  tenantName!: string;

  @ApiPropertyOptional({
    description: 'Description du tenant',
    example: 'Service client pour notre entreprise',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'URL du logo du tenant',
    example: 'https://example.com/logo.png',
    format: 'url',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Logo must be a valid URL' })
  logo?: string;

  @ApiPropertyOptional({
    description: 'Domaine personnalisé (optionnel)',
    example: 'support.monsite.com',
  })
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional({
    description: "Nombre de jours d'essai gratuit",
    example: 30,
    minimum: 1,
    maximum: 365,
    default: 30,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Trial days must be a number' })
  @Min(1, { message: 'Trial days must be at least 1' })
  @Max(365, { message: 'Trial days must not exceed 365' })
  trialDays?: number;
}
