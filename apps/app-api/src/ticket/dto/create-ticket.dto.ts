import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED',
}

export class CreateTicketDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  authorId!: string; // OBLIGATOIRE selon le schéma

  @IsOptional()
  @IsString()
  assignedToId?: string; // Optionnel

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
