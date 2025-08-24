// apps/app-api/src/ticket/ticket.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  UserEnrichmentService,
  UserInfo,
} from 'src/user-enrichment/user-enrichment.service';
import { TenantPrismaService } from '../services/tenant-prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userEnrichment: UserEnrichmentService,
  ) {}

  async findAll(): Promise<
    (any & { author?: UserInfo; assignedTo?: UserInfo })[]
  > {
    const tickets = await this.tenantPrisma.client.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 🔧 AMÉLIORATION : Enrichissement centralisé
    return this.userEnrichment.enrichEntities(tickets, [
      'authorId',
      'assignedToId',
    ]);
  }

  async findOne(id: string) {
    const ticket = await this.tenantPrisma.client.ticket.findUnique({
      where: { id },
      include: { comments: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    // 🔧 AMÉLIORATION : Enrichissement centralisé
    return this.userEnrichment.enrichEntity(ticket, [
      'authorId',
      'assignedToId',
    ]);
  }

  async create(dto: CreateTicketDto) {
    // 🔧 AMÉLIORATION : Validation centralisée
    const userValidations = await this.userEnrichment.validateUsersMembership([
      dto.authorId,
      ...(dto.assignedToId ? [dto.assignedToId] : []),
    ]);

    if (!userValidations[dto.authorId]) {
      throw new BadRequestException(
        `Author ${dto.authorId} is not a member of this tenant`,
      );
    }

    if (dto.assignedToId && !userValidations[dto.assignedToId]) {
      throw new BadRequestException(
        `Assignee ${dto.assignedToId} is not a member of this tenant`,
      );
    }

    const ticket = await this.tenantPrisma.client.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        authorId: dto.authorId,
        assignedToId: dto.assignedToId,
        priority: dto.priority || 'MEDIUM',
        status: dto.status || 'OPEN',
      },
    });

    return this.userEnrichment.enrichEntity(ticket, [
      'authorId',
      'assignedToId',
    ]);
  }

  async update(id: string, dto: Partial<CreateTicketDto>) {
    // 🔧 AMÉLIORATION : Validation seulement si nécessaire
    if (dto.assignedToId) {
      const isValid = await this.userEnrichment.validateUserMembership(
        dto.assignedToId,
      );
      if (!isValid) {
        throw new BadRequestException(
          `Assignee ${dto.assignedToId} is not a member of this tenant`,
        );
      }
    }

    const ticket = await this.tenantPrisma.client.ticket.update({
      where: { id },
      data: dto,
    });

    return this.userEnrichment.enrichEntity(ticket, [
      'authorId',
      'assignedToId',
    ]);
  }

  async delete(id: string) {
    return this.tenantPrisma.client.ticket.delete({
      where: { id },
    });
  }
}
