import { Module } from '@nestjs/common';

import { LoggerModule } from '../../lib/logger/logger.module';
import { TulanaCabEventWebhookService } from './cab-event-webhook.service';

/**
 * TulanaModule — outbound integration with Tulana per ADR-003.
 *
 * Currently exports the CAB-event webhook service. Other Tulana surfaces
 * (e.g. inbound read API consumers) would land here too.
 *
 * Wire this module into AppModule once a feature module wants to call
 * TulanaCabEventWebhookService (e.g. SessionModule when COMPLETE transitions
 * are wired to dispatch the webhook).
 */
@Module({
  imports: [LoggerModule],
  providers: [TulanaCabEventWebhookService],
  exports: [TulanaCabEventWebhookService],
})
export class TulanaModule {}
