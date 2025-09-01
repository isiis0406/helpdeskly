import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto';

export class TenantSignupDto extends CreateTenantDto {
  // Données admin (en plus des données tenant héritées)
  @ApiProperty({
    description: "Nom complet de l'administrateur",
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  adminName!: string;

  @ApiProperty({
    description: "Email de l'administrateur",
    example: 'john@startup.com',
  })
  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @ApiProperty({
    description: "Mot de passe de l'administrateur",
    example: 'SecurePassword123!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  adminPassword!: string;

  @ApiProperty({
    description: 'Acceptation des CGU',
    example: true,
  })
  @IsNotEmpty()
  acceptTerms!: boolean;

  @ApiPropertyOptional({
    description: 'Inclure des données de démonstration (tickets, commentaires)',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  withDemoData?: boolean;
}
