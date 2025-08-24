import { Injectable, Logger } from '@nestjs/common';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { TenantPrismaService } from '../services/tenant-prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly controlPrisma: ControlPrismaService,
  ) {}

  async findAll() {
    const tickets = await this.tenantPrisma.client.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Enrichissement avec les données utilisateur depuis control
    return this.enrichTicketsWithUsers(tickets);
  }

  async findOne(id: string) {
    const ticket = await this.tenantPrisma.client.ticket.findUnique({
      where: { id },
      include: { comments: true },
    });

    if (!ticket) {
      throw new Error(`Ticket ${id} not found`);
    }

    return this.enrichTicketWithUsers(ticket);
  }

  async create(dto: CreateTicketDto) {
    // Validation que l'auteur existe dans le tenant courant
    await this.validateUserMembership(dto.authorId);

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

    return this.enrichTicketWithUsers(ticket);
  }

  async update(id: string, dto: Partial<CreateTicketDto>) {
    // Validation des utilisateurs si modifiés
    if (dto.assignedToId) {
      await this.validateUserMembership(dto.assignedToId);
    }

    const ticket = await this.tenantPrisma.client.ticket.update({
      where: { id },
      data: dto,
    });

    return this.enrichTicketWithUsers(ticket);
  }

  async delete(id: string) {
    return this.tenantPrisma.client.ticket.delete({
      where: { id },
    });
  }

  // Méthodes privées pour enrichissement des données
  private async enrichTicketsWithUsers(tickets: any[]) {
    const userIds = [
      ...tickets.map((t) => t.authorId),
      ...tickets.map((t) => t.assignedToId).filter(Boolean),
    ];

    const users = await this.getUsersByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return tickets.map((ticket) => ({
      ...ticket,
      author: userMap.get(ticket.authorId),
      assignedTo: ticket.assignedToId ? userMap.get(ticket.assignedToId) : null,
    }));
  }

  private async enrichTicketWithUsers(ticket: any) {
    const userIds = [ticket.authorId, ticket.assignedToId].filter(Boolean);
    const users = await this.getUsersByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      ...ticket,
      author: userMap.get(ticket.authorId),
      assignedTo: ticket.assignedToId ? userMap.get(ticket.assignedToId) : null,
    };
  }

  private async getUsersByIds(userIds: string[]) {
    if (userIds.length === 0) return [];

    return this.controlPrisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatar: true },
    });
  }

  private async validateUserMembership(userId: string) {
    const tenant = this.tenantPrisma.getTenantInfo();

    const membership = await this.controlPrisma.membership.findFirst({
      where: {
        userId,
        tenantId: tenant.id,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error(
        `User ${userId} is not a member of tenant ${tenant.slug}`,
      );
    }

    return membership;
  }
}
