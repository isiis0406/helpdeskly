import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { MigratorService } from "../utils/migrator.service";
import { PostgresFactory } from "../utils/postgres.factory";
import { ProvisioningProcessor } from "./provisioning.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "provisioning",
    }),
  ],
  providers: [ProvisioningProcessor, MigratorService, PostgresFactory],
})
export class ProvisioningModule {}
