import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { TenantPrismaService } from '../services/tenant-prisma.service';
import { UserEnrichmentService } from '../user-enrichment/user-enrichment.service';
import { TicketController } from './ticket.controller';
import { TicketsService } from './ticket.service';

@Module({
  imports: [AuthModule], // Importe tout ce qu'il faut pour l'auth et les permissions
  controllers: [TicketController],
  providers: [
    TicketsService,
    TenantPrismaService,
    UserEnrichmentService,
    ControlPrismaService,
  ],
})
export class TicketModule {}
