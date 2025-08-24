import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketsService } from './ticket.service';

@Module({
  providers: [TicketsService],
  controllers: [TicketController],
})
export class TicketModule {}
