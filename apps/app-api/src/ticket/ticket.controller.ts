import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { PermissionsService } from 'src/auth/permissions.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { TenantJwtGuard } from '../auth/guards/tenant-jwt.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketsService, UpdateTicketDto } from './ticket.service';

@Controller('tickets')
@UseGuards(TenantJwtGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TicketController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @Permissions('ticket.read', 'ticket.read.own')
  async findAll(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('authorId') authorId?: string,
  ) {
    const filters: any = {};

    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (assignedToId) filters.assignedToId = assignedToId;
    if (authorId) filters.authorId = authorId;

    return this.ticketsService.findAll({
      page,
      limit,
      filters,
      userId: req.user.id,
      userPermissions: req.user.permissions,
    });
  }

  @Get(':id')
  @Permissions('ticket.read', 'ticket.read.own')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.ticketsService.findOne(id, req.user.id, req.user.permissions);
  }

  @Post()
  @Permissions('ticket.create')
  async create(@Body() createTicketDto: CreateTicketDto, @Request() req) {
    return this.ticketsService.create({
      ...createTicketDto,
      authorId: req.user.id,
    });
  }

  @Put(':id')
  @Permissions('ticket.update', 'ticket.update.own')
  async update(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req,
  ) {
    return this.ticketsService.update(
      id,
      updateTicketDto,
      req.user.id,
      req.user.permissions,
    );
  }

  @Put(':id/assign')
  @Permissions('ticket.assign')
  async assign(
    @Param('id') id: string,
    @Body('assignedToId') assignedToId: string,
    @Request() req,
  ) {
    return this.ticketsService.assign(id, assignedToId);
  }

  @Delete(':id')
  @Permissions('ticket.delete')
  async delete(@Param('id') id: string, @Request() req) {
    return this.ticketsService.delete(id, req.user.id, req.user.permissions);
  }

  @Get(':id/comments')
  @Permissions('comment.read')
  async getComments(@Param('id') id: string) {
    return this.ticketsService.getComments(id);
  }

  @Post(':id/comments')
  @Permissions('comment.create')
  async addComment(
    @Param('id') id: string,
    @Body('body') body: string,
    @Request() req,
  ) {
    return this.ticketsService.addComment(id, {
      body,
      authorId: req.user.id,
    });
  }
}
