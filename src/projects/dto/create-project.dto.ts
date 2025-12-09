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

class SubCriterionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  criterionId: string;
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubCriterionDto)
  @IsOptional()
  subCriteria?: SubCriterionDto[];

  @IsObject()
  criteriaMatrix: Record<string, number>;

  @IsObject()
  @IsOptional()
  evaluationValues?: Record<string, number>;

  @IsObject()
  @IsOptional()
  criteriaConfig?: Record<string, 'BENEFIT' | 'COST'>;

  @IsObject()
  @IsOptional()
  criterionFieldValues?: Record<string, Record<string, number | string>>;
}
