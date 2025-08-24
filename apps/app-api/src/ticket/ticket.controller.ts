import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketsService } from './ticket.service';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  async findAll() {
    return this.ticketsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  async create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTicketDto: Partial<CreateTicketDto>,
  ) {
    return this.ticketsService.update(id, updateTicketDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.ticketsService.delete(id);
  }
}
