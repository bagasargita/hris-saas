import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { MailService } from './mail.service';
import {
  LogMailTransport,
  MAIL_TRANSPORT,
  type MailTransport,
  SmtpMailTransport,
} from './mail.transport';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [AppConfig],
      useFactory: (config: AppConfig): MailTransport =>
        config.env.mail.smtpUrl
          ? new SmtpMailTransport(config.env.mail.smtpUrl, config.env.mail.from)
          : new LogMailTransport(),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
