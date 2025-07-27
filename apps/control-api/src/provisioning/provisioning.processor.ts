import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { ControlPrismaService } from "../prisma/control-prisma.service";
import { MigratorService } from "../utils/migrator.service";
import { PostgresFactory } from "../utils/postgres.factory";

@Processor("provisioning")
export class ProvisioningProcessor extends WorkerHost {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(
    private readonly control: ControlPrismaService,
    private readonly migrator: MigratorService,
    private readonly pgFactory: PostgresFactory
  ) {
    super();
  }

  async process(job: Job<{ tenantId: string }>): Promise<void> {
    const { tenantId } = job.data;
    this.logger.log(`🚀 Provisioning tenant ${tenantId}`);

    // 1. Lecture du tenant dans la base centrale
    const tenant = await this.control.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    // 2. Création physique de la DB
    const dbUrl = await this.pgFactory.createDatabase(tenant.slug);

    // 3. Migrations Prisma dans cette nouvelle DB
    await this.migrator.deploy(dbUrl);

    // 4. Mise à jour du tenant (status + dbUrl)
    await this.control.tenant.update({
      where: { id: tenant.id },
      data: { dbUrl, status: "ACTIVE" },
    });

    this.logger.log(`✅ Tenant ${tenant.slug} ACTIVE`);
  }
}
