import { Controller, Post, Body, Get } from '@nestjs/common';
import { AhpService } from './ahp.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller('projects')
export class ProjectsController {
  // "Banco de dados" em memória (reseta se reiniciar o server)
  private projectsDb: any[] = []; // <--- Adicione o ": any[]"

  constructor(private readonly ahpService: AhpService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto) {
    // 1. Calcula
    const results = this.ahpService.calculate(createProjectDto);

    // 2. Cria objeto final
    const projectWithId = {
      id: crypto.randomUUID(),
      title: createProjectDto.title,
      results,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'Concluído',
      alternativesCount: createProjectDto.cities.length,
      criteriaCount: createProjectDto.criteria.length,
      // Guarda os dados originais para histórico
      originalData: createProjectDto,
    };

    // 3. Salva
    this.projectsDb.push(projectWithId);

    return projectWithId;
  }

  @Get()
  findAll() {
    // Retorna lista invertida (mais recentes primeiro)
    return [...this.projectsDb].reverse();
  }
}
