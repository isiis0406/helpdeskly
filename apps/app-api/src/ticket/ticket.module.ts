import { Module } from '@nestjs/common';
import { TicketsController } from './ticket.controller';
import { TicketsService } from './ticket.service';

@Module({
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketModule {}
