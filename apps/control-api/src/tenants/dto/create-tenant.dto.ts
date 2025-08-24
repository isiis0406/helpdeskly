// apps/control-api/src/tenants/dto/create-tenant.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  @IsString({ message: 'Slug must be a string' })
  @IsNotEmpty({ message: 'Slug is required' })
  @MinLength(2, { message: 'Slug must be at least 2 characters long' })
  @MaxLength(50, { message: 'Slug must not exceed 50 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsString({ message: 'Tenant name must be a string' })
  @IsNotEmpty({ message: 'Tenant name is required' })
  @MinLength(2, { message: 'Tenant name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Tenant name must not exceed 100 characters' })
  tenantName!: string;

  @IsOptional()
  @IsNumber({}, { message: 'Trial days must be a number' })
  @Min(1, { message: 'Trial days must be at least 1' })
  @Max(365, { message: 'Trial days must not exceed 365' })
  trialDays?: number;
}
