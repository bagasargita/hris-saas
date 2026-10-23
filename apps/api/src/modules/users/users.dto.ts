import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, trim } from '../auth/auth.dto';

export class UpdateProfileDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
