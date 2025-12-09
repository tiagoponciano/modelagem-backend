import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AhpService } from './ahp.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, AhpService, PrismaService],
})
export class ProjectsModule {}
