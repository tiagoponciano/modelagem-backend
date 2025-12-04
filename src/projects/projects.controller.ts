import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Patch,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AhpService } from './ahp.service';
import { ProjectsRepository } from './projects.repository';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly ahpService: AhpService,
    private readonly projectsRepository: ProjectsRepository,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar um novo projeto AHP' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({
    status: 201,
    description: 'Projeto criado com sucesso',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async create(@Body() createProjectDto: CreateProjectDto) {
    const results = this.ahpService.calculate(createProjectDto);

    const project = await this.projectsRepository.create({
      title: createProjectDto.title,
      criteriaWeights: results.criteriaWeights,
      ranking: results.ranking,
      matrixRaw: results.matrixRaw,
      originalData: createProjectDto,
      alternativesCount: createProjectDto.cities.length,
      criteriaCount: createProjectDto.criteria.length,
    });

    return {
      id: project.id,
      title: project.title,
      results: {
        criteriaWeights: project.criteriaWeights as Record<string, number>,
        ranking: project.ranking as Array<{
          id: string;
          name: string;
          score: number;
          formattedScore: string;
        }>,
        matrixRaw: project.matrixRaw as number[][],
      },
      criteria: createProjectDto.criteria.map((c) => ({
        id: c.id,
        name: c.name,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      status: project.status,
      alternativesCount: project.alternativesCount,
      criteriaCount: project.criteriaCount,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os projetos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de projetos',
    type: [ProjectResponseDto],
  })
  async findAll() {
    const projects = await this.projectsRepository.findAll();

    return projects.map((project) => {
      const originalData = project.originalData as any;
      const criteria = originalData?.criteria || [];

      return {
        id: project.id,
        title: project.title,
        results: {
          criteriaWeights: project.criteriaWeights as Record<string, number>,
          ranking: project.ranking as Array<{
            id: string;
            name: string;
            score: number;
            formattedScore: string;
          }>,
          matrixRaw: project.matrixRaw as number[][],
        },
        criteria: criteria.map((c: any) => ({
          id: c.id,
          name: c.name,
        })),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        status: project.status,
        alternativesCount: project.alternativesCount,
        criteriaCount: project.criteriaCount,
      };
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar projeto por ID' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({
    status: 200,
    description: 'Projeto encontrado',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  async findOne(@Param('id') id: string) {
    const project = await this.projectsRepository.findById(id);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    const originalData = project.originalData as any;
    const criteria = originalData?.criteria || [];

    return {
      id: project.id,
      title: project.title,
      results: {
        criteriaWeights: project.criteriaWeights as Record<string, number>,
        ranking: project.ranking as Array<{
          id: string;
          name: string;
          score: number;
          formattedScore: string;
        }>,
        matrixRaw: project.matrixRaw as number[][],
      },
      criteria: criteria.map((c: any) => ({
        id: c.id,
        name: c.name,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      status: project.status,
      alternativesCount: project.alternativesCount,
      criteriaCount: project.criteriaCount,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Projeto atualizado com sucesso',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const existingProject = await this.projectsRepository.findById(id);

    if (!existingProject) {
      throw new NotFoundException('Projeto não encontrado');
    }

    // Se apenas o título foi atualizado, não precisa recalcular
    const onlyTitleUpdate =
      updateProjectDto.title &&
      !updateProjectDto.cities &&
      !updateProjectDto.criteria &&
      !updateProjectDto.criteriaMatrix &&
      !updateProjectDto.evaluationValues &&
      !updateProjectDto.criteriaConfig;

    if (onlyTitleUpdate) {
      const updatedProject = await this.projectsRepository.update(id, {
        title: updateProjectDto.title,
      });

      const originalData = updatedProject.originalData as any;
      const criteria = originalData?.criteria || [];

      return {
        id: updatedProject.id,
        title: updatedProject.title,
        results: {
          criteriaWeights: updatedProject.criteriaWeights as Record<
            string,
            number
          >,
          ranking: updatedProject.ranking as Array<{
            id: string;
            name: string;
            score: number;
            formattedScore: string;
          }>,
          matrixRaw: updatedProject.matrixRaw as number[][],
        },
        criteria: criteria.map((c: any) => ({
          id: c.id,
          name: c.name,
        })),
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
        status: updatedProject.status,
        alternativesCount: updatedProject.alternativesCount,
        criteriaCount: updatedProject.criteriaCount,
      };
    }

    // Se dados do projeto foram alterados, precisa recalcular
    // Mesclar dados existentes com os novos dados
    const originalData = existingProject.originalData as any;
    const mergedData: CreateProjectDto = {
      title: updateProjectDto.title || originalData.title,
      cities: updateProjectDto.cities || originalData.cities,
      criteria: updateProjectDto.criteria || originalData.criteria,
      criteriaMatrix:
        updateProjectDto.criteriaMatrix || originalData.criteriaMatrix,
      evaluationValues:
        updateProjectDto.evaluationValues || originalData.evaluationValues,
      criteriaConfig:
        updateProjectDto.criteriaConfig || originalData.criteriaConfig,
    };

    // Recalcular resultados AHP
    const results = this.ahpService.calculate(mergedData);

    // Atualizar projeto
    const updatedProject = await this.projectsRepository.update(id, {
      title: mergedData.title,
      criteriaWeights: results.criteriaWeights,
      ranking: results.ranking,
      matrixRaw: results.matrixRaw,
      originalData: mergedData,
      alternativesCount: mergedData.cities.length,
      criteriaCount: mergedData.criteria.length,
    });

    return {
      id: updatedProject.id,
      title: updatedProject.title,
      results: {
        criteriaWeights: updatedProject.criteriaWeights as Record<
          string,
          number
        >,
        ranking: updatedProject.ranking as Array<{
          id: string;
          name: string;
          score: number;
          formattedScore: string;
        }>,
        matrixRaw: updatedProject.matrixRaw as number[][],
      },
      criteria: mergedData.criteria.map((c) => ({
        id: c.id,
        name: c.name,
      })),
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
      status: updatedProject.status,
      alternativesCount: updatedProject.alternativesCount,
      criteriaCount: updatedProject.criteriaCount,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 204, description: 'Projeto deletado com sucesso' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  async remove(@Param('id') id: string) {
    await this.projectsRepository.delete(id);
  }
}
