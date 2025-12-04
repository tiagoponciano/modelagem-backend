import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';

export interface AhpCalculationResult {
  criteriaWeights: Record<string, number>;
  ranking: Array<{
    id: string;
    name: string;
    score: number;
    formattedScore: string;
  }>;
  matrixRaw: number[][];
}

@Injectable()
export class AhpService {
  calculate(data: CreateProjectDto): AhpCalculationResult {
    const {
      criteria,
      cities,
      criteriaMatrix,
      evaluationValues,
      criteriaConfig,
    } = data;

    if (!criteria || criteria.length === 0) {
      throw new BadRequestException('Pelo menos um critério é necessário');
    }

    if (!cities || cities.length === 0) {
      throw new BadRequestException('Pelo menos uma cidade é necessária');
    }

    if (!criteriaMatrix || Object.keys(criteriaMatrix).length === 0) {
      throw new BadRequestException(
        'A matriz de comparação de critérios está vazia. É necessário comparar os critérios entre si.',
      );
    }

    if (!evaluationValues || Object.keys(evaluationValues).length === 0) {
      throw new BadRequestException(
        'Os valores de avaliação estão vazios. É necessário avaliar as cidades para cada critério.',
      );
    }

    if (!criteriaConfig || Object.keys(criteriaConfig).length === 0) {
      throw new BadRequestException(
        'A configuração dos critérios está vazia. É necessário definir o tipo (BENEFIT ou COST) para cada critério.',
      );
    }

    // Verificar se todos os critérios têm configuração
    const missingConfig = criteria.filter(
      (c) => !criteriaConfig[c.id],
    );
    if (missingConfig.length > 0) {
      throw new BadRequestException(
        `Os seguintes critérios não têm configuração definida: ${missingConfig.map((c) => c.name).join(', ')}`,
      );
    }

    const n = criteria.length;
    const matrix = this.buildComparisonMatrix(criteria, criteriaMatrix, n);
    const criteriaWeights = this.calculateCriteriaWeights(matrix, criteria);
    const normalizedValues = this.normalizeEvaluationValues(
      criteria,
      cities,
      evaluationValues,
      criteriaConfig,
    );
    const ranking = this.calculateRanking(
      cities,
      criteria,
      criteriaWeights,
      normalizedValues,
    );

    return {
      criteriaWeights,
      ranking,
      matrixRaw: matrix,
    };
  }

  private buildComparisonMatrix(
    criteria: Array<{ id: string; name: string }>,
    criteriaMatrix: Record<string, number>,
    n: number,
  ): number[][] {
    const matrix = Array(n)
      .fill(null)
      .map(() => Array(n).fill(1));
    const criteriaIds = criteria.map((c) => c.id);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const idA = criteriaIds[i];
        const idB = criteriaIds[j];

        let val = criteriaMatrix[`${idA}-${idB}`];

        if (val !== undefined) {
          matrix[i][j] = val;
          matrix[j][i] = 1 / val;
        } else {
          val = criteriaMatrix[`${idB}-${idA}`];
          if (val !== undefined) {
            matrix[j][i] = val;
            matrix[i][j] = 1 / val;
          }
        }
      }
    }

    return matrix;
  }

  private calculateCriteriaWeights(
    matrix: number[][],
    criteria: Array<{ id: string; name: string }>,
  ): Record<string, number> {
    const n = matrix.length;
    const columnSums = Array(n).fill(0);

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        columnSums[j] += matrix[i][j];
      }
    }

    const criteriaWeights: Record<string, number> = {};
    const criteriaIds = criteria.map((c) => c.id);

    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (let j = 0; j < n; j++) {
        rowSum += matrix[i][j] / columnSums[j];
      }
      criteriaWeights[criteriaIds[i]] = rowSum / n;
    }

    return criteriaWeights;
  }

  private normalizeEvaluationValues(
    criteria: Array<{ id: string; name: string }>,
    cities: Array<{ id: string; name: string }>,
    evaluationValues: Record<string, number>,
    criteriaConfig: Record<string, 'BENEFIT' | 'COST'>,
  ): Record<string, number> {
    const normalizedValues: Record<string, number> = {};

    criteria.forEach((crit) => {
      const type = criteriaConfig[crit.id] || 'BENEFIT';

      const rawValues = cities.map(
        (city) => evaluationValues[`${city.id}-${crit.id}`] || 0,
      );
      const maxVal = Math.max(...rawValues);
      const minVal = Math.min(...rawValues);

      cities.forEach((city) => {
        const val = evaluationValues[`${city.id}-${crit.id}`] || 0;
        let normVal = 0;

        if (maxVal === 0 && minVal === 0) {
          normVal = 0;
        } else if (type === 'BENEFIT') {
          normVal = val / maxVal;
        } else {
          normVal = val === 0 ? 1 : minVal / val;
        }

        normalizedValues[`${city.id}-${crit.id}`] = normVal;
      });
    });

    return normalizedValues;
  }

  private calculateRanking(
    cities: Array<{ id: string; name: string }>,
    criteria: Array<{ id: string; name: string }>,
    criteriaWeights: Record<string, number>,
    normalizedValues: Record<string, number>,
  ): Array<{
    id: string;
    name: string;
    score: number;
    formattedScore: string;
  }> {
    const ranking = cities.map((city) => {
      let score = 0;

      criteria.forEach((crit) => {
        const weight = criteriaWeights[crit.id];
        const normValue = normalizedValues[`${city.id}-${crit.id}`];
        score += weight * normValue;
      });

      return {
        id: city.id,
        name: city.name,
        score: score * 100,
        formattedScore: (score * 100).toFixed(2) + '%',
      };
    });

    ranking.sort((a, b) => b.score - a.score);

    return ranking;
  }
}
