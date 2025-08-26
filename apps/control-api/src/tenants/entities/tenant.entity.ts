import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TenantStatus {
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class TenantEntity {
  @ApiProperty({
    description: 'Identifiant unique du tenant',
    example: 'cm123abc456def789',
  })
  id!: string;

  @ApiProperty({
    description: 'Slug unique du tenant',
    example: 'ma-super-entreprise',
  })
  slug!: string;

  @ApiProperty({
    description: 'Nom du tenant',
    example: 'Ma Super Entreprise',
  })
  name!: string;

  @ApiProperty({
    description: 'Statut du tenant',
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
  })
  status!: TenantStatus;

  @ApiPropertyOptional({
    description: 'URL de la base de données tenant (développement)',
    example: 'postgresql://user:pass@localhost:5432/tenant_db',
  })
  dbUrl?: string;

  @ApiPropertyOptional({
    description: 'Référence du secret pour la base de données (production)',
    example: 'arn:aws:secretsmanager:eu-west-1:123:secret:helpdeskly-tenant-db',
  })
  secretRef?: string;

  @ApiProperty({
    description: 'Version du schéma de base de données',
    example: 1,
  })
  schemaVersion!: number;

  @ApiProperty({
    description: 'Date de création',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2023-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: "Date de fin d'essai",
    example: '2023-02-01T00:00:00.000Z',
  })
  trialEndsAt?: Date;

  @ApiPropertyOptional({
    description: "URL d'accès au tenant",
    example: 'http://localhost:3000?tenant=ma-entreprise',
  })
  url?: string;
}
