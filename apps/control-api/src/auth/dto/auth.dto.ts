import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email must be valid' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Tenant slug must contain only lowercase letters, numbers and hyphens',
  })
  tenantSlug?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Email must be valid' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(1, { message: 'Refresh token is required' })
  refreshToken!: string;
}

export class SwitchTenantDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Tenant slug must contain only lowercase letters, numbers and hyphens',
  })
  tenantSlug!: string;
}
