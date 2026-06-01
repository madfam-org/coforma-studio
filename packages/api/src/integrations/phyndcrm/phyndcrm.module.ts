import { Module } from '@nestjs/common';

import { PhyndCrmRelayService } from './phyndcrm-relay.service';
import { PhyndCrmWebhookController } from './phyndcrm-webhook.controller';
import { PhyndCrmWebhookService } from './phyndcrm-webhook.service';

@Module({
  controllers: [PhyndCrmWebhookController],
  providers: [PhyndCrmWebhookService, PhyndCrmRelayService],
  exports: [PhyndCrmWebhookService, PhyndCrmRelayService],
})
export class PhyndCrmModule {}
