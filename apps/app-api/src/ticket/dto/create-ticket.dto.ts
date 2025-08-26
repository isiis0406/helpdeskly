import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT', // Ajouté URGENT qui existe dans le service
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED', // Ajouté RESOLVED qui existe dans le service
  CLOSED = 'CLOSED',
}

export class CreateTicketDto {
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title!: string;

  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters' })
  description!: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
