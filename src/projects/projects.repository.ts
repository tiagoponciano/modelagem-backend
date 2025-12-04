import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Project } from '@prisma/client';

export interface CreateProjectData {
  title: string;
  criteriaWeights: Record<string, number>;
  ranking: Array<{
    id: string;
    name: string;
    score: number;
    formattedScore: string;
  }>;
  matrixRaw: number[][];
  originalData: any;
  alternativesCount: number;
  criteriaCount: number;
}

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProjectData): Promise<Project> {
    return this.prisma.project.create({
      data: {
        title: data.title,
        criteriaWeights: data.criteriaWeights,
        ranking: data.ranking,
        matrixRaw: data.matrixRaw,
        originalData: data.originalData,
        alternativesCount: data.alternativesCount,
        criteriaCount: data.criteriaCount,
      },
    });
  }

  async findAll(): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Partial<CreateProjectData>): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.criteriaWeights && { criteriaWeights: data.criteriaWeights }),
        ...(data.ranking && { ranking: data.ranking }),
        ...(data.matrixRaw && { matrixRaw: data.matrixRaw }),
        ...(data.originalData && { originalData: data.originalData }),
        ...(data.alternativesCount !== undefined && {
          alternativesCount: data.alternativesCount,
        }),
        ...(data.criteriaCount !== undefined && {
          criteriaCount: data.criteriaCount,
        }),
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({
      where: { id },
    });
  }
}

