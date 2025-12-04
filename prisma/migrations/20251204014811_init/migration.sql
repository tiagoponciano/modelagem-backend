-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Concluído',
    "alternativesCount" INTEGER NOT NULL,
    "criteriaCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "criteriaWeights" JSONB NOT NULL,
    "ranking" JSONB NOT NULL,
    "matrixRaw" JSONB NOT NULL,
    "originalData" JSONB NOT NULL
);
