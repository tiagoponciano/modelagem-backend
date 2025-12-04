import {
  IsString,
  IsArray,
  IsObject,
  ValidateNested,
  IsNotEmpty,
  IsEnum,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NotEmptyObject } from '../../common/validators/not-empty-object.validator';

export class OptionDto {
  @ApiProperty({ description: 'ID único da opção' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Nome da opção' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CriterionDto {
  @ApiProperty({ description: 'ID único do critério' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Nome do critério' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateProjectDto {
  @ApiProperty({ description: 'Título do projeto' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;

  @ApiProperty({
    description: 'Lista de cidades/alternativas',
    type: [OptionDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Pelo menos uma cidade é necessária' })
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  cities: OptionDto[];

  @ApiProperty({ description: 'Lista de critérios', type: [CriterionDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Pelo menos um critério é necessário' })
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria: CriterionDto[];

  @ApiProperty({
    description: 'Matriz de comparação entre critérios',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsObject({ message: 'A matriz de comparação de critérios é obrigatória' })
  @NotEmptyObject({
    message: 'A matriz de comparação de critérios não pode estar vazia',
  })
  criteriaMatrix: Record<string, number>;

  @ApiProperty({
    description: 'Valores de avaliação das cidades por critério',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsObject({ message: 'Os valores de avaliação são obrigatórios' })
  @NotEmptyObject({ message: 'Os valores de avaliação não podem estar vazios' })
  evaluationValues: Record<string, number>;

  @ApiProperty({
    description: 'Configuração do tipo de cada critério (BENEFIT ou COST)',
    type: 'object',
    additionalProperties: { enum: ['BENEFIT', 'COST'] },
  })
  @IsObject({ message: 'A configuração dos critérios é obrigatória' })
  @NotEmptyObject({
    message: 'A configuração dos critérios não pode estar vazia',
  })
  criteriaConfig: Record<string, 'BENEFIT' | 'COST'>;
}
