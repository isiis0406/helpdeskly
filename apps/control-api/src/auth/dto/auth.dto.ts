import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: "Adresse email de l'utilisateur",
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email must be valid' })
  email!: string;

  @ApiProperty({
    description:
      'Mot de passe (min 8 caractères, 1 maj, 1 min, 1 chiffre, 1 caractère spécial)',
    example: 'MySecureP@ss123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;

  @ApiProperty({
    description: "Nom complet de l'utilisateur",
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Slug du tenant à rejoindre (optionnel)',
    example: 'my-company',
    pattern: '^[a-z0-9-]+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Tenant slug must contain only lowercase letters, numbers and hyphens',
  })
  tenantSlug?: string;
}

export class LoginDto {
  @ApiProperty({
    description: "Adresse email de l'utilisateur",
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Email must be valid' })
  email!: string;

  @ApiProperty({
    description: "Mot de passe de l'utilisateur",
    example: 'MySecureP@ss123',
  })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;

  @ApiPropertyOptional({
    description: 'Slug du tenant pour se connecter directement',
    example: 'my-company',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Token de rafraîchissement',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @MinLength(1, { message: 'Refresh token is required' })
  refreshToken!: string;
}

export class SwitchTenantDto {
  @ApiProperty({
    description: 'Slug du tenant vers lequel basculer',
    example: 'new-company',
    pattern: '^[a-z0-9-]+$',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Tenant slug must contain only lowercase letters, numbers and hyphens',
  })
  tenantSlug!: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: "Token d'accès JWT",
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Token de rafraîchissement',
    example: 'abc123def456...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Durée de validité du token en secondes',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({
    description: "Informations de l'utilisateur connecté",
    type: 'object',
    additionalProperties: true,
  })
  user!: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    currentTenant?: {
      id: string;
      slug: string;
      name: string;
      role: string;
    };
    memberships: Array<{
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      role: string;
      isActive: boolean;
    }>;
  };
}
