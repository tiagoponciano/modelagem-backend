# AHP Backend API

API REST para análise de decisão multicritério utilizando o método AHP (Analytic Hierarchy Process). Desenvolvida com NestJS e Prisma, oferece cálculo automático de pesos de critérios, normalização de avaliações e geração de rankings de alternativas.

## Stack Tecnológica

- **NestJS 11** - Framework Node.js
- **Prisma 7** - ORM com type-safety
- **SQLite** - Banco de dados (configurável para PostgreSQL/MySQL)
- **TypeScript** - Tipagem estática
- **Swagger** - Documentação interativa

## Requisitos

- Node.js 18+
- npm ou yarn

## Instalação

Clone o repositório e instale as dependências:

```bash
npm install
```

Configure o arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="file:./dev.db"
PORT=3001
FRONTEND_URL=http://localhost:3000
```

Execute as migrações e gere o Prisma Client:

```bash
npx prisma migrate dev
npx prisma generate
```

## Executando

Desenvolvimento com hot-reload:

```bash
npm run start:dev
```

Produção:

```bash
npm run build
npm run start:prod
```

A API estará disponível em `http://localhost:3001` e a documentação Swagger em `http://localhost:3001/api`.

## Estrutura do Projeto

```
src/
├── common/
│   ├── filters/          # Filtros globais de exceção
│   └── validators/       # Validadores customizados
├── config/               # Configuração da aplicação
├── prisma/               # Serviço Prisma
├── projects/             # Módulo principal
│   ├── dto/              # Data Transfer Objects
│   ├── ahp.service.ts    # Lógica de cálculo AHP
│   ├── projects.controller.ts
│   ├── projects.repository.ts
│   └── projects.module.ts
└── main.ts
```

## API Endpoints

### POST /projects

Cria um novo projeto e calcula os resultados AHP automaticamente.

**Request Body:**

```json
{
  "title": "Análise de Localização",
  "cities": [
    { "id": "uuid-1", "name": "São Paulo" },
    { "id": "uuid-2", "name": "Rio de Janeiro" }
  ],
  "criteria": [
    { "id": "uuid-3", "name": "Custo" },
    { "id": "uuid-4", "name": "Acessibilidade" }
  ],
  "criteriaMatrix": {
    "uuid-3-uuid-4": 3
  },
  "evaluationValues": {
    "uuid-1-uuid-3": 1000,
    "uuid-1-uuid-4": 8,
    "uuid-2-uuid-3": 1200,
    "uuid-2-uuid-4": 9
  },
  "criteriaConfig": {
    "uuid-3": "COST",
    "uuid-4": "BENEFIT"
  }
}
```

**Response:**

```json
{
  "id": "project-uuid",
  "title": "Análise de Localização",
  "results": {
    "criteriaWeights": { "uuid-3": 0.25, "uuid-4": 0.75 },
    "ranking": [
      {
        "id": "uuid-2",
        "name": "Rio de Janeiro",
        "score": 85.5,
        "formattedScore": "85.50%"
      },
      {
        "id": "uuid-1",
        "name": "São Paulo",
        "score": 72.3,
        "formattedScore": "72.30%"
      }
    ],
    "matrixRaw": [
      [1, 0.33],
      [3, 1]
    ]
  },
  "criteria": [
    { "id": "uuid-3", "name": "Custo" },
    { "id": "uuid-4", "name": "Acessibilidade" }
  ],
  "createdAt": "2025-12-04T00:00:00.000Z",
  "updatedAt": "2025-12-04T00:00:00.000Z",
  "status": "Concluído",
  "alternativesCount": 2,
  "criteriaCount": 2
}
```

### GET /projects

Retorna lista de todos os projetos ordenados por data de criação (mais recentes primeiro).

### GET /projects/:id

Retorna um projeto específico por ID. Retorna 404 se não encontrado.

### PATCH /projects/:id

Atualiza um projeto existente. Comportamento:

- Se apenas `title` for enviado: atualiza apenas o título sem recalcular resultados
- Se outros campos forem enviados: mescla com dados existentes e recalcula resultados AHP automaticamente

**Request Body (exemplo):**

```json
{
  "title": "Análise Atualizada",
  "criteriaMatrix": {
    "uuid-3-uuid-4": 5
  }
}
```

### DELETE /projects/:id

Remove um projeto do banco de dados. Retorna 204 No Content.

## Validação

Todos os endpoints validam os dados de entrada:

- Campos obrigatórios
- Tipos de dados
- Tamanhos mínimos (arrays, strings)
- Objetos não vazios (criteriaMatrix, evaluationValues, criteriaConfig)
- Configuração completa de critérios

Erros de validação retornam status 400 com array de mensagens específicas.

## Cálculo AHP

O serviço `AhpService` implementa o método AHP completo:

1. **Matriz de Comparação**: Constrói matriz de comparação entre critérios
2. **Pesos dos Critérios**: Calcula pesos normalizados usando média geométrica
3. **Normalização**: Normaliza valores de avaliação (BENEFIT: max, COST: min)
4. **Ranking**: Calcula score final ponderado e ordena alternativas

## Banco de Dados

O projeto usa SQLite por padrão. Para migrar para outro banco:

1. Altere o `provider` em `prisma/schema.prisma`
2. Atualize `DATABASE_URL` no `.env`
3. Execute `npx prisma migrate dev`

### Comandos Úteis

```bash
# Criar nova migração
npx prisma migrate dev --name nome_da_migracao

# Visualizar dados
npx prisma studio

# Resetar banco (desenvolvimento)
npx prisma migrate reset
```

## Desenvolvimento

### Scripts Disponíveis

- `npm run build` - Compila TypeScript
- `npm run start:dev` - Desenvolvimento com watch
- `npm run start:prod` - Produção
- `npm run lint` - Executa ESLint
- `npm run format` - Formata código com Prettier
- `npm run test` - Testes unitários
- `npm run test:e2e` - Testes end-to-end

### Arquitetura

O projeto segue padrões do NestJS:

- **Controllers**: Gerenciam requisições HTTP
- **Services**: Contêm lógica de negócio
- **Repositories**: Abstraem acesso ao banco
- **DTOs**: Definem contratos de entrada/saída
- **Filters**: Tratam exceções globalmente

## Tratamento de Erros

Exceções são capturadas pelo `HttpExceptionFilter` que:

- Padroniza formato de resposta
- Registra erros em logs
- Retorna mensagens descritivas
- Inclui detalhes de validação quando aplicável

## Documentação

A documentação completa está disponível via Swagger em `/api` quando o servidor estiver rodando. Inclui:

- Descrição de todos os endpoints
- Schemas de request/response
- Exemplos interativos
- Teste direto dos endpoints

## Licença

UNLICENSED
