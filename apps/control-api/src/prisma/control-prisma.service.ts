import { PrismaClient as ControlPrismaClient } from '.prisma/control';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ControlPrismaService
  extends ControlPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
