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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  private projectsDb: any[] = [];

  constructor(private readonly ahpService: AhpService) {}

  @Post('calculate')
  @ApiOperation({
    summary:
      'Calcular resultados AHP sem salvar (para atualização em tempo real)',
  })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Cálculos realizados com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  calculate(@Body() createProjectDto: CreateProjectDto) {
    const calculationResults = this.ahpService.calculate(createProjectDto);

    // Formatar resultados para compatibilidade com o frontend
    const results = {
      criteriaWeights: calculationResults.criteriaPriorities.priorities,
      ranking: calculationResults.ranking,
      matrixRaw: calculationResults.criteriaPriorities.matrix,
      lambdaMax: Number(
        calculationResults.criteriaConsistency.lambda.toFixed(5),
      ),
      consistencyIndex: Number(
        calculationResults.criteriaConsistency.CI.toFixed(5),
      ),
      consistencyRatio: Number(
        calculationResults.criteriaConsistency.CR.toFixed(5),
      ),
      randomIndex: calculationResults.criteriaConsistency.RI,
      isConsistent: calculationResults.criteriaConsistency.CR < 0.1,
      eigenvector: calculationResults.criteriaPriorities.ids.map(
        (id) => calculationResults.criteriaPriorities.priorities[id] || 0,
      ),
      // Novos campos adicionais com todos os cálculos detalhados
      calculationResults,
    };

    return results;
  }

  @Post()
  @ApiOperation({ summary: 'Criar um novo projeto AHP' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, description: 'Projeto criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(@Body() createProjectDto: CreateProjectDto) {
    const calculationResults = this.ahpService.calculate(createProjectDto);

    // Formatar resultados para compatibilidade com o frontend
    const results = {
      criteriaWeights: calculationResults.criteriaPriorities.priorities,
      ranking: calculationResults.ranking,
      matrixRaw: calculationResults.criteriaPriorities.matrix,
      lambdaMax: Number(
        calculationResults.criteriaConsistency.lambda.toFixed(5),
      ),
      consistencyIndex: Number(
        calculationResults.criteriaConsistency.CI.toFixed(5),
      ),
      consistencyRatio: Number(
        calculationResults.criteriaConsistency.CR.toFixed(5),
      ),
      randomIndex: calculationResults.criteriaConsistency.RI,
      isConsistent: calculationResults.criteriaConsistency.CR < 0.1,
      eigenvector: calculationResults.criteriaPriorities.ids.map(
        (id) => calculationResults.criteriaPriorities.priorities[id] || 0,
      ),
      // Novos campos adicionais
      calculationResults,
    };

    const projectWithId = {
      id: crypto.randomUUID(),
      title: createProjectDto.title,
      results,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'Concluído',
      alternativesCount: createProjectDto.cities.length,
      criteriaCount: createProjectDto.criteria.length,
      originalData: createProjectDto,
    };

    this.projectsDb.push(projectWithId);

    return projectWithId;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar projeto por ID' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 200, description: 'Projeto encontrado' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  findOne(@Param('id') id: string) {
    const project = this.projectsDb.find((p) => p.id === id);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    return {
      ...project,
      originalData: project.originalData || {
        title: project.title,
        cities: [],
        criteria: [],
        criteriaMatrix: {},
        evaluationValues: {},
        criteriaConfig: {},
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os projetos' })
  @ApiResponse({ status: 200, description: 'Lista de projetos' })
  findAll() {
    return [...this.projectsDb].reverse();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, description: 'Projeto atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    const projectIndex = this.projectsDb.findIndex((p) => p.id === id);

    if (projectIndex === -1) {
      throw new NotFoundException('Projeto não encontrado');
    }

    const existingProject = this.projectsDb[projectIndex];
    const originalData = existingProject.originalData || {};

    const onlyTitleUpdate =
      updateProjectDto.title &&
      !updateProjectDto.cities &&
      !updateProjectDto.criteria &&
      !updateProjectDto.criteriaMatrix &&
      !updateProjectDto.evaluationValues &&
      !updateProjectDto.criteriaConfig;

    if (onlyTitleUpdate) {
      this.projectsDb[projectIndex] = {
        ...existingProject,
        title: updateProjectDto.title,
        updatedAt: new Date(),
      };

      return this.projectsDb[projectIndex];
    }

    const mergedData: CreateProjectDto = {
      title: updateProjectDto.title || originalData.title,
      cities: updateProjectDto.cities || originalData.cities,
      criteria: updateProjectDto.criteria || originalData.criteria,
      subCriteria: updateProjectDto.subCriteria || originalData.subCriteria,
      criteriaMatrix:
        updateProjectDto.criteriaMatrix || originalData.criteriaMatrix,
      evaluationValues:
        updateProjectDto.evaluationValues || originalData.evaluationValues,
      criteriaConfig:
        updateProjectDto.criteriaConfig || originalData.criteriaConfig,
      criterionFieldValues:
        updateProjectDto.criterionFieldValues ||
        originalData.criterionFieldValues,
    };

    const calculationResults = this.ahpService.calculate(mergedData);

    // Formatar resultados para compatibilidade com o frontend
    const results = {
      criteriaWeights: calculationResults.criteriaPriorities.priorities,
      ranking: calculationResults.ranking,
      matrixRaw: calculationResults.criteriaPriorities.matrix,
      lambdaMax: Number(
        calculationResults.criteriaConsistency.lambda.toFixed(5),
      ),
      consistencyIndex: Number(
        calculationResults.criteriaConsistency.CI.toFixed(5),
      ),
      consistencyRatio: Number(
        calculationResults.criteriaConsistency.CR.toFixed(5),
      ),
      randomIndex: calculationResults.criteriaConsistency.RI,
      isConsistent: calculationResults.criteriaConsistency.CR < 0.1,
      eigenvector: calculationResults.criteriaPriorities.ids.map(
        (id) => calculationResults.criteriaPriorities.priorities[id] || 0,
      ),
      // Novos campos adicionais
      calculationResults,
    };

    this.projectsDb[projectIndex] = {
      ...existingProject,
      title: mergedData.title,
      results,
      updatedAt: new Date(),
      alternativesCount: mergedData.cities.length,
      criteriaCount: mergedData.criteria.length,
      originalData: mergedData,
    };

    return this.projectsDb[projectIndex];
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 204, description: 'Projeto deletado com sucesso' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  remove(@Param('id') id: string) {
    const trimmedId = id.trim();
    const projectIndex = this.projectsDb.findIndex(
      (p) => p.id === trimmedId || p.id === id,
    );

    if (projectIndex === -1) {
      throw new NotFoundException('Projeto não encontrado');
    }

    this.projectsDb.splice(projectIndex, 1);
  }
}
