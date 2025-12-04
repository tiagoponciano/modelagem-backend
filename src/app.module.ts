import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// 1. Importe o Módulo de Projetos
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    // 2. Adicione ele na lista de imports
    ProjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
