import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { AhpService } from './ahp.service';

@Module({
  controllers: [ProjectsController],
  providers: [AhpService],
})
export class ProjectsModule {}
