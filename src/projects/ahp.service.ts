import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';

export interface AhpMatrixResult {
  matrix: number[][];
  ids: string[];
}

export interface AhpPrioritiesResult {
  priorities: Record<string, number>;
  normalizedMatrix: number[][];
  matrix: number[][];
  ids: string[];
}

export interface ConsistencyMetrics {
  lambda: number;
  CI: number;
  RI: number;
  CR: number;
  weightedMatrix: number[][];
  weightedSums: number[];
}

export interface CalculationResult {
  criteriaPriorities: AhpPrioritiesResult;
  criteriaConsistency: ConsistencyMetrics;
  subCriterionPriorities: Record<string, AhpPrioritiesResult>;
  subCriterionConsistency: Record<string, ConsistencyMetrics>;
  subWeightPriorities: Record<string, AhpPrioritiesResult>;
  cityCriterionScores: Record<string, Record<string, number>>;
  finalScores: Record<string, number>;
  ranking: Array<{
    id: string;
    name: string;
    score: number;
    formattedScore: string;
  }>;
}

@Injectable()
export class AhpService {
  private readonly RI_TABLE: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0.58,
    4: 0.9,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
  };

  /**
   * Constrói uma matriz AHP a partir de valores armazenados
   */
  private buildAhpMatrix(
    ids: string[],
    getValue: (idA: string, idB: string) => number | null,
  ): AhpMatrixResult {
    const n = ids.length;
    const matrix: number[][] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          row.push(1);
        } else {
          const isUpperTriangle = i < j;
          const value = getValue(ids[i], ids[j]);

          if (value !== null && value !== undefined && value > 0) {
            row.push(value);
          } else if (!isUpperTriangle) {
            const reverseValue = getValue(ids[j], ids[i]);
            if (reverseValue !== null && reverseValue > 0) {
              row.push(1 / reverseValue);
            } else {
              row.push(1);
            }
          } else {
            row.push(1);
          }
        }
      }
      matrix.push(row);
    }

    return { matrix, ids };
  }

  /**
   * Calcula as prioridades usando o método de normalização por colunas
   */
  private calculatePriorities(
    matrixResult: AhpMatrixResult,
  ): AhpPrioritiesResult {
    const { matrix, ids } = matrixResult;
    const n = matrix.length;

    if (n === 0) {
      return {
        priorities: {},
        normalizedMatrix: [],
        matrix: [],
        ids: [],
      };
    }

    // Soma das colunas
    const columnSums: number[] = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        columnSums[j] += matrix[i][j];
      }
    }

    // Normalização
    const normalizedMatrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      normalizedMatrix.push([]);
      for (let j = 0; j < n; j++) {
        normalizedMatrix[i][j] =
          columnSums[j] > 0 ? matrix[i][j] / columnSums[j] : 0;
      }
    }

    // Prioridades (média das linhas)
    const priorities: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += normalizedMatrix[i][j];
      }
      priorities[ids[i]] = sum / n;
    }

    return {
      priorities,
      normalizedMatrix,
      matrix,
      ids,
    };
  }

  /**
   * Calcula métricas de consistência
   */
  private calculateConsistencyMetrics(
    matrixResult: AhpMatrixResult,
    priorities: Record<string, number>,
  ): ConsistencyMetrics {
    const { matrix, ids } = matrixResult;
    const n = matrix.length;

    if (n === 0 || Object.keys(priorities).length === 0) {
      return {
        lambda: 0,
        CI: 0,
        RI: 0,
        CR: 0,
        weightedMatrix: [],
        weightedSums: [],
      };
    }

    // Matriz ponderada
    const weightedMatrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      weightedMatrix.push([]);
      for (let j = 0; j < n; j++) {
        const priority = priorities[ids[j]] || 0;
        weightedMatrix[i][j] = matrix[i][j] * priority;
      }
    }

    // Somas ponderadas
    const weightedSums: number[] = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += weightedMatrix[i][j];
      }
      const priority = priorities[ids[i]] || 0;
      weightedSums.push(priority > 0 ? sum / priority : 0);
    }

    // Lambda (autovalor máximo)
    let lambda = 0;
    for (let i = 0; i < n; i++) {
      lambda += weightedSums[i];
    }
    lambda = lambda / n;

    // CI (Consistency Index)
    const CI = (lambda - n) / (n - 1);

    // RI (Random Index)
    const RI = this.RI_TABLE[n] || 1.12;

    // CR (Consistency Ratio)
    const CR = RI > 0 ? CI / RI : 0;

    return {
      lambda,
      CI,
      RI,
      CR,
      weightedMatrix,
      weightedSums,
    };
  }

  /**
   * Calcula prioridades dos critérios
   */
  private calculateCriteriaPriorities(
    data: CreateProjectDto,
  ): AhpPrioritiesResult {
    const { criteria, criteriaMatrix } = data;

    const getValue = (idA: string, idB: string): number | null => {
      const key = `${idA}-${idB}`;
      const reverseKey = `${idB}-${idA}`;
      const value = criteriaMatrix[key];
      const reverseValue = criteriaMatrix[reverseKey];

      if (value !== undefined && value > 0) {
        return value;
      }
      if (reverseValue !== undefined && reverseValue > 0) {
        return 1 / reverseValue;
      }
      return null;
    };

    const criterionIds = criteria.map((c) => c.id);
    const matrixResult = this.buildAhpMatrix(criterionIds, getValue);
    return this.calculatePriorities(matrixResult);
  }

  /**
   * Calcula prioridades de subcritérios (comparação entre cidades)
   */
  private calculateSubCriterionPriorities(
    data: CreateProjectDto,
    subCriterionId: string,
  ): AhpPrioritiesResult {
    const { cities, criterionFieldValues } = data;

    const getValue = (cityAId: string, cityBId: string): number | null => {
      const key = `${subCriterionId}-${cityAId}-${cityBId}`;
      const reverseKey = `${subCriterionId}-${cityBId}-${cityAId}`;
      const value = criterionFieldValues?.[key]?.['ahp-value'];
      const reverseValue = criterionFieldValues?.[reverseKey]?.['ahp-value'];

      if (typeof value === 'number' && value > 0) {
        return value;
      }
      if (typeof reverseValue === 'number' && reverseValue > 0) {
        return 1 / reverseValue;
      }
      return null;
    };

    const cityIds = cities.map((c) => c.id);
    const matrixResult = this.buildAhpMatrix(cityIds, getValue);
    return this.calculatePriorities(matrixResult);
  }

  /**
   * Calcula pesos entre subcritérios (AHP local do critério)
   */
  private calculateSubWeightPriorities(
    data: CreateProjectDto,
    criterionId: string,
  ): AhpPrioritiesResult {
    const { subCriteria = [], criterionFieldValues } = data;

    const subs = subCriteria.filter((sc) => sc.criterionId === criterionId);
    if (subs.length === 0) {
      return {
        priorities: {},
        normalizedMatrix: [],
        matrix: [],
        ids: [],
      };
    }

    const getValue = (subAId: string, subBId: string): number | null => {
      const key = `${criterionId}-${subAId}-${subBId}`;
      const reverseKey = `${criterionId}-${subBId}-${subAId}`;
      const value = criterionFieldValues?.[key]?.['subw'];
      const reverseValue = criterionFieldValues?.[reverseKey]?.['subw'];

      if (typeof value === 'number' && value > 0) {
        return value;
      }
      if (typeof reverseValue === 'number' && reverseValue > 0) {
        return 1 / reverseValue;
      }
      return null;
    };

    const subIds = subs.map((s) => s.id);
    const matrixResult = this.buildAhpMatrix(subIds, getValue);
    return this.calculatePriorities(matrixResult);
  }

  /**
   * Calcula prioridades baseadas em distâncias
   */
  private calculateDistancePriorities(
    data: CreateProjectDto,
    portId: string,
  ): Record<string, number> {
    const { cities, criterionFieldValues } = data;

    const getDistance = (cityId: string): number => {
      const key = `${cityId}-distance`;
      const value = criterionFieldValues?.[key]?.[`distance-${portId}`];
      return typeof value === 'number' ? value : 0;
    };

    const getAhpValue = (cityAId: string, cityBId: string): number => {
      const key = `${cityAId}-distance`;
      const value = criterionFieldValues?.[key]?.[`ahp-${portId}-${cityBId}`];
      return typeof value === 'number' ? value : 0;
    };

    const cityIds = cities.map((c) => c.id);
    const matrix: number[][] = [];

    for (let i = 0; i < cityIds.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < cityIds.length; j++) {
        if (i === j) {
          row.push(1);
        } else {
          let value = getAhpValue(cityIds[i], cityIds[j]);

          if (value === 0) {
            const distanceA = getDistance(cityIds[i]);
            const distanceB = getDistance(cityIds[j]);
            if (distanceA > 0 && distanceB > 0) {
              value = distanceB / distanceA;
              if (value > 9) value = 9;
              if (value < 1 / 9) value = 1 / 9;
            } else {
              value = 1;
            }
          }

          row.push(value);
        }
      }
      matrix.push(row);
    }

    const matrixResult = { matrix, ids: cityIds };
    const prioritiesResult = this.calculatePriorities(matrixResult);
    return prioritiesResult.priorities;
  }

  /**
   * Calcula médias de valores numéricos para uma cidade em um critério específico
   * Genérico: funciona para qualquer critério que tenha campos numéricos
   */
  private calculateCityFieldAverages(
    data: CreateProjectDto,
    cityId: string,
    criterionId: string,
  ): { aluguel: number; m2: number; pricePerM2: number } {
    const { criterionFieldValues } = data;

    // Usar apenas o criterionId fornecido (genérico, sem hardcoding de nomes)
    const key = `${cityId}-${criterionId}`;

    const fieldValues: Record<string, number | string> =
      criterionFieldValues?.[key] || {};

    const warehouses: Array<{ id: string; aluguel: number; m2: number }> = [];

    // Extrair valores de galpões (formato: warehouseId-aluguel, warehouseId-m2)
    Object.keys(fieldValues).forEach((fieldKey) => {
      if (fieldKey.endsWith('-aluguel') || fieldKey.endsWith('-m2')) {
        const parts = fieldKey.split('-');
        if (parts.length >= 2) {
          const warehouseId = parts.slice(0, -1).join('-');
          const fieldType = parts[parts.length - 1];

          if (fieldType === 'aluguel' || fieldType === 'm2') {
            const value = fieldValues[fieldKey];
            if (typeof value === 'number' && value > 0) {
              let warehouse = warehouses.find((w) => w.id === warehouseId);
              if (!warehouse) {
                warehouse = { id: warehouseId, aluguel: 0, m2: 0 };
                warehouses.push(warehouse);
              }
              if (fieldType === 'aluguel') {
                warehouse.aluguel = value;
              } else {
                warehouse.m2 = value;
              }
            }
          }
        }
      }
    });

    if (warehouses.length === 0) {
      return { aluguel: 0, m2: 0, pricePerM2: 0 };
    }

    let totalAluguel = 0;
    let totalM2 = 0;
    let totalPricePerM2 = 0;
    let count = 0;

    warehouses.forEach((w) => {
      if (w.aluguel > 0 || w.m2 > 0) {
        totalAluguel += w.aluguel;
        totalM2 += w.m2;
        const pricePerM2 = w.m2 > 0 ? w.aluguel / w.m2 : 0;
        totalPricePerM2 += pricePerM2;
        count++;
      }
    });

    const avgCount = count > 0 ? count : 1;
    return {
      aluguel: totalAluguel / avgCount,
      m2: totalM2 / avgCount,
      pricePerM2: totalPricePerM2 / avgCount,
    };
  }

  /**
   * Calcula prioridades AHP para um critério específico comparando cidades
   * Genérico: funciona para qualquer critério usando criterionFieldValues
   */
  private calculateCriterionCityPriorities(
    data: CreateProjectDto,
    criterionId: string,
  ): AhpPrioritiesResult {
    const { cities, criterionFieldValues } = data;

    const getValue = (cityAId: string, cityBId: string): number | null => {
      // Usar apenas o criterionId fornecido (genérico)
      const key = `${cityAId}-${criterionId}`;
      const fieldValues = criterionFieldValues?.[key];
      if (fieldValues) {
        // Buscar valor AHP genérico (formato: ahp-{criterionId}-{cityBId} ou ahp-{cityBId})
        const value =
          fieldValues[`ahp-${criterionId}-${cityBId}`] ||
          fieldValues[`ahp-${cityBId}`] ||
          fieldValues[`ahp-value-${cityBId}`];
        if (typeof value === 'number' && value > 0) {
          return value;
        }
      }
      return null;
    };

    const cityIds = cities.map((c) => c.id);
    const matrixResult = this.buildAhpMatrix(cityIds, getValue);
    return this.calculatePriorities(matrixResult);
  }

  /**
   * Calcula score de uma cidade para um critério
   */
  private calculateCityCriterionScore(
    data: CreateProjectDto,
    criterionId: string,
    cityId: string,
  ): number {
    const { subCriteria = [] } = data;

    const subs = subCriteria.filter((sc) => sc.criterionId === criterionId);
    if (subs.length === 0) {
      return 0;
    }

    const subWeightPriorities = this.calculateSubWeightPriorities(
      data,
      criterionId,
    );
    const equalWeight = subs.length > 0 ? 1 / subs.length : 0;

    let total = 0;
    subs.forEach((sc) => {
      const subPriorities = this.calculateSubCriterionPriorities(data, sc.id);
      const cityPriority = subPriorities.priorities[cityId] || 0;
      const weight = subWeightPriorities.priorities[sc.id] ?? equalWeight;
      total += cityPriority * weight;
    });

    return total;
  }

  /**
   * Calcula todos os resultados
   */
  calculate(data: CreateProjectDto): CalculationResult {
    // Prioridades dos critérios
    const criteriaPriorities = this.calculateCriteriaPriorities(data);
    const criteriaConsistency = this.calculateConsistencyMetrics(
      {
        matrix: criteriaPriorities.matrix,
        ids: criteriaPriorities.ids,
      },
      criteriaPriorities.priorities,
    );

    // Prioridades de subcritérios
    const subCriterionPriorities: Record<string, AhpPrioritiesResult> = {};
    const subCriterionConsistency: Record<string, ConsistencyMetrics> = {};

    if (data.subCriteria) {
      data.subCriteria.forEach((sub) => {
        const priorities = this.calculateSubCriterionPriorities(data, sub.id);
        subCriterionPriorities[sub.id] = priorities;

        const consistency = this.calculateConsistencyMetrics(
          {
            matrix: priorities.matrix,
            ids: priorities.ids,
          },
          priorities.priorities,
        );
        subCriterionConsistency[sub.id] = consistency;
      });
    }

    // Pesos entre subcritérios
    const subWeightPriorities: Record<string, AhpPrioritiesResult> = {};
    data.criteria.forEach((criterion) => {
      const priorities = this.calculateSubWeightPriorities(data, criterion.id);
      if (Object.keys(priorities.priorities).length > 0) {
        subWeightPriorities[criterion.id] = priorities;
      }
    });

    // Scores de cidades por critério
    const cityCriterionScores: Record<string, Record<string, number>> = {};
    data.cities.forEach((city) => {
      cityCriterionScores[city.id] = {};
      data.criteria.forEach((criterion) => {
        cityCriterionScores[city.id][criterion.id] =
          this.calculateCityCriterionScore(data, criterion.id, city.id);
      });
    });

    // Scores finais
    const finalScores: Record<string, number> = {};
    data.cities.forEach((city) => {
      let total = 0;
      data.criteria.forEach((criterion) => {
        const weight = criteriaPriorities.priorities[criterion.id] || 0;
        const score = cityCriterionScores[city.id][criterion.id] || 0;
        total += weight * score;
      });
      finalScores[city.id] = total;
    });

    // Ranking
    const ranking = data.cities
      .map((city) => ({
        id: city.id,
        name: city.name,
        score: finalScores[city.id] || 0,
        formattedScore: `${((finalScores[city.id] || 0) * 100).toFixed(2)}%`,
      }))
      .sort((a, b) => b.score - a.score);

    return {
      criteriaPriorities,
      criteriaConsistency,
      subCriterionPriorities,
      subCriterionConsistency,
      subWeightPriorities,
      cityCriterionScores,
      finalScores,
      ranking,
    };
  }

  /**
   * Calcula prioridades de um critério específico (método público)
   * Genérico: funciona para qualquer critério
   */
  getCriterionCityPriorities(
    data: CreateProjectDto,
    criterionId: string,
  ): AhpPrioritiesResult {
    return this.calculateCriterionCityPriorities(data, criterionId);
  }

  /**
   * Calcula prioridades de distância (método público)
   */
  getDistancePriorities(
    data: CreateProjectDto,
    portId: string,
  ): Record<string, number> {
    return this.calculateDistancePriorities(data, portId);
  }

  /**
   * Calcula médias de campos numéricos de uma cidade para um critério (método público)
   * Genérico: funciona para qualquer critério
   */
  getCityFieldAverages(
    data: CreateProjectDto,
    cityId: string,
    criterionId: string,
  ): { aluguel: number; m2: number; pricePerM2: number } {
    return this.calculateCityFieldAverages(data, cityId, criterionId);
  }
}
