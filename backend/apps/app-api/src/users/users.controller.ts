import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { TenantJwtGuard } from '../auth/guards/tenant-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';

@ApiTags('Users')
@Controller('users')
@UseGuards(TenantJwtGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-slug')
export class UsersController {
  constructor(private readonly controlPrisma: ControlPrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les membres du tenant courant' })
  @ApiOkResponse({ description: 'Liste des utilisateurs avec rôle' })
  async listMembers(@Request() req: any) {
    const tenantId = req.tenantId || req?.tenantContext?.id || req?.tenant?.id;
    const memberships = await this.controlPrisma.membership.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            isActive: true,
          },
        },
      },
      orderBy: { role: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      isActive: m.user.isActive,
      role: m.role,
    }));
  }
}

