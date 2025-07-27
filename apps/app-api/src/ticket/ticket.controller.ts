// tickets.controller.ts
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketsService } from './ticket.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateTicketDto) {
    return this.service.create(req, dto);
  }
}
