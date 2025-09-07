import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({
    description: "ID de l'utilisateur à assigner au ticket",
    example: 'cmesqgqc00001ewqcrkztn3fs',
    type: String,
  })
  @IsNotEmpty({ message: "L'ID de l'assigné est requis" })
  @IsString({ message: "L'ID de l'assigné doit être une chaîne de caractères" })
  assignedToId!: string;
}
