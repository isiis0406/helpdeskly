import { BillingCycle } from '.prisma/control';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Nouveau plan ID',
    example: 'plan_pro_monthly',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({
    description: 'Nouveau cycle de facturation',
    enum: BillingCycle,
    example: BillingCycle.YEARLY,
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    description: 'Quantité (pour plans à usage)',
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Comportement de prorata',
    enum: ['create_prorations', 'none', 'always_invoice'],
    example: 'create_prorations',
  })
  @IsOptional()
  @IsIn(['create_prorations', 'none', 'always_invoice'])
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';

  @ApiPropertyOptional({
    description: 'Métadonnées additionnelles',
    example: { source: 'admin_upgrade', campaign: 'q1_2024' },
  })
  @IsOptional()
  metadata?: Record<string, string>;
}
