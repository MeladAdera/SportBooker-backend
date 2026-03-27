import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AccountDeletedResponseDto } from './dto/account-deleted-response.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from './user-role';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
@Roles('super_admin', 'tenant_admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Roles(
    UserRole.SuperAdmin,
    UserRole.TenantAdmin,
    UserRole.TenantStaff,
    UserRole.Player,
  )
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the authenticated user’s profile for this tenant (from JWT). Soft-deleted users receive 401.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile',
    type: MyProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or soft-deleted user',
  })
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyProfileResponseDto> {
    return this.usersService.getMyProfile({
      tenantId: user.tenantId,
      userId: user.sub,
    });
  }

  @Patch('me')
  @Roles(
    UserRole.SuperAdmin,
    UserRole.TenantAdmin,
    UserRole.TenantStaff,
    UserRole.Player,
  )
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Optional name, phone, and photoUrl. Other fields are ignored (whitelist). Returns the updated profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated profile',
    type: MyProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or soft-deleted user',
  })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @ApiBody({ type: UpdateMyProfileDto })
  async updateMyProfile(
    @Body() dto: UpdateMyProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyProfileResponseDto> {
    return this.usersService.updateMyProfile({
      tenantId: user.tenantId,
      userId: user.sub,
      dto,
    });
  }

  @Delete('me')
  @Roles(UserRole.Player)
  @ApiOperation({
    summary: 'Delete my account (soft delete)',
    description:
      'Sets deleted_at and is_active=false, removes refresh tokens. Blocked if you have confirmed bookings for future matches.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account soft-deleted',
    type: AccountDeletedResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or account already inactive/deleted',
  })
  @ApiResponse({
    status: 403,
    description: 'Only players may call this endpoint',
  })
  @ApiResponse({
    status: 409,
    description: 'Has confirmed upcoming bookings — cancel them first',
  })
  async deleteMyAccount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccountDeletedResponseDto> {
    return this.usersService.deleteMyAccount({
      tenantId: user.tenantId,
      userId: user.sub,
    });
  }

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
