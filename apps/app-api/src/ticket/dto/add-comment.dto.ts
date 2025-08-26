import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AddCommentDto {
  @ApiProperty({
    description: 'Contenu du commentaire à ajouter',
    example:
      'Merci pour votre ticket, nous regardons cela immédiatement. Pouvez-vous nous donner plus de détails sur le problème ?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsNotEmpty({ message: 'Le contenu du commentaire ne peut pas être vide' })
  @IsString({
    message: 'Le contenu du commentaire doit être une chaîne de caractères',
  })
  @MinLength(1, {
    message: 'Le commentaire doit contenir au moins 1 caractère',
  })
  @MaxLength(2000, {
    message: 'Le commentaire ne peut pas dépasser 2000 caractères',
  })
  body!: string;
}
