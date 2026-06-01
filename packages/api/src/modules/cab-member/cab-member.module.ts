import { Module } from '@nestjs/common';

import { PhyndCrmModule } from '../../integrations/phyndcrm/phyndcrm.module';
import { CABMemberService } from './cab-member.service';

@Module({
  imports: [PhyndCrmModule],
  providers: [CABMemberService],
  exports: [CABMemberService],
})
export class CABMemberModule {}
