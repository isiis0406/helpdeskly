// apps/control-api/src/tenants/tenants.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {
    console.log('🔧 TenantsController constructor called');
  }

  @Post()
  async createTenant(@Body() dto: CreateTenantDto) {
    try {
      const result = await this.tenantsService.createTenant(dto);
      console.log('✅ Service succeeded:', result);
      return result;
    } catch (error) {
      console.log(
        '❌ Service failed:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
