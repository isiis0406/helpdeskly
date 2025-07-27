import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ProvisioningModule } from "./provisioning/provisioning.module";
import { TenantsModule } from "./tenants/tenants.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: "localhost", // ou l’URL de votre Redis
        port: 6379,
      },
    }),
    TenantsModule,
    ProvisioningModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
