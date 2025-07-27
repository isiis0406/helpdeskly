import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { Client } from "pg";

/**
 * Petit helper qui se connecte en super-utilisateur à Postgres
 * et exécute CREATE DATABASE "tenant_<slug>_<random>".
 * Il retourne ensuite l’URL de connexion à cette nouvelle base.
 */
@Injectable()
export class PostgresFactory {
  // URL super-user → on lira dans .env : CONTROL_DATABASE_URL
  private adminUrl: string = process.env.CONTROL_DATABASE_URL!;

  async createDatabase(slug: string): Promise<string> {
    const suffix = crypto.randomBytes(4).toString("hex");
    const dbName = `tenant_${slug}_${suffix}`;

    // 1. Connexion au cluster postgres “global”
    const admin = new Client({ connectionString: this.adminUrl });
    await admin.connect();

    // 2. Création de la DB (template0 = base vide)
    await admin.query(`CREATE DATABASE "${dbName}" TEMPLATE template0;`);
    await admin.end();

    // 3. On renvoie l’URL de connexion à cette DB
    return this.adminUrl.replace("/postgres", `/${dbName}`);
  }
}
