import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export class EmailDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class RegisterDto extends EmailDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class LoginDto extends EmailDto {
  /** No minimum length here: login must not reveal the password policy or differ by input. */
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password!: string;
}

export class TokenDto {
  @IsString()
  @Length(20, 128)
  token!: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class SwitchTenantDto {
  @IsUUID()
  tenantId!: string;
}

export { normalizeEmail, trim };
