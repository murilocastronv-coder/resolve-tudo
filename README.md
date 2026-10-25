# Resolve Tudo — MVP

MVP mobile-first em português brasileiro para registrar problemas do dia a dia, gerar orientações e acompanhar casos.

## Arquitetura
- `client/`: React + Vite, interface responsiva/PWA.
- `server/`: Node.js + Express, API, autenticação JWT, PostgreSQL e integração opcional com OpenAI API.
- `database/schema.sql`: esquema inicial.
- `render.yaml`: blueprint de exemplo para Render.

## Requisitos
- Node.js 20+
- PostgreSQL (local ou Render)
- Chave de API de IA opcional para habilitar respostas geradas por IA.

## Rodar localmente

### 1. Banco de dados
Crie um banco PostgreSQL e execute `database/schema.sql`.

### 2. API
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
Preencha `DATABASE_URL` e `JWT_SECRET`. Para usar a IA, preencha `OPENAI_API_KEY` e `OPENAI_MODEL`. Sem chave, a API retorna orientações de demonstração claramente identificadas.

### 3. Interface
Em outro terminal:
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
Abra a URL mostrada pelo Vite. Por padrão, a API está em `http://localhost:3001`.

## Deploy econômico no Render
1. Envie o conteúdo deste projeto para um repositório GitHub.
2. No Render, crie um PostgreSQL e copie a URL interna para `DATABASE_URL` do serviço da API quando ambos estiverem na mesma região.
3. Crie um Web Service para `server/` com:
   - Build command: `npm install`
   - Start command: `npm start`
   - Variáveis: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `OPENAI_API_KEY` (opcional), `OPENAI_MODEL` (opcional), `NODE_ENV=production`.
4. Execute `database/schema.sql` no banco usando um cliente PostgreSQL (ou adicione uma etapa de migração segura antes de produção).
5. Crie um Static Site para `client/`:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - `VITE_API_URL` apontando para a URL pública da API, terminando sem `/`.
6. Configure rewrite para SPA no Static Site: `/*` → `/index.html` (Rewrite).
7. Defina `CLIENT_ORIGIN` como a URL pública do site.

## Segurança e limites do MVP
- O JWT é usado como autenticação inicial. Para produção, considere cookies HttpOnly/Secure, rotação de tokens e recuperação de senha.
- Nunca publique `.env`; use variáveis secretas do Render.
- O MVP não aceita upload de arquivos ainda. Não envie dados pessoais sensíveis.
- As respostas da IA são informativas, não aconselhamento jurídico, financeiro ou médico; confirme prazos e direitos em fontes oficiais.
- Não há pagamentos implementados. `subscriptions` é apenas estrutura inicial.
- O SQL é inicial e pode precisar de migrações conforme o produto evoluir.
