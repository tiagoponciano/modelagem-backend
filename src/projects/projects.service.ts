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
   * 
   * Lógica (escalável):
   * - raw: prioridades de cada cidade para cada critério (normalizadas, cada coluna soma 1)
   *   - Se há subcritérios: usa cityCriterionScores (já calculado considerando subcritérios)
   *   - Se não há: calcula prioridades diretas por critério
   * - weighted: prioridade_critério * prioridade_cidade_por_criterio
   * - finalScores: soma das linhas da tabela weighted
   */
  formatResults(
    calculationResults: CalculationResult,
    data: CreateProjectDto,
  ) {
    const criteriaWeights = calculationResults.criteriaPriorities.priorities;
    const hasSubCriteria = data.subCriteria && data.subCriteria.length > 0;
    
    // Calcula prioridades de cada cidade para cada critério
    // Se há subcritérios, usa os scores já calculados (que consideram subcritérios)
    // Se não há, calcula prioridades diretas normalizadas
    const raw: Record<string, Record<string, number>> = {};
    
    if (hasSubCriteria) {
      // Com subcritérios: usa cityCriterionScores que já considera a lógica de subcritérios
      // Mas precisa normalizar para que cada coluna some 1
      data.criteria.forEach((criterion) => {
        const columnValues: number[] = [];
        data.cities.forEach((city) => {
          const score = calculationResults.cityCriterionScores[city.id]?.[criterion.id] || 0;
          columnValues.push(score);
        });
        
        // Normaliza a coluna para somar 1
        const columnSum = columnValues.reduce((sum, val) => sum + val, 0);
        data.cities.forEach((city, index) => {
          if (!raw[city.id]) raw[city.id] = {};
          raw[city.id][criterion.id] = columnSum > 0 
            ? columnValues[index] / columnSum 
            : 0;
        });
      });
    } else {
      // Sem subcritérios: calcula prioridades diretas por critério
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

    // Calcula tabela ponderada: prioridade_critério * prioridade_cidade_por_criterio
    const weighted: Record<string, Record<string, number>> = {};
    const finalScores: Record<string, number> = {};
    
    data.cities.forEach((city) => {
      weighted[city.id] = {};
      let rowSum = 0; // Soma da linha para a decisão final
      
      data.criteria.forEach((criterion) => {
        const criterionWeight = criteriaWeights[criterion.id] || 0;
        const cityPriority = raw[city.id][criterion.id] || 0;
        const weightedValue = criterionWeight * cityPriority;
        weighted[city.id][criterion.id] = weightedValue;
        rowSum += weightedValue;
      });
      
      // Armazena a soma da linha como score final
      finalScores[city.id] = rowSum;
    });

    // Formata percentuais
    const finalScoresPercent: Record<string, string> = {};
    data.cities.forEach((city) => {
      const score = finalScores[city.id] || 0;
      finalScoresPercent[city.id] = `${(score * 100).toFixed(2)}%`;
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
        raw, // prioridades por critério (cada coluna soma 1) - primeira tabela
        weighted, // prioridade_critério * prioridade_cidade (segunda tabela) - NÃO incluir _final na tabela
        finalScores, // soma das linhas (coluna decisão final)
        finalScoresPercent, // scores em formato percentual
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

    // Retorna com originalData formatado e results salvos
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
      // results já está incluído no spread (...project)
      // Se results existir, será retornado; se não existir (draft), será null
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

    // Determina o status: se foi enviado explicitamente, usa; senão, marca como "Concluído"
    const finalStatus =
      data.status || 'Concluído'; // Se não enviar status, assume "Concluído" ao recalcular

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
        results: results as any, // Salva os resultados calculados
        alternativesCount: mergedData.cities.length,
        criteriaCount: mergedData.criteria.length,
        status: finalStatus, // Usa o status enviado ou "Concluído" por padrão
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
   * SEMPRE mantém status como "Em progresso"
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
    // SEMPRE mantém status como "Em progresso" (não finaliza)
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
        status: 'Em progresso', // SEMPRE mantém como "Em progresso" em drafts
        // Não atualiza results - mantém os antigos ou null
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
