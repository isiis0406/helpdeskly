import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ControlPrismaService } from "../prisma/control-prisma.service";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "provisioning",
    }),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, ControlPrismaService],
})
export class TenantsModule {}
