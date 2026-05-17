import { ApiProperty } from '@nestjs/swagger';

export class UploadPhotoResponseDto {
  @ApiProperty({ example: 'http://localhost:3000/uploads/users/uuid/uuid.jpg' })
  photoUrl!: string;
}
