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

    // --- PASSO 1: CALCULAR PESOS DOS CRITÉRIOS (AHP) ---

    // 1.1 Montar Matriz Quadrada (n x n)
    const matrix = Array(n)
      .fill(null)
      .map(() => Array(n).fill(1));
    const criteriaIds = criteria.map((c) => c.id);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const idA = criteriaIds[i];
        const idB = criteriaIds[j];

        // Tenta achar "A-B" ou "B-A" no objeto de julgamentos
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

    // 1.2 Normalizar a Matriz e Calcular Vetor de Prioridades (Pesos)
    const columnSums = Array(n).fill(0);
    // Soma das colunas
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        columnSums[j] += matrix[i][j];
      }
    }

    // Média das linhas normalizadas = Peso do Critério
    const criteriaWeights: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (let j = 0; j < n; j++) {
        rowSum += matrix[i][j] / columnSums[j];
      }
      criteriaWeights[criteriaIds[i]] = rowSum / n;
    }

    // --- PASSO 2: NORMALIZAR DADOS DAS OPÇÕES (WSM) ---

    const normalizedValues: Record<string, number> = {}; // chave: cityId-critId

    criteria.forEach((crit) => {
      const type = criteriaConfig[crit.id] || 'BENEFIT'; // Padrão: Maior é Melhor

      // Pega todos os valores deste critério para achar Min e Max
      const rawValues = cities.map(
        (city) => evaluationValues[`${city.id}-${crit.id}`] || 0,
      );
      const maxVal = Math.max(...rawValues);
      const minVal = Math.min(...rawValues);

      cities.forEach((city) => {
        const val = evaluationValues[`${city.id}-${crit.id}`] || 0;
        let normVal = 0;

        if (maxVal === 0 && minVal === 0) {
          normVal = 0; // Evita divisão por zero se tudo for 0
        } else if (type === 'BENEFIT') {
          // Benefício: Valor / Máximo (O melhor vira 1.0)
          normVal = val / maxVal;
        } else {
          // Custo: Mínimo / Valor (O menor vira 1.0, o maior diminui)
          // Se valor for 0, assumimos performance perfeita (1.0) para evitar erro
          normVal = val === 0 ? 1 : minVal / val;
        }

        normalizedValues[`${city.id}-${crit.id}`] = normVal;
      });
    });

    // --- PASSO 3: RANKING FINAL ---
    const ranking = cities.map((city) => {
      let score = 0;

      // Somatório (Peso do Critério * Valor Normalizado da Cidade)
      criteria.forEach((crit) => {
        const weight = criteriaWeights[crit.id];
        const normValue = normalizedValues[`${city.id}-${crit.id}`];
        score += weight * normValue;
      });

      return {
        id: city.id,
        name: city.name,
        score: score * 100, // Pontuação 0-100
        formattedScore: (score * 100).toFixed(2) + '%',
      };
    });

    // Ordena do vencedor para o perdedor
    ranking.sort((a, b) => b.score - a.score);

    return {
      criteriaWeights,
      ranking,
      matrixRaw: matrix, // Útil para debugar
    };
  }
}
