import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ASSIGNABLE_ROLE_VALUES } from '../user-role';

export class AssignRoleDto {
  @ApiProperty({
    enum: ASSIGNABLE_ROLE_VALUES,
    example: 'tenant_staff',
    description: 'New role for the user within the tenant',
  })
  @IsIn(ASSIGNABLE_ROLE_VALUES, {
    message: `role must be one of: ${ASSIGNABLE_ROLE_VALUES.join(', ')}`,
  })
  role!: (typeof ASSIGNABLE_ROLE_VALUES)[number];
}
