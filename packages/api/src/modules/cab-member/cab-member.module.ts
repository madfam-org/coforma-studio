import { Module } from '@nestjs/common';

import { PhyneCrmModule } from '../../integrations/phynecrm/phynecrm.module';
import { CABMemberService } from './cab-member.service';

@Module({
  imports: [PhyneCrmModule],
  providers: [CABMemberService],
  exports: [CABMemberService],
})
export class CABMemberModule {}
