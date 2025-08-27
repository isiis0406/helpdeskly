import { BillingCycle } from '.prisma/control';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'ID du plan à souscrire',
    example: 'plan_starter_monthly',
  })
  @IsString()
  @IsUUID()
  planId!: string;

  @ApiProperty({
    description: 'Cycle de facturation',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
  })
  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;

  @ApiPropertyOptional({
    description: "Nombre de jours d'essai gratuit (0-30)",
    example: 14,
    minimum: 0,
    maximum: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  trialDays?: number;

  @ApiPropertyOptional({
    description: 'ID de la méthode de paiement Stripe',
    example: 'pm_1234567890',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Code coupon de réduction',
    example: 'LAUNCH50',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
