import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { AhpService } from './ahp.service';
import { ProjectsRepository } from './projects.repository';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ProjectsController],
  providers: [AhpService, ProjectsRepository, PrismaService],
  exports: [AhpService, ProjectsRepository],
})
export class ProjectsModule {}
