import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const server = new McpServer({
  name: "binary-ai-signals-mcp",
  version: "1.0.0",
});

type FileMap = Record<string, string>;

const disclaimer = `
Este projeto possui finalidade exclusivamente educacional e de pesquisa.
Não prometer lucro.
Não garantir assertividade.
Não fornecer recomendação de investimento.
Mercados financeiros são voláteis e envolvem risco.
`.trim();

function safeJoin(rootDir: string, targetRelative: string): string {
  const root = resolve(rootDir);
  const target = resolve(root, targetRelative);

  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path traversal bloqueado: ${targetRelative}`);
  }

  return target;
}

async function writeTemplateFile(
  rootDir: string,
  relativePath: string,
  content: string,
  force = false
) {
  const absolutePath = safeJoin(rootDir, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });

  if (!force) {
    try {
      await stat(absolutePath);
      return { path: relativePath, created: false };
    } catch {
      // arquivo não existe
    }
  }

  await writeFile(absolutePath, content, "utf8");
  return { path: relativePath, created: true };
}

async function writeFiles(rootDir: string, files: FileMap, force = false) {
  const results = [];
  for (const [path, content] of Object.entries(files)) {
    const result = await writeTemplateFile(rootDir, path, content, force);
    results.push(result);
  }
  return results;
}

function pascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function camelCase(input: string): string {
  const p = pascalCase(input);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function buildRootProjectFiles(): FileMap {
  return {
    ".env.example": `
NODE_ENV=development
PORT=3000
APP_NAME=Binary AI Signals

DATABASE_URL=postgresql://postgres:postgres@postgres:5432/binary_ai_signals
REDIS_URL=redis://redis:6379

JWT_SECRET=change_me
JWT_REFRESH_SECRET=change_me_refresh
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

CORS_ORIGIN=http://localhost:5173

WHATSAPP_SESSION_NAME=binary-ai-signals
WHATSAPP_ENABLED=true

MARKET_DATA_PROVIDER=alpha_vantage
MARKET_DATA_API_KEY=your_api_key
MARKET_DATA_BASE_URL=https://www.alphavantage.co

AI_PROVIDER=openai
AI_API_KEY=your_ai_key
AI_MODEL=gpt-4.1-mini

LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
`.trimStart(),

    "README.md": `
# Binary AI Signals

Plataforma educacional de análise técnica, com backend, frontend, WhatsApp bot, IA e banco PostgreSQL.

## Aviso
Este projeto é exclusivamente educacional e de pesquisa.
Não constitui recomendação de investimento.

## Estrutura
- backend/
- frontend/
- whatsapp/
- ai/
- market/
- indicators/
- patterns/
- database/
- docker/

## Como usar o MCP
Use as tools deste servidor para gerar a estrutura real do projeto no diretório desejado.
`.trimStart(),

    "docker-compose.yml": `
services:
  postgres:
    image: postgres:16
    container_name: binary-ai-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: binary_ai_signals
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: binary-ai-redis
    restart: unless-stopped
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
    container_name: binary-ai-backend
    restart: unless-stopped
    env_file:
      - ./.env
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"

  frontend:
    build:
      context: ./frontend
    container_name: binary-ai-frontend
    restart: unless-stopped
    ports:
      - "5173:80"

  nginx:
    image: nginx:alpine
    container_name: binary-ai-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
`.trimStart(),

    "docker/nginx/default.conf": `
server {
  listen 80;
  server_name _;

  location /api/ {
    proxy_pass http://backend:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://frontend:80;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`.trimStart(),

    "backend/package.json": `
{
  "name": "binary-ai-signals-backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
`.trimStart(),

    "backend/tsconfig.json": `
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
`.trimStart(),

    "backend/src/server.ts": `
import http from "node:http";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

http.createServer(app).listen(port, () => {
  console.log(\`[backend] listening on port \${port}\`);
});
`.trimStart(),

    "backend/src/app.ts": `
import express from "express";
import cors from "cors";
import helmet from "helmet";

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Binary AI Signals Backend",
    timestamp: new Date().toISOString(),
  });
});
`.trimStart(),

    "backend/src/config/env.ts": `
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
`.trimStart(),

    "backend/src/shared/errors/AppError.ts": `
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}
`.trimStart(),

    "backend/src/shared/http/json.ts": `
import { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}
`.trimStart(),

    "backend/prisma/schema.prisma": `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Usuario {
  id                   String   @id @default(cuid())
  nome                 String
  telefone             String?  @unique
  email                String   @unique
  senha_hash           String
  status               String   @default("ativo")
  plano_id             String?
  consultas_realizadas Int      @default(0)
  ultimo_login         DateTime?
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt
}

model Plano {
  id             String   @id @default(cuid())
  nome           String
  valor          Decimal  @db.Decimal(10, 2)
  duracao_dias   Int
  limite_consultas Int
  ativo          Boolean  @default(true)
}
`.trimStart(),

    "frontend/package.json": `
{
  "name": "binary-ai-signals-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.13.3",
    "@emotion/styled": "^11.13.0",
    "@mui/material": "^6.1.7",
    "@mui/icons-material": "^6.1.7",
    "@tanstack/react-query": "^5.59.16",
    "chart.js": "^4.4.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.7.2",
    "vite": "^5.4.10"
  }
}
`.trimStart(),

    "frontend/tsconfig.json": `
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
`.trimStart(),

    "frontend/vite.config.ts": `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
`.trimStart(),

    "frontend/index.html": `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Binary AI Signals</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`.trimStart(),

    "frontend/src/main.tsx": `
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ThemeProvider, CssBaseline } from "@mui/material";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CssBaseline />
    <App />
  </React.StrictMode>
);
`.trimStart(),

    "frontend/src/App.tsx": `
import { Button, Container, Paper, Stack, Typography } from "@mui/material";

export function App() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h4" fontWeight={700}>
            Binary AI Signals
          </Typography>
          <Typography variant="body1">
            Plataforma educacional de análise técnica, dashboard e automações.
          </Typography>
          <Button variant="contained">Abrir Dashboard</Button>
        </Stack>
      </Paper>
    </Container>
  );
}
`.trimStart(),

    "frontend/src/theme.ts": `
export const themeMode = "dark";
`.trimStart(),
  };
}

function buildDomainModuleFiles(domain: string): FileMap {
  const Pascal = pascalCase(domain);
  const camel = camelCase(domain);

  return {
    [`backend/src/modules/${domain}/index.ts`]: `
export * from "./${domain}.controller.js";
export * from "./${domain}.service.js";
export * from "./${domain}.repository.js";
export * from "./${domain}.routes.js";
export * from "./${domain}.schema.js";
`.trimStart(),

    [`backend/src/modules/${domain}/${domain}.schema.ts`]: `
import { z } from "zod";

export const ${camel}CreateSchema = z.object({
  name: z.string().min(1)
});

export type ${Pascal}CreateInput = z.infer<typeof ${camel}CreateSchema>;
`.trimStart(),

    [`backend/src/modules/${domain}/${domain}.repository.ts`]: `
export type ${Pascal}Item = {
  id: string;
  name: string;
  createdAt: string;
};

export interface ${Pascal}Repository {
  list(): Promise<${Pascal}Item[]>;
}

export class InMemory${Pascal}Repository implements ${Pascal}Repository {
  async list(): Promise<${Pascal}Item[]> {
    return [];
  }
}
`.trimStart(),

    [`backend/src/modules/${domain}/${domain}.service.ts`]: `
import { ${Pascal}Repository } from "./${domain}.repository.js";

export class ${Pascal}Service {
  constructor(private readonly repository: ${Pascal}Repository) {}

  async list() {
    return this.repository.list();
  }
}
`.trimStart(),

    [`backend/src/modules/${domain}/${domain}.controller.ts`]: `
import { Request, Response } from "express";
import { ${Pascal}Service } from "./${domain}.service.js";

export class ${Pascal}Controller {
  constructor(private readonly service: ${Pascal}Service) {}

  list = async (_req: Request, res: Response) => {
    const items = await this.service.list();
    return res.json({
      success: true,
      domain: "${domain}",
      data: items
    });
  };
}
`.trimStart(),

    [`backend/src/modules/${domain}/${domain}.routes.ts`]: `
import { Router } from "express";
import { ${Pascal}Controller } from "./${domain}.controller.js";
import { ${Pascal}Service } from "./${domain}.service.js";
import { InMemory${Pascal}Repository } from "./${domain}.repository.js";

const router = Router();

const repository = new InMemory${Pascal}Repository();
const service = new ${Pascal}Service(repository);
const controller = new ${Pascal}Controller(service);

router.get("/", controller.list);

export { router as ${camel}Routes };
`.trimStart(),
  };
}

function buildIndicatorFiles(name: string): FileMap {
  const Pascal = pascalCase(name);
  const camel = camelCase(name);

  return {
    [`indicators/${name}/${name}.ts`]: `
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp?: string;
}

export interface IndicatorResult {
  values: number[];
  latest: number | null;
}

/**
 * ${Pascal}
 * Scaffold inicial do indicador. Pode ser substituído pela fórmula real depois.
 */
export function calculate(candles: Candle[]): IndicatorResult {
  if (candles.length === 0) {
    return { values: [], latest: null };
  }

  const values = candles.map((candle) => candle.close);
  return {
    values,
    latest: values.at(-1) ?? null
  };
}
`.trimStart(),

    [`indicators/${name}/index.ts`]: `
export * from "./${name}.js";
`.trimStart(),
  };
}

function buildPatternFiles(name: string): FileMap {
  const Pascal = pascalCase(name);

  return {
    [`patterns/${name}/${name}.ts`]: `
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp?: string;
}

export interface PatternDetection {
  detected: boolean;
  name: string;
  confidence: number;
}

/**
 * ${Pascal}
 * Scaffold inicial do padrão.
 */
export function detect(candles: Candle[]): PatternDetection {
  return {
    detected: false,
    name: "${Pascal}",
    confidence: 0
  };
}
`.trimStart(),

    [`patterns/${name}/index.ts`]: `
export * from "./${name}.js";
`.trimStart(),
  };
}

server.tool(
  "get_compliance_notice",
  {},
  async () => ({
    content: [{ type: "text", text: disclaimer }],
  })
);

server.tool(
  "bootstrap_project",
  {
    rootDir: z.string().min(1),
    force: z.boolean().default(false),
  },
  async ({ rootDir, force }) => {
    const files: FileMap = {
      ...buildRootProjectFiles(),
      ...buildDomainModuleFiles("auth"),
      ...buildDomainModuleFiles("users"),
      ...buildDomainModuleFiles("plans"),
      ...buildDomainModuleFiles("analysis"),
      ...buildDomainModuleFiles("market"),
      ...buildDomainModuleFiles("logs"),
      ...buildDomainModuleFiles("settings"),
      ...buildDomainModuleFiles("dashboard"),
      ...buildDomainModuleFiles("whatsapp"),
      ...buildDomainModuleFiles("ai"),
      ...buildIndicatorFiles("rsi"),
      ...buildIndicatorFiles("macd"),
      ...buildIndicatorFiles("ema"),
      ...buildPatternFiles("doji"),
      ...buildPatternFiles("engulfing"),
    };

    const results = await writeFiles(rootDir, files, force);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              rootDir,
              createdOrChecked: results.length,
              note: "Estrutura base do projeto gerada com sucesso.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "create_domain_module",
  {
    rootDir: z.string().min(1),
    domain: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Use apenas letras, números, _ e -"),
    force: z.boolean().default(false),
  },
  async ({ rootDir, domain, force }) => {
    const files = buildDomainModuleFiles(domain);
    const results = await writeFiles(rootDir, files, force);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              domain,
              filesCreatedOrChecked: results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "create_indicator_module",
  {
    rootDir: z.string().min(1),
    name: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Use apenas letras, números, _ e -"),
    force: z.boolean().default(false),
  },
  async ({ rootDir, name, force }) => {
    const files = buildIndicatorFiles(name);
    const results = await writeFiles(rootDir, files, force);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { indicator: name, filesCreatedOrChecked: results },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "create_pattern_module",
  {
    rootDir: z.string().min(1),
    name: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Use apenas letras, números, _ e -"),
    force: z.boolean().default(false),
  },
  async ({ rootDir, name, force }) => {
    const files = buildPatternFiles(name);
    const results = await writeFiles(rootDir, files, force);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { pattern: name, filesCreatedOrChecked: results },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "write_env_example",
  {
    rootDir: z.string().min(1),
    force: z.boolean().default(false),
  },
  async ({ rootDir, force }) => {
    const result = await writeTemplateFile(
      rootDir,
      ".env.example",
      buildRootProjectFiles()[".env.example"],
      force
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "write_docker_compose",
  {
    rootDir: z.string().min(1),
    force: z.boolean().default(false),
  },
  async ({ rootDir, force }) => {
    const files = buildRootProjectFiles();
    const result = await writeTemplateFile(
      rootDir,
      "docker-compose.yml",
      files["docker-compose.yml"],
      force
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "write_prisma_schema",
  {
    rootDir: z.string().min(1),
    force: z.boolean().default(false),
  },
  async ({ rootDir, force }) => {
    const files = buildRootProjectFiles();
    const result = await writeTemplateFile(
      rootDir,
      "backend/prisma/schema.prisma",
      files["backend/prisma/schema.prisma"],
      force
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
