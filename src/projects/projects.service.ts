import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AhpService } from './ahp.service';
import { CalculationResult } from './ahp.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private ahpService: AhpService,
  ) {}

  formatResults(calculationResults: CalculationResult, data: CreateProjectDto) {
    const criteriaWeights = calculationResults.criteriaPriorities.priorities;
    const hasSubCriteria = data.subCriteria && data.subCriteria.length > 0;

    const raw: Record<string, Record<string, number>> = {};

    if (hasSubCriteria) {
      data.criteria.forEach((criterion) => {
        const columnValues: number[] = [];
        data.cities.forEach((city) => {
          const score =
            calculationResults.cityCriterionScores[city.id]?.[criterion.id] ||
            0;
          columnValues.push(score);
        });

        const columnSum = columnValues.reduce((sum, val) => sum + val, 0);
        data.cities.forEach((city, index) => {
          if (!raw[city.id]) raw[city.id] = {};
          raw[city.id][criterion.id] =
            columnSum > 0 ? columnValues[index] / columnSum : 0;
        });
      });
    } else {
      data.cities.forEach((city) => {
        raw[city.id] = {};
        data.criteria.forEach((criterion) => {
          const priorities = this.ahpService.getCriterionCityPriorities(
            data,
            criterion.id,
          );
          raw[city.id][criterion.id] = priorities.priorities[city.id] || 0;
        });
      });
    }

    const weighted: Record<string, Record<string, number>> = {};
    const finalScores: Record<string, number> = {};

    data.cities.forEach((city) => {
      weighted[city.id] = {};
      let rowSum = 0;

      data.criteria.forEach((criterion) => {
        const criterionWeight = criteriaWeights[criterion.id] || 0;
        const cityPriority = raw[city.id][criterion.id] || 0;
        const weightedValue = criterionWeight * cityPriority;
        weighted[city.id][criterion.id] = weightedValue;
        rowSum += weightedValue;
      });

      finalScores[city.id] = rowSum;
    });

    const finalScoresPercent: Record<string, string> = {};
    data.cities.forEach((city) => {
      const score = finalScores[city.id] || 0;
      finalScoresPercent[city.id] = `${(score * 100).toFixed(2)}%`;
    });

    return {
      criteriaWeights,
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
      table: {
        raw,
        weighted,
        finalScores,
        finalScoresPercent,
      },
    };
  }

  async create(data: CreateProjectDto) {
    const calculationResults = this.ahpService.calculate(data);
    const results = this.formatResults(calculationResults, data);

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

  async update(
    id: string,
    data: Partial<CreateProjectDto> & { status?: 'Em progresso' | 'Concluído' },
  ) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return null;
    }

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

    const calculationResults = this.ahpService.calculate(mergedData);
    const results = this.formatResults(calculationResults, mergedData);
    const finalStatus = data.status || 'Concluído';

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
        status: finalStatus,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }

  calculate(data: CreateProjectDto) {
    return this.ahpService.calculate(data);
  }

  async saveDraft(id: string, data: Partial<CreateProjectDto>) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return null;
    }

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

    const mergedData = {
      title: data.title ?? originalData.title,
      cities: data.cities ?? originalData.cities,
      criteria: data.criteria ?? originalData.criteria,
      subCriteria: data.subCriteria ?? originalData.subCriteria,
      criteriaMatrix: data.criteriaMatrix ?? originalData.criteriaMatrix,
      evaluationValues: data.evaluationValues ?? originalData.evaluationValues,
      criteriaConfig: data.criteriaConfig ?? originalData.criteriaConfig,
      criterionFieldValues:
        data.criterionFieldValues ?? originalData.criterionFieldValues,
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
        alternativesCount:
          mergedData.cities?.length ?? existingProject.alternativesCount,
        criteriaCount:
          mergedData.criteria?.length ?? existingProject.criteriaCount,
        status: 'Em progresso',
      },
    });
  }

  async saveOrUpdateDraft(
    id: string | undefined,
    data: Partial<CreateProjectDto>,
  ) {
    if (id) {
      return this.saveDraft(id, data);
    } else {
      if (!data.title || !data.cities || !data.criteria) {
        throw new Error(
          'Para criar um novo projeto, é necessário title, cities e criteria',
        );
      }

      return this.prisma.project.create({
        data: {
          title: data.title,
          cities: (data.cities as any) || [],
          criteria: (data.criteria as any) || [],
          subCriteria: (data.subCriteria as any) || null,
          criteriaMatrix: (data.criteriaMatrix as any) || {},
          evaluationValues: (data.evaluationValues as any) || null,
          criteriaConfig: (data.criteriaConfig as any) || null,
          criterionFieldValues: (data.criterionFieldValues as any) || null,
          results: {} as any,
          alternativesCount: data.cities?.length || 0,
          criteriaCount: data.criteria?.length || 0,
          status: 'Em progresso',
        },
      });
    }
  }
}
