import { BillingCycle } from '.prisma/control';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlanService } from '../services/plan.service';

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister tous les plans disponibles',
    description: 'Retourne tous les plans actifs avec leurs fonctionnalités',
  })
  @ApiQuery({
    name: 'billingCycle',
    required: false,
    enum: BillingCycle,
    description: 'Filtrer par cycle de facturation',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des plans',
    schema: {
      example: {
        plans: [
          {
            id: 'plan_starter',
            name: 'Starter',
            description: 'Parfait pour débuter',
            priceMonthly: 29.99,
            priceYearly: 299.99,
            features: ['5 utilisateurs', '100 tickets/mois'],
            isPopular: false,
          },
          {
            id: 'plan_pro',
            name: 'Professional',
            description: 'Pour les équipes en croissance',
            priceMonthly: 99.99,
            priceYearly: 999.99,
            features: ['50 utilisateurs', '1000 tickets/mois'],
            isPopular: true,
          },
        ],
      },
    },
  })
  async getPlans(@Query('billingCycle') billingCycle?: BillingCycle) {
    return this.planService.getActivePlans(billingCycle);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un plan spécifique',
    description: "Détails complets d'un plan avec toutes ses fonctionnalités",
  })
  @ApiParam({ name: 'id', description: 'ID du plan' })
  @ApiResponse({ status: 200, description: 'Détails du plan' })
  @ApiResponse({ status: 404, description: 'Plan non trouvé' })
  async getPlan(@Param('id') planId: string) {
    return this.planService.getPlanById(planId);
  }

  @Get(':id/compare/:compareId')
  @ApiOperation({
    summary: 'Comparer deux plans',
    description: 'Comparaison détaillée entre deux plans',
  })
  @ApiParam({ name: 'id', description: 'ID du premier plan' })
  @ApiParam({ name: 'compareId', description: 'ID du second plan' })
  async comparePlans(
    @Param('id') planId: string,
    @Param('compareId') compareId: string,
  ) {
    return this.planService.comparePlans(planId, compareId);
  }
}
