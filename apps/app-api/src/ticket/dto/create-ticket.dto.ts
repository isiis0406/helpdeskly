// dto/create-ticket.dto.ts
import { IsEnum, IsOptional, IsString } from "class-validator";

export enum TicketPriority {
  LOW,
  MEDIUM,
  HIGH,
}
export class CreateTicketDto {
  @IsString()
  title!: string;
  @IsString()
  description!: string;
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: "LOW" | "MEDIUM" | "HIGH";
}
