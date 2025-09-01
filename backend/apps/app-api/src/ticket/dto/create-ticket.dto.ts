import { TicketPriority, TicketStatus } from '.prisma/tenant'; // ✅ Enums Prisma
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// ✅ GARDER: Seul enum custom (pas dans Prisma)
export enum TicketCategory {
  TECHNICAL = 'TECHNICAL',
  BILLING = 'BILLING',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  BUG_REPORT = 'BUG_REPORT',
  ACCOUNT = 'ACCOUNT',
  OTHER = 'OTHER',
}

export class CreateTicketDto {
  @ApiProperty({
    description: 'Titre du ticket (concis et descriptif)',
    example: 'Impossible de se connecter depuis la mise à jour',
    minLength: 5,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Le titre doit contenir au moins 5 caractères' })
  @MaxLength(200, { message: 'Le titre ne peut pas dépasser 200 caractères' })
  title!: string;

  @ApiProperty({
    description: 'Description détaillée du problème ou de la demande',
    example: `Depuis la mise à jour de l'application ce matin, je n'arrive plus à me connecter.`,
    minLength: 10,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'La description doit contenir au moins 10 caractères',
  })
  @MaxLength(5000, {
    message: 'La description ne peut pas dépasser 5000 caractères',
  })
  description!: string;

  @ApiProperty({
    description: "Priorité du ticket selon l'impact business",
    enum: TicketPriority, // ✅ Enum Prisma
    example: TicketPriority.MEDIUM,
    enumName: 'TicketPriority',
  })
  @IsEnum(TicketPriority, {
    message: 'La priorité doit être LOW, MEDIUM, HIGH ou URGENT',
  })
  priority!: TicketPriority;

  @ApiProperty({
    description: 'Catégorie du ticket pour un routage efficace',
    enum: TicketCategory, // ✅ Custom enum (pas encore dans Prisma)
    example: TicketCategory.TECHNICAL,
    enumName: 'TicketCategory',
  })
  @IsEnum(TicketCategory, {
    message:
      'La catégorie doit être TECHNICAL, BILLING, FEATURE_REQUEST, BUG_REPORT, ACCOUNT ou OTHER',
  })
  category!: TicketCategory;

  // ✅ UTILISE L'ENUM PRISMA
  @ApiPropertyOptional({
    description: 'Statut initial du ticket (par défaut: OPEN)',
    enum: TicketStatus, // ✅ Enum Prisma
    example: TicketStatus.OPEN,
    default: TicketStatus.OPEN,
    enumName: 'TicketStatus',
  })
  @IsOptional()
  @IsEnum(TicketStatus, {
    message: 'Le statut doit être OPEN, IN_PROGRESS, RESOLVED ou CLOSED',
  })
  status?: TicketStatus;

  @ApiPropertyOptional({
    description: "ID de l'utilisateur à assigner (optionnel)",
    example: 'user-456',
    type: String,
  })
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'Tags pour catégorisation avancée (séparés par des virgules)',
    example: 'connexion,authentification,urgent',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Les tags ne peuvent pas dépasser 500 caractères',
  })
  tags?: string;

  @ApiPropertyOptional({
    description: 'Données contextuelles additionnelles (JSON)',
    example: {
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.100',
      sessionId: 'sess_123',
      errorCode: 'AUTH_001',
    },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateCommentDto {
  @ApiProperty({
    description: 'Contenu du commentaire',
    example: 'Merci pour votre ticket, nous regardons cela immédiatement.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le contenu du commentaire ne peut pas être vide' })
  @MinLength(1, {
    message: 'Le commentaire doit contenir au moins 1 caractère',
  })
  @MaxLength(2000, {
    message: 'Le commentaire ne peut pas dépasser 2000 caractères',
  })
  body!: string;
}
