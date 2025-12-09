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
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly ahpService: AhpService,
  ) {}

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
    const results = this.projectsService.formatResults(
      calculationResults,
      createProjectDto,
    );
    return results;
  }

  @Post()
  @ApiOperation({ summary: 'Criar um novo projeto AHP' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, description: 'Projeto criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async create(@Body() createProjectDto: CreateProjectDto) {
    const project = await this.projectsService.create(createProjectDto);

    // Formata a resposta com originalData
    return {
      ...project,
      originalData: {
        title: project.title,
        cities: project.cities,
        criteria: project.criteria,
        subCriteria: project.subCriteria,
        criteriaMatrix: project.criteriaMatrix,
        evaluationValues: project.evaluationValues,
        criteriaConfig: project.criteriaConfig,
        criterionFieldValues: project.criterionFieldValues,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar projeto por ID' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 200, description: 'Projeto encontrado' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  async findOne(@Param('id') id: string) {
    const project = await this.projectsService.findOne(id);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    return project;
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os projetos' })
  @ApiResponse({ status: 200, description: 'Lista de projetos' })
  async findAll() {
    const projects = await this.projectsService.findAll();

    // Formata cada projeto com originalData
    return projects.map((project) => ({
      ...project,
      originalData: {
        title: project.title,
        cities: project.cities,
        criteria: project.criteria,
        subCriteria: project.subCriteria,
        criteriaMatrix: project.criteriaMatrix,
        evaluationValues: project.evaluationValues,
        criteriaConfig: project.criteriaConfig,
        criterionFieldValues: project.criterionFieldValues,
      },
    }));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, description: 'Projeto atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const project = await this.projectsService.update(id, updateProjectDto);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    // Formata a resposta com originalData
    return {
      ...project,
      originalData: {
        title: project.title,
        cities: project.cities,
        criteria: project.criteria,
        subCriteria: project.subCriteria,
        criteriaMatrix: project.criteriaMatrix,
        evaluationValues: project.evaluationValues,
        criteriaConfig: project.criteriaConfig,
        criterionFieldValues: project.criterionFieldValues,
      },
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 204, description: 'Projeto deletado com sucesso' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  async remove(@Param('id') id: string) {
    try {
      await this.projectsService.remove(id);
    } catch (error) {
      throw new NotFoundException('Projeto não encontrado');
    }
  }

  @Post('draft')
  @ApiOperation({
    summary: 'Salvar dados parciais (auto-save) - Não recalcula resultados',
  })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Dados salvos parcialmente com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async saveDraft(@Body() body: UpdateProjectDto & { id?: string }) {
    const { id, ...data } = body;
    const project = await this.projectsService.saveOrUpdateDraft(id, data);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    // Formata a resposta com originalData
    return {
      ...project,
      originalData: {
        title: project.title,
        cities: project.cities,
        criteria: project.criteria,
        subCriteria: project.subCriteria,
        criteriaMatrix: project.criteriaMatrix,
        evaluationValues: project.evaluationValues,
        criteriaConfig: project.criteriaConfig,
        criterionFieldValues: project.criterionFieldValues,
      },
    };
  }

  @Patch(':id/draft')
  @ApiOperation({
    summary: 'Atualizar dados parciais de um projeto existente (auto-save)',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Dados atualizados parcialmente com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  async updateDraft(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const project = await this.projectsService.saveDraft(id, updateProjectDto);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    // Formata a resposta com originalData
    return {
      ...project,
      originalData: {
        title: project.title,
        cities: project.cities,
        criteria: project.criteria,
        subCriteria: project.subCriteria,
        criteriaMatrix: project.criteriaMatrix,
        evaluationValues: project.evaluationValues,
        criteriaConfig: project.criteriaConfig,
        criterionFieldValues: project.criterionFieldValues,
      },
    };
  }
}
