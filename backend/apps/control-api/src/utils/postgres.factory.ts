import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

/**
 * Helper qui se connecte en super-utilisateur à Postgres
 * et exécute CREATE DATABASE "<dbName>".
 * Retourne l'URL de connexion à cette nouvelle base.
 */
@Injectable()
export class PostgresFactory {
  private readonly logger = new Logger(PostgresFactory.name);
  // URL super-user → on lira dans .env : CONTROL_DATABASE_URL
  private readonly adminUrl: string;

  constructor(private readonly config: ConfigService) {
    this.adminUrl = this.config.get<string>('CONTROL_DATABASE_URL')!;

    if (!this.adminUrl) {
      throw new Error('CONTROL_DATABASE_URL is required');
    }
  }

  async createDatabase(dbName: string): Promise<string> {
    this.logger.log(`Creating database: ${dbName}`);

    try {
      // 1. Connexion au cluster postgres "global"
      const admin = new Client({ connectionString: this.adminUrl });
      await admin.connect();

      // 2. Création de la DB (template0 = base vide)
      await admin.query(`CREATE DATABASE "${dbName}" TEMPLATE template0;`);
      await admin.end();

      // 3. On renvoie l'URL de connexion à cette DB
      const newDbUrl = this.adminUrl.replace('/postgres', `/${dbName}`);
      this.logger.log(`Database created successfully: ${dbName}`);

      return newDbUrl;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create database ${dbName}`, {
        error: errorMessage,
      });
      throw new Error(`Database creation failed: ${errorMessage}`);
    }
  }

  // 🆕 NOUVELLE MÉTHODE : Vérifier si une base existe
  async databaseExists(dbName: string): Promise<boolean> {
    try {
      const admin = new Client({ connectionString: this.adminUrl });
      await admin.connect();

      // Requête pour vérifier l'existence de la base
      const result = await admin.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName],
      );

      await admin.end();

      const exists = result.rows.length > 0;
      this.logger.debug(`Database ${dbName} exists: ${exists}`);

      return exists;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check database existence: ${dbName}`, {
        error: errorMessage,
      });
      return false; // En cas d'erreur, on assume que la DB n'existe pas
    }
  }

  // 🆕 NOUVELLE MÉTHODE : Supprimer une base (utile pour cleanup)
  async dropDatabase(dbName: string): Promise<void> {
    this.logger.log(`Dropping database: ${dbName}`);

    try {
      const admin = new Client({ connectionString: this.adminUrl });
      await admin.connect();

      // Fermer toutes les connexions actives à la DB avant suppression
      await admin.query(
        `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `,
        [dbName],
      );

      // Suppression de la base
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await admin.end();

      this.logger.log(`Database dropped successfully: ${dbName}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to drop database ${dbName}`, {
        error: errorMessage,
      });
      throw new Error(`Database deletion failed: ${errorMessage}`);
    }
  }

  // 🆕 NOUVELLE MÉTHODE : Lister toutes les bases tenant
  async listTenantDatabases(): Promise<string[]> {
    try {
      const admin = new Client({ connectionString: this.adminUrl });
      await admin.connect();

      // Lister toutes les bases qui commencent par "tenant_"
      const result = await admin.query<{ datname: string }>(`
        SELECT datname 
        FROM pg_database 
        WHERE datname LIKE 'tenant_%'
        ORDER BY datname
      `);

      await admin.end();

      return result.rows.map((row) => row.datname);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to list tenant databases', {
        error: errorMessage,
      });
      return [];
    }
  }

  // 🆕 NOUVELLE MÉTHODE : Test de connexion à une base spécifique
  async testConnection(dbUrl: string): Promise<boolean> {
    try {
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();

      return true;
    } catch {
      this.logger.debug(
        `Connection test failed for URL: ${this.maskUrl(dbUrl)}`,
      );
      return false;
    }
  }

  // Helper pour masquer les credentials dans les logs
  private maskUrl(url: string): string {
    return url.replace(/:\/\/[^@]+@/, '://***:***@');
  }
}
