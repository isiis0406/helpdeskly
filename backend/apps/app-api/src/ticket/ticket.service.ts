import { TicketPriority, TicketStatus } from '.prisma/tenant'; // ✅ Import Prisma
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrismaService } from '../services/tenant-prisma.service';
import { UserEnrichmentService } from '../user-enrichment/user-enrichment.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userEnrichment: UserEnrichmentService,
  ) {}

  async findAll(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      filters?: any;
      userId?: string;
      userPermissions?: string[];
    } = {},
  ) {
    const {
      page = 1,
      limit = 10,
      search,
      filters = {},
      userId,
      userPermissions = [],
    } = options;
    const skip = (page - 1) * limit;

    // Si l'utilisateur n'a que des permissions limitées, filtrer ses propres tickets
    if (
      !this.hasPermission(userPermissions, 'ticket.read') &&
      this.hasPermission(userPermissions, 'ticket.read.own') &&
      userId
    ) {
      filters.authorId = userId;
    }

    const where: any = { ...filters };
    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.tenantPrisma.client.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { comments: true },
      }),
      this.tenantPrisma.client.ticket.count({ where }),
    ]);

    const enrichedTickets = await this.userEnrichment.enrichEntities(tickets, [
      'authorId',
      'assignedToId',
    ]);

    // Enrichir les commentaires
    const ticketsWithEnrichedComments = await Promise.all(
      enrichedTickets.map(async (ticket) => {
        if (ticket.comments && ticket.comments.length > 0) {
          const enrichedComments = await this.userEnrichment.enrichEntities(
            ticket.comments,
            ['authorId'],
          );
          return { ...ticket, comments: enrichedComments };
        }
        return ticket;
      }),
    );

    return {
      data: ticketsWithEnrichedComments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId?: string, userPermissions: string[] = []) {
    const ticket = await this.tenantPrisma.client.ticket.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    // Vérifier les permissions pour les tickets personnels
    if (
      this.hasPermission(userPermissions, 'ticket.read.own') &&
      !this.hasPermission(userPermissions, 'ticket.read') &&
      ticket.authorId !== userId
    ) {
      throw new NotFoundException('Ticket not found'); // Ne pas révéler l'existence
    }

    const enrichedTicket = await this.userEnrichment.enrichEntity(ticket, [
      'authorId',
      'assignedToId',
    ]);

    // Enrichir les commentaires
    if (enrichedTicket.comments && enrichedTicket.comments.length > 0) {
      const enrichedComments = await this.userEnrichment.enrichEntities(
        enrichedTicket.comments,
        ['authorId'],
      );
      enrichedTicket.comments = enrichedComments;
    }

    return enrichedTicket;
  }

  async create(dto: CreateTicketDto & { authorId: string }) {
    // Validation centralisée
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

  async update(
    id: string,
    dto: UpdateTicketDto,
    userId?: string,
    userPermissions: string[] = [],
  ) {
    const existingTicket = await this.tenantPrisma.client.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      throw new NotFoundException('Ticket not found');
    }

    // Vérifier les permissions pour la modification
    if (
      this.hasPermission(userPermissions, 'ticket.update.own') &&
      !this.hasPermission(userPermissions, 'ticket.update') &&
      existingTicket.authorId !== userId
    ) {
      throw new NotFoundException('Ticket not found'); // Ne pas révéler l'existence
    }

    // Validation seulement si nécessaire
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

  async assign(id: string, assignedToId: string) {
    const isValid =
      await this.userEnrichment.validateUserMembership(assignedToId);
    if (!isValid) {
      throw new BadRequestException(
        `Assignee ${assignedToId} is not a member of this tenant`,
      );
    }

    const ticket = await this.tenantPrisma.client.ticket.update({
      where: { id },
      data: { assignedToId },
    });

    return this.userEnrichment.enrichEntity(ticket, [
      'authorId',
      'assignedToId',
    ]);
  }

  async delete(id: string, userId?: string, userPermissions: string[] = []) {
    const ticket = await this.tenantPrisma.client.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Seuls les admins et propriétaires peuvent supprimer
    if (!this.hasPermission(userPermissions, 'ticket.delete')) {
      throw new BadRequestException(
        'Insufficient permissions to delete ticket',
      );
    }

    return this.tenantPrisma.client.ticket.delete({
      where: { id },
    });
  }

  async getComments(ticketId: string) {
    const comments = await this.tenantPrisma.client.comment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return this.userEnrichment.enrichEntities(comments, ['authorId']);
  }

  async addComment(ticketId: string, data: { body: string; authorId: string }) {
    // Vérifier que le ticket existe
    const ticket = await this.tenantPrisma.client.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Vérifier que l'auteur est membre du tenant
    const isValid = await this.userEnrichment.validateUserMembership(
      data.authorId,
    );
    if (!isValid) {
      throw new BadRequestException(
        `Author ${data.authorId} is not a member of this tenant`,
      );
    }

    const comment = await this.tenantPrisma.client.comment.create({
      data: {
        body: data.body,
        authorId: data.authorId,
        ticketId,
      },
    });

    const enrichedComments = await this.userEnrichment.enrichEntities(
      [comment],
      ['authorId'],
    );
    return enrichedComments[0];
  }

  private hasPermission(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    return (
      userPermissions.includes('*') ||
      userPermissions.includes(requiredPermission)
    );
  }
}
