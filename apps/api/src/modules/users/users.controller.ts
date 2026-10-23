import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { type SessionDto, type UserDto } from '@saas/contracts';
import { Auth, ReqMeta } from '../../common/decorators';
import { type AuthContext, type RequestMeta } from '../../common/http/request-context';
import { ChangePasswordDto, UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  updateProfile(
    @Auth() auth: AuthContext,
    @Body() dto: UpdateProfileDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<UserDto> {
    return this.users.updateProfile(auth, dto, meta);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Auth() auth: AuthContext,
    @Body() dto: ChangePasswordDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.users.changePassword(auth, dto, meta);
  }

  @Get('sessions')
  listSessions(@Auth() auth: AuthContext): Promise<SessionDto[]> {
    return this.users.listSessions(auth);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOthers(
    @Auth() auth: AuthContext,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ revoked: number }> {
    return { revoked: await this.users.revokeOtherSessions(auth, meta) };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @Auth() auth: AuthContext,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.users.revokeSession(auth, sessionId, meta);
  }
}
