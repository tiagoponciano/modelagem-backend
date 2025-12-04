import {
  IsString,
  IsArray,
  IsObject,
  ValidateNested,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class OptionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

class CriterionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

export class CreateProjectDto {
  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  cities: OptionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria: CriterionDto[];

  @IsObject()
  criteriaMatrix: Record<string, number>; // Ex: "idA-idB": 5

  @IsObject()
  evaluationValues: Record<string, number>; // Ex: "idCity-idCrit": 5000

  @IsObject()
  criteriaConfig: Record<string, 'BENEFIT' | 'COST'>; // Ex: "idCrit": "COST"
}
