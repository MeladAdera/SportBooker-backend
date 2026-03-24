import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
@Roles('super_admin', 'tenant_admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':userId/role')
  @ApiOperation({
    summary: 'Assign role to a user in the current tenant',
    description:
      'Requires super_admin or tenant_admin. Target user must belong to the same tenant. tenant_admin cannot change users with super_admin role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated user',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot demote yourself' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions for this assignment',
  })
  @ApiResponse({ status: 404, description: 'User not found in tenant' })
  async assignRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.assignRole({
      actorUserId: user.sub,
      actorRole: user.role,
      tenantId: user.tenantId,
      targetUserId: userId,
      newRole: dto.role,
    });
  }
}
