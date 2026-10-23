import { Global, Module } from '@nestjs/common';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfService } from './csrf.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { UserTokenService } from './user-token.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookiesService,
    CsrfService,
    PasswordService,
    SessionService,
    UserTokenService,
  ],
  exports: [AuthCookiesService, CsrfService, PasswordService, SessionService],
})
export class AuthModule {}
