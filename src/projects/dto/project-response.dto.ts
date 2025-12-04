import { ApiProperty } from '@nestjs/swagger';

export class RankingItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  score: number;

  @ApiProperty()
  formattedScore: string;
}

export class CriterionInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class ProjectResultsDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  criteriaWeights: Record<string, number>;

  @ApiProperty({ type: [RankingItemDto] })
  ranking: RankingItemDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  matrixRaw: number[][];
}

export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: ProjectResultsDto })
  results: ProjectResultsDto;

  @ApiProperty({
    type: [CriterionInfoDto],
    description: 'Lista de critérios com seus nomes',
  })
  criteria: CriterionInfoDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  alternativesCount: number;

  @ApiProperty()
  criteriaCount: number;
}
