import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type CsrfResponse,
  type LoginResponse,
  type MeResponse,
  type MessageResponse,
  type TenantContextResponse,
} from '@saas/contracts';
import { type Response } from 'express';
import { Auth, Public, ReqMeta } from '../../common/decorators';
import { AuthRateLimit } from '../../common/decorators/auth-rate-limit';
import {
  type AppRequest,
  type AuthContext,
  type RequestMeta,
} from '../../common/http/request-context';
import { AuthCookiesService } from './auth-cookies.service';
import {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SwitchTenantDto,
  TokenDto,
} from './auth.dto';
import { AuthService } from './auth.service';

const GENERIC_EMAIL_SENT =
  'If the address is eligible, an email with further instructions has been sent.';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  /** Issues a CSRF token bound to the current session (or to the anonymous state). */
  @Public()
  @Get('csrf')
  csrf(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response): CsrfResponse {
    return { csrfToken: this.cookies.issueCsrf(res, req.auth?.session.id ?? null) };
  }

  @Public()
  @AuthRateLimit()
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(@Body() dto: RegisterDto, @ReqMeta() meta: RequestMeta): Promise<MessageResponse> {
    await this.auth.register(dto, meta);
    return {
      message: 'Check your inbox to verify your email address and finish creating your account.',
    };
  }

  @Public()
  @AuthRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: AppRequest,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { session, me } = await this.auth.login(dto, meta, req.auth?.session.id ?? null);
    this.cookies.setSession(res, session.token, session.absoluteExpiresAt);
    const csrfToken = this.cookies.issueCsrf(res, session.id);
    return { ...me, csrfToken };
  }

  @ApiCookieAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Auth() auth: AuthContext,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(auth, meta);
    this.cookies.clearSession(res);
    this.cookies.issueCsrf(res, null);
  }

  @ApiCookieAuth()
  @Get('me')
  me(@Auth() auth: AuthContext): Promise<MeResponse> {
    return this.auth.me(auth.user.id, auth.session.activeTenantId);
  }

  @ApiCookieAuth()
  @Post('active-tenant')
  @HttpCode(HttpStatus.OK)
  switchTenant(
    @Auth() auth: AuthContext,
    @Body() dto: SwitchTenantDto,
  ): Promise<TenantContextResponse> {
    return this.auth.switchTenant(auth, dto.tenantId);
  }

  @Public()
  @AuthRateLimit()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: TokenDto, @ReqMeta() meta: RequestMeta): Promise<MessageResponse> {
    await this.auth.verifyEmail(dto.token, meta);
    return { message: 'Your email address has been verified. You can now sign in.' };
  }

  @Public()
  @AuthRateLimit()
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: EmailDto): Promise<MessageResponse> {
    await this.auth.resendVerification(dto.email);
    return { message: GENERIC_EMAIL_SENT };
  }

  @Public()
  @AuthRateLimit()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body() dto: EmailDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<MessageResponse> {
    await this.auth.requestPasswordReset(dto.email, meta);
    return { message: GENERIC_EMAIL_SENT };
  }

  @Public()
  @AuthRateLimit()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<MessageResponse> {
    await this.auth.resetPassword(dto, meta);
    return { message: 'Your password has been reset. Sign in with your new password.' };
  }
}
