import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AhpService } from './ahp.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private ahpService: AhpService,
  ) {}

  async create(data: CreateProjectDto) {
    // Calcula os resultados AHP
    const calculationResults = this.ahpService.calculate(data);

    // Formata resultados para compatibilidade com o frontend
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
      calculationResults,
    };

    // Transforma CreateProjectDto para o formato do Prisma
    return this.prisma.project.create({
      data: {
        title: data.title,
        cities: data.cities as any,
        criteria: data.criteria as any,
        subCriteria: data.subCriteria as any,
        criteriaMatrix: data.criteriaMatrix as any,
        evaluationValues: data.evaluationValues as any,
        criteriaConfig: data.criteriaConfig as any,
        criterionFieldValues: data.criterionFieldValues as any,
        results: results as any,
        alternativesCount: data.cities.length,
        criteriaCount: data.criteria.length,
        status: 'Concluído',
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      return null;
    }

    // Retorna com originalData formatado
    return {
      ...project,
      originalData: {
        title: project.title,
        cities: project.cities as any,
        criteria: project.criteria as any,
        subCriteria: project.subCriteria as any,
        criteriaMatrix: project.criteriaMatrix as any,
        evaluationValues: project.evaluationValues as any,
        criteriaConfig: project.criteriaConfig as any,
        criterionFieldValues: project.criterionFieldValues as any,
      },
    };
  }

  async update(id: string, data: Partial<CreateProjectDto>) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return null;
    }

    // Se for apenas atualização de título
    const onlyTitleUpdate =
      data.title &&
      !data.cities &&
      !data.criteria &&
      !data.criteriaMatrix &&
      !data.evaluationValues &&
      !data.criteriaConfig;

    if (onlyTitleUpdate) {
      return this.prisma.project.update({
        where: { id },
        data: { title: data.title },
      });
    }

    // Merge com dados existentes
    const originalData = {
      title: existingProject.title,
      cities: existingProject.cities as any,
      criteria: existingProject.criteria as any,
      subCriteria: existingProject.subCriteria as any,
      criteriaMatrix: existingProject.criteriaMatrix as any,
      evaluationValues: existingProject.evaluationValues as any,
      criteriaConfig: existingProject.criteriaConfig as any,
      criterionFieldValues: existingProject.criterionFieldValues as any,
    };

    const mergedData: CreateProjectDto = {
      title: data.title || originalData.title,
      cities: (data.cities as any) || originalData.cities,
      criteria: (data.criteria as any) || originalData.criteria,
      subCriteria: (data.subCriteria as any) || originalData.subCriteria,
      criteriaMatrix: data.criteriaMatrix || originalData.criteriaMatrix,
      evaluationValues: data.evaluationValues || originalData.evaluationValues,
      criteriaConfig: data.criteriaConfig || originalData.criteriaConfig,
      criterionFieldValues:
        data.criterionFieldValues || originalData.criterionFieldValues,
    };

    // Calcula os resultados AHP
    const calculationResults = this.ahpService.calculate(mergedData);

    // Formata resultados
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
      calculationResults,
    };

    return this.prisma.project.update({
      where: { id },
      data: {
        title: mergedData.title,
        cities: mergedData.cities as any,
        criteria: mergedData.criteria as any,
        subCriteria: mergedData.subCriteria as any,
        criteriaMatrix: mergedData.criteriaMatrix as any,
        evaluationValues: mergedData.evaluationValues as any,
        criteriaConfig: mergedData.criteriaConfig as any,
        criterionFieldValues: mergedData.criterionFieldValues as any,
        results: results as any,
        alternativesCount: mergedData.cities.length,
        criteriaCount: mergedData.criteria.length,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }

  calculate(data: CreateProjectDto) {
    return this.ahpService.calculate(data);
  }
}
