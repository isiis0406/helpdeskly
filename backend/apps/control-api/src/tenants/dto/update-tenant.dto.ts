import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({
    description: 'Nom du tenant',
    example: 'Ma Super Entreprise Modifiée',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Tenant name must be a string' })
  @MinLength(2, { message: 'Tenant name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Tenant name must not exceed 100 characters' })
  tenantName?: string;

  @ApiPropertyOptional({
    description: 'Description du tenant',
    example: 'Nouvelle description du service client',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'URL du logo du tenant',
    example: 'https://example.com/new-logo.png',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Logo must be a valid URL' })
  logo?: string;

  @ApiPropertyOptional({
    description: 'Domaine personnalisé',
    example: 'help.monsite.com',
  })
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional({
    description: "Nombre de jours d'essai",
    example: 60,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Trial days must be a number' })
  @Min(1, { message: 'Trial days must be at least 1' })
  @Max(365, { message: 'Trial days must not exceed 365' })
  trialDays?: number;
}
