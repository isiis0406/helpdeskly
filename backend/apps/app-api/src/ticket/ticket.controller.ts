import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { TenantJwtGuard } from '../auth/guards/tenant-jwt.guard';

import { AddCommentDto } from './dto/add-comment.dto'; // ✅ AJOUT
import { AssignTicketDto } from './dto/assign-ticket.dto'; // ✅ AJOUT
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketsService, UpdateTicketDto } from './ticket.service';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(TenantJwtGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-slug')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TicketController {
  constructor(private readonly ticketService: TicketsService) {} // ✅ Nom corrigé

  // ================================
  // 📝 CRÉATION DE TICKETS
  // ================================

  @Post()
  @RequirePermissions('ticket.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '🎫 Créer un nouveau ticket',
    description: `
      Crée un nouveau ticket de support dans le tenant courant.
      
      **Permissions requises :** \`ticket.create\`
      
      Le ticket sera automatiquement assigné au créateur et aura un statut "OPEN".
    `,
  })
  @ApiCreatedResponse({
    description: 'Ticket créé avec succès',
    schema: {
      example: {
        id: 'ticket-123',
        title: 'Problème de connexion',
        description: "Je n'arrive pas à me connecter depuis ce matin",
        status: 'OPEN',
        priority: 'MEDIUM',
        authorId: 'user-456',
        author: {
          id: 'user-456',
          name: 'John Doe',
          email: 'john@example.com',
        },
        assignedToId: null,
        assignedTo: null,
        createdAt: '2024-08-26T17:30:00.000Z',
        updatedAt: '2024-08-26T17:30:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiUnauthorizedResponse({ description: 'Token invalide ou manquant' })
  @ApiForbiddenResponse({ description: 'Permissions insuffisantes' })
  async create(@Body() createTicketDto: CreateTicketDto, @Request() req) {
    return this.ticketService.create({
      ...createTicketDto,
      authorId: req.user.id,
    });
  }

  // ================================
  // 📋 CONSULTATION DES TICKETS
  // ================================

  @Get()
  @RequirePermissions('ticket.read', 'ticket.read.own')
  @ApiOperation({
    summary: '📋 Lister les tickets',
    description: `
      Récupère la liste des tickets selon les permissions de l'utilisateur.
      
      **Permissions :**
      - \`ticket.read\` : Voir tous les tickets du tenant
      - \`ticket.read.own\` : Voir seulement ses propres tickets
    `,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Recherche texte (titre, description)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  })
  @ApiQuery({ name: 'assignedToId', required: false, type: String })
  @ApiQuery({ name: 'assignee', required: false, type: String, description: "Recherche par nom/email de l'assigné" })
  @ApiOkResponse({ description: 'Liste des tickets avec pagination' })
  async findAll(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('assignee') assignee?: string,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (assignedToId) filters.assignedToId = assignedToId;

    return this.ticketService.findAll({
      page,
      limit,
      search: q,
      filters,
      assignee,
      userId: req.user.id,
      userPermissions: req.user.permissions || [],
    });
  }

  @Get(':id')
  @RequirePermissions('ticket.read', 'ticket.read.own')
  @ApiOperation({
    summary: "🔍 Détails d'un ticket",
    description:
      "Récupère les détails complets d'un ticket avec commentaires enrichis.",
  })
  @ApiParam({ name: 'id', description: 'ID du ticket' })
  @ApiOkResponse({ description: 'Détails complets du ticket' })
  @ApiNotFoundResponse({ description: 'Ticket non trouvé' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.ticketService.findOne(
      id,
      req.user.id,
      req.user.permissions || [],
    );
  }

  // ================================
  // ✏️ MODIFICATION DES TICKETS
  // ================================

  @Patch(':id')
  @RequirePermissions('ticket.update', 'ticket.update.own')
  @ApiOperation({
    summary: '✏️ Modifier un ticket',
    description: `
      Met à jour les informations d'un ticket.
      
      **Permissions :**
      - \`ticket.update\` : Modifier n'importe quel ticket du tenant
      - \`ticket.update.own\` : Modifier seulement ses propres tickets
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du ticket à modifier' })
  @ApiOkResponse({ description: 'Ticket mis à jour avec succès' })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiNotFoundResponse({ description: 'Ticket non trouvé' })
  async update(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req,
  ) {
    return this.ticketService.update(
      id,
      updateTicketDto,
      req.user.id,
      req.user.permissions || [],
    );
  }

  // ✅ CORRECTION: Endpoint assign avec DTO approprié
  @Patch(':id/assign')
  @RequirePermissions('ticket.assign')
  @ApiOperation({
    summary: '👤 Assigner un ticket',
    description: `
      Assigne un ticket à un utilisateur membre du tenant.
      
      **Permission requise :** \`ticket.assign\`
      
      L'assigné doit être un membre actif du tenant courant.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du ticket à assigner' })
  @ApiOkResponse({
    description: 'Ticket assigné avec succès',
    schema: {
      example: {
        id: 'ticket-123',
        title: 'Problème de connexion',
        assignedToId: 'user-789',
        assignedTo: {
          id: 'user-789',
          name: 'Support Agent',
          email: 'support@example.com',
        },
        updatedAt: '2024-08-26T18:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Utilisateur non membre du tenant' })
  @ApiNotFoundResponse({ description: 'Ticket non trouvé' })
  async assignTicket(
    @Param('id') id: string,
    @Body() assignTicketDto: AssignTicketDto, // ✅ DTO corrigé
    @Request() req,
  ) {
    return this.ticketService.assign(id, assignTicketDto.assignedToId, req.user.id, req.user.permissions || []);
  }

  @Delete(':id')
  @RequirePermissions('ticket.delete')
  @ApiOperation({
    summary: '🗑️ Supprimer un ticket',
    description: `
      Supprime définitivement un ticket et tous ses commentaires.
      
      **Permission requise :** \`ticket.delete\`
      
      ⚠️ **Attention :** Cette action est irréversible !
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du ticket à supprimer' })
  @ApiOkResponse({ description: 'Ticket supprimé avec succès' })
  @ApiForbiddenResponse({ description: 'Permissions insuffisantes' })
  @ApiNotFoundResponse({ description: 'Ticket non trouvé' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.ticketService.delete(
      id,
      req.user.id,
      req.user.permissions || [],
    );
  }

  // ================================
  // 💬 GESTION DES COMMENTAIRES
  // ================================

  @Get(':id/comments')
  @RequirePermissions('ticket.read', 'ticket.read.own')
  @ApiOperation({
    summary: "💬 Lister les commentaires d'un ticket",
    description:
      "Récupère tous les commentaires d'un ticket avec les auteurs enrichis.",
  })
  @ApiParam({ name: 'id', description: 'ID du ticket' })
  @ApiOkResponse({
    description: 'Liste des commentaires enrichis',
    schema: {
      example: [
        {
          id: 'comment-789',
          body: 'Merci pour votre ticket, nous regardons cela.',
          author: {
            id: 'user-101',
            name: 'Support Agent',
            email: 'support@example.com',
          },
          ticketId: 'ticket-123',
          createdAt: '2024-08-26T17:35:00.000Z',
          updatedAt: '2024-08-26T17:35:00.000Z',
        },
      ],
    },
  })
  async getComments(@Param('id') ticketId: string, @Request() req) {
    // Vérifier d'abord que l'utilisateur peut accéder au ticket
    await this.ticketService.findOne(
      ticketId,
      req.user.id,
      req.user.permissions || [],
    );

    return this.ticketService.getComments(ticketId);
  }

  // Endpoint addComment avec DTO approprié
  @Post(':id/comments')
  @RequirePermissions('comment.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '💬 Ajouter un commentaire',
    description: `
      Ajoute un commentaire à un ticket.
      
      **Permission requise :** \`comment.create\`
      
      Le commentaire sera automatiquement attribué à l'utilisateur connecté.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du ticket' })
  @ApiCreatedResponse({
    description: 'Commentaire ajouté avec succès',
    schema: {
      example: {
        id: 'comment-789',
        body: 'Merci pour votre ticket, nous regardons cela.',
        author: {
          id: 'user-101',
          name: 'Support Agent',
          email: 'support@example.com',
        },
        ticketId: 'ticket-123',
        createdAt: '2024-08-26T17:35:00.000Z',
        updatedAt: '2024-08-26T17:35:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Contenu du commentaire invalide' })
  @ApiNotFoundResponse({ description: 'Ticket non trouvé' })
  async addComment(
    @Param('id') ticketId: string,
    @Body() addCommentDto: AddCommentDto, // ✅ DTO corrigé
    @Request() req,
  ) {
    return this.ticketService.addComment(ticketId, {
      body: addCommentDto.body, // ✅ Utilisation correcte
      authorId: req.user.id,
    });
  }

  // ✏️ Modifier un commentaire (auteur uniquement)
  @Patch(':id/comments/:commentId')
  @RequirePermissions('comment.update', 'comment.update.own')
  @ApiOperation({ summary: '✏️ Modifier un commentaire (auteur)' })
  async updateComment(
    @Param('id') ticketId: string,
    @Param('commentId') commentId: string,
    @Body() dto: { body: string },
    @Request() req,
  ) {
    return this.ticketService.updateComment(ticketId, commentId, req.user.id, dto.body)
  }

  // 🗑️ Supprimer un commentaire (auteur uniquement)
  @Delete(':id/comments/:commentId')
  @RequirePermissions('comment.delete', 'comment.delete.own')
  @ApiOperation({ summary: '🗑️ Supprimer un commentaire (auteur)' })
  async deleteComment(
    @Param('id') ticketId: string,
    @Param('commentId') commentId: string,
    @Request() req,
  ) {
    return this.ticketService.deleteComment(ticketId, commentId, req.user.id)
  }
}
