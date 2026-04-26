import { Module } from '@nestjs/common';

import { PhyneCrmWebhookController } from './phynecrm-webhook.controller';
import { PhyneCrmWebhookService } from './phynecrm-webhook.service';

@Module({
  controllers: [PhyneCrmWebhookController],
  providers: [PhyneCrmWebhookService],
  exports: [PhyneCrmWebhookService],
})
export class PhyneCrmModule {}
