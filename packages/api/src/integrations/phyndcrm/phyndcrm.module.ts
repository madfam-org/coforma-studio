import { Module } from '@nestjs/common';

import { PhyneCrmRelayService } from './phyndcrm-relay.service';
import { PhyneCrmWebhookController } from './phyndcrm-webhook.controller';
import { PhyneCrmWebhookService } from './phyndcrm-webhook.service';

@Module({
  controllers: [PhyneCrmWebhookController],
  providers: [PhyneCrmWebhookService, PhyneCrmRelayService],
  exports: [PhyneCrmWebhookService, PhyneCrmRelayService],
})
export class PhyneCrmModule {}
