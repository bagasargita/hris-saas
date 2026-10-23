import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type InvitationDto,
  type InvitationImportResultDto,
  type InvitationPreviewDto,
  type Paginated,
  type TenantContextResponse,
} from '@saas/contracts';
import {
  Auth,
  Public,
  ReqMeta,
  RequirePermissions,
  Tenant,
  TenantScoped,
} from '../../common/decorators';
import { AuthRateLimit } from '../../common/decorators/auth-rate-limit';
import { AppException } from '../../common/errors/app-exception';
import {
  type AuthContext,
  type RequestMeta,
  type TenantContext,
} from '../../common/http/request-context';
import { TokenDto } from '../auth/auth.dto';
import { INVITATION_CSV_TEMPLATE, INVITATION_IMPORT_MAX_BYTES } from './invitation-csv';
import { CreateInvitationDto, ListInvitationsQueryDto } from './invitations.dto';
import { InvitationsService } from './invitations.service';

/** Shape produced by multer memory storage (FileInterceptor). */
interface UploadedCsvFile {
  buffer: Buffer;
  size: number;
  mimetype?: string;
  originalname?: string;
}

@ApiTags('invitations')
@TenantScoped('members.read')
@Controller('tenants/:tenantId/invitations')
export class TenantInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: ListInvitationsQueryDto,
  ): Promise<Paginated<InvitationDto>> {
    return this.invitations.list(tenant.tenant.id, query);
  }

  /** Downloadable CSV template for bulk invites (`email`, `role` columns). */
  @RequirePermissions('members.invite')
  @Get('import-template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="member-invitations-template.csv"')
  @Header('Cache-Control', 'no-store')
  importTemplate(): string {
    return INVITATION_CSV_TEMPLATE;
  }

  @RequirePermissions('members.invite')
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: INVITATION_IMPORT_MAX_BYTES, files: 1 },
    }),
  )
  importCsv(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @ReqMeta() meta: RequestMeta,
  ): Promise<InvitationImportResultDto> {
    if (!file) throw AppException.badRequest('Choose a CSV file to upload (field name: file)');
    return this.invitations.importCsv(tenant, auth, file, meta);
  }

  @RequirePermissions('members.invite')
  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Body() dto: CreateInvitationDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<InvitationDto> {
    return this.invitations.create(tenant, auth, dto, meta);
  }

  @RequirePermissions('members.invite')
  @Post(':invitationId/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<InvitationDto> {
    return this.invitations.revoke(tenant, auth.user.id, invitationId, meta);
  }

  @RequirePermissions('members.invite')
  @Post(':invitationId/resend')
  @HttpCode(HttpStatus.OK)
  resend(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<InvitationDto> {
    return this.invitations.resend(tenant, auth, invitationId, meta);
  }
}

/** Token-based endpoints. Tokens travel in request bodies so they never appear in URLs or access logs. */
@ApiTags('invitations')
@Controller('invitations')
export class InvitationAcceptanceController {
  constructor(private readonly invitations: InvitationsService) {}

  @Public()
  @AuthRateLimit()
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: TokenDto): Promise<InvitationPreviewDto> {
    return this.invitations.preview(dto.token);
  }

  @ApiCookieAuth()
  @AuthRateLimit()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Auth() auth: AuthContext,
    @Body() dto: TokenDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<TenantContextResponse> {
    return this.invitations.accept(auth, dto.token, meta);
  }
}
