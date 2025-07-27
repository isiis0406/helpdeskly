// tickets.service.ts
import { Injectable, Req } from '@nestjs/common';
import { Request } from 'express';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  list(@Req() req: Request) {
    return req.tenant!.prisma.ticket.findMany({
      include: { comments: true },
    });
  }
  create(@Req() req: Request, dto: CreateTicketDto) {
    return req.tenant!.prisma.ticket.create({ data: dto });
  }
}
