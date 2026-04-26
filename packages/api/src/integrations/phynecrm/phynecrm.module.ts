import { Module } from '@nestjs/common';

import { PhyneCrmRelayService } from './phynecrm-relay.service';
import { PhyneCrmWebhookController } from './phynecrm-webhook.controller';
import { PhyneCrmWebhookService } from './phynecrm-webhook.service';

@Module({
  controllers: [PhyneCrmWebhookController],
  providers: [PhyneCrmWebhookService, PhyneCrmRelayService],
  exports: [PhyneCrmWebhookService, PhyneCrmRelayService],
})
export class PhyneCrmModule {}
