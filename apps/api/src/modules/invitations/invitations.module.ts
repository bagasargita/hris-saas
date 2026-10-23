import { Module } from '@nestjs/common';
import {
  InvitationAcceptanceController,
  TenantInvitationsController,
} from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  controllers: [TenantInvitationsController, InvitationAcceptanceController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
