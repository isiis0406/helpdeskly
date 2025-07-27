import { Injectable, Logger } from "@nestjs/common";
import { execa } from "execa";
import * as path from "path";

/**
 * Service qui applique les migrations Prisma sur une URL donnée.
 * Il appelle simplement `prisma migrate deploy --schema prisma/tenant/schema.prisma`
 * avec DATABASE_URL pointant vers la base du tenant.
 */
@Injectable()
export class MigratorService {
  private readonly logger = new Logger(MigratorService.name);
  // Chemin absolu vers le schema des tenants
  private readonly tenantSchemaPath =
    process.env.TENANT_SCHEMA_PATH ??
    path.resolve("../../prisma/tenant/schema.prisma");

  async deploy(dbUrl: string) {
    this.logger.log(`Running migrations on ${dbUrl}`);
    this.logger.log(`Using schema at ${this.tenantSchemaPath}`);
    await execa(
      "npx",
      ["prisma", "migrate", "deploy", "--schema", this.tenantSchemaPath],
      {
        cwd: path.resolve(__dirname, "../../../.."), // repo root
        env: { DATABASE_URL: dbUrl },
        stdio: "inherit",
      }
    );
  }

  async seed(dbUrl: string) {
    // Optionnel : ici tu pourrais exécuter un script seed
    // await execa('node', ['prisma/tenant/seed.cjs'], { env:{ DATABASE_URL: dbUrl }});
  }
}
