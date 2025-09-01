import { TicketPriority, TicketStatus } from '.prisma/tenant'; // ✅ Import Prisma
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTicketDto {
  @ApiPropertyOptional({
    description: 'Nouveau titre du ticket',
    example: 'Problème de connexion - RÉSOLU',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Nouvelle description du ticket',
    example: 'Problème résolu après redémarrage du serveur.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  // ✅ UTILISE L'ENUM PRISMA
  @ApiPropertyOptional({
    description: 'Nouveau statut du ticket',
    enum: TicketStatus,
    enumName: 'TicketStatus',
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  // ✅ UTILISE L'ENUM PRISMA
  @ApiPropertyOptional({
    description: 'Nouvelle priorité du ticket',
    enum: TicketPriority,
    enumName: 'TicketPriority',
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: 'ID du nouvel assigné',
    example: 'user-456',
  })
  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;
}
