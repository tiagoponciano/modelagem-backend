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

  /**
   * Formata todos os resultados em uma estrutura única para o frontend,
   * incluindo a tabela ponderada já pronta (sem necessidade de cálculos no cliente).
   */
  formatResults(
    calculationResults: CalculationResult,
    data: CreateProjectDto,
  ) {
    const criteriaWeights = calculationResults.criteriaPriorities.priorities;
    const cityCriterionRaw = calculationResults.cityCriterionScores;

    const weighted: Record<string, Record<string, number>> = {};
    Object.keys(cityCriterionRaw).forEach((cityId) => {
      weighted[cityId] = {};
      data.criteria.forEach((criterion) => {
        const weight = criteriaWeights[criterion.id] || 0;
        const raw = cityCriterionRaw[cityId]?.[criterion.id] || 0;
        weighted[cityId][criterion.id] = raw * weight;
      });
    });

    const finalScores = calculationResults.finalScores;
    const finalScoresPercent: Record<string, string> = {};
    Object.keys(finalScores).forEach((cityId) => {
      finalScoresPercent[cityId] = `${(finalScores[cityId] * 100).toFixed(2)}%`;
    });

    return {
      criteriaWeights,
      ranking: calculationResults.ranking,
      matrixRaw: calculationResults.criteriaPriorities.matrix,
      lambdaMax: Number(calculationResults.criteriaConsistency.lambda.toFixed(5)),
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
      // Tabelas para o frontend:
      table: {
        raw: cityCriterionRaw, // prioridades por critério (cada coluna soma 1)
        weighted, // prioridades multiplicadas pelos pesos dos critérios
        finalScores,
        finalScoresPercent,
      },
    };
  }

  async create(data: CreateProjectDto) {
    // Calcula os resultados AHP
    const calculationResults = this.ahpService.calculate(data);

    // Formata resultados para compatibilidade com o frontend
    const results = this.formatResults(calculationResults, data);

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
        status: 'Concluído', // Quando cria com todos os dados, marca como concluído
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
    const results = this.formatResults(calculationResults, mergedData);

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

  /**
   * Salva dados parciais (draft) sem recalcular resultados AHP
   * Usado para auto-save durante o preenchimento do formulário
   */
  async saveDraft(id: string, data: Partial<CreateProjectDto>) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return null;
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

    // Merge apenas os campos fornecidos
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

    // Atualiza apenas os dados, sem recalcular resultados
    // Mantém os resultados antigos ou vazios se ainda não foram calculados
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
        alternativesCount: mergedData.cities?.length ?? existingProject.alternativesCount,
        criteriaCount: mergedData.criteria?.length ?? existingProject.criteriaCount,
        status: 'Em progresso', // Marca como em progresso quando salva parcialmente
      },
    });
  }

  /**
   * Cria ou atualiza um projeto com dados parciais
   * Se não existir, cria um novo. Se existir, atualiza.
   */
  async saveOrUpdateDraft(
    id: string | undefined,
    data: Partial<CreateProjectDto>,
  ) {
    if (id) {
      // Se tem ID, atualiza projeto existente
      return this.saveDraft(id, data);
    } else {
      // Se não tem ID, cria um novo projeto com status "Em progresso"
      // Para criar, precisa pelo menos de title, cities e criteria
      if (!data.title || !data.cities || !data.criteria) {
        throw new Error(
          'Para criar um novo projeto, é necessário title, cities e criteria',
        );
      }

      // Cria com dados mínimos, resultados vazios
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
          results: {} as any, // Resultados vazios até calcular
          alternativesCount: data.cities?.length || 0,
          criteriaCount: data.criteria?.length || 0,
          status: 'Em progresso',
        },
      });
    }
  }
}
