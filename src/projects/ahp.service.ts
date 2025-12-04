import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class AhpService {
  calculate(data: CreateProjectDto) {
    const {
      criteria,
      cities,
      criteriaMatrix,
      evaluationValues,
      criteriaConfig,
    } = data;
    const n = criteria.length;

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

    const columnSums = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        columnSums[j] += matrix[i][j];
      }
    }

    const criteriaWeights: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (let j = 0; j < n; j++) {
        rowSum += matrix[i][j] / columnSums[j];
      }
      criteriaWeights[criteriaIds[i]] = rowSum / n;
    }

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

    return {
      criteriaWeights,
      ranking,
      matrixRaw: matrix,
    };
  }
}
