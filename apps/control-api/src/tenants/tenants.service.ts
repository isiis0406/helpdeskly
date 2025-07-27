import { PrismaClient as ControlPrismaService } from ".prisma/control"; // Adjust the import path as necessary
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { addDays } from "date-fns";
import { CreateTenantDto } from "./dto/create-tenant.dto";

import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: ControlPrismaService,
    private readonly config: ConfigService,
    @InjectQueue("provisioning") private readonly queue: Queue
  ) {}

  async createTenant(dto: CreateTenantDto) {
    const trialDays = dto.trialDays ?? 14; // fallback si undefined

    const tenant = await this.prisma.tenant.create({
      data: {
        slug: dto.slug,
        dbUrl: "", // TODO: Generate appropriate database URL
        status: "PROVISIONING",
        trialEndsAt: addDays(new Date(), trialDays),
      },
    });

    await this.queue.add("provision-tenant", { tenantId: tenant.id });

    return {
      id: tenant.id,
      url: `https://${tenant.slug}.${this.config.get<string>("BASE_DOMAIN")}`,
    };
  }
}
