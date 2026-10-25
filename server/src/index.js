import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from './db.js';
import { initializeDatabase } from './init-db.js';
import { requireAuth } from './auth.js';
import { solveProblem } from './ai.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET precisa ser configurado.');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({
  origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '200kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'resolve-tudo-api' }));

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(100)
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(100)
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const hash = await bcrypt.hash(data.password, 12);
    const result = await pool.query(
      'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,created_at',
      [data.name, email, hash]
    );
    await pool.query('INSERT INTO subscriptions(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING', [result.rows[0].id]);
    const user = result.rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await pool.query('SELECT id,name,email,password_hash,created_at FROM users WHERE email=$1', [data.email.toLowerCase()]);
    const userRow = result.rows[0];
    if (!userRow || !(await bcrypt.compare(data.password, userRow.password_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    const user = { id: userRow.id, name: userRow.name, email: userRow.email, created_at: userRow.created_at };
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) { next(err); }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id,name,email,created_at FROM users WHERE id=$1', [req.user.sub]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

const caseSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10000),
  category: z.enum(['compras', 'cobrancas', 'servicos', 'outros']).default('outros')
});

app.post('/api/cases', requireAuth, async (req, res, next) => {
  try {
    const data = caseSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO cases(user_id,title,description,category) VALUES($1,$2,$3,$4) RETURNING *',
      [req.user.sub, data.title, data.description, data.category]
    );
    res.status(201).json({ case: result.rows[0] });
  } catch (err) { next(err); }
});

app.get('/api/cases', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id,title,description,category,status,created_at,updated_at FROM cases WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [req.user.sub]
    );
    res.json({ cases: result.rows });
  } catch (err) { next(err); }
});

app.get('/api/cases/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM cases WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Caso não encontrado.' });
    res.json({ case: result.rows[0] });
  } catch (err) { next(err); }
});

app.post('/api/ai/solve', requireAuth, async (req, res, next) => {
  try {
    const bodySchema = caseSchema.extend({ caseId: z.string().uuid().optional() });
    const data = bodySchema.parse(req.body);
    if (data.caseId) {
      const owned = await pool.query('SELECT id FROM cases WHERE id=$1 AND user_id=$2', [data.caseId, req.user.sub]);
      if (!owned.rows[0]) return res.status(404).json({ error: 'Caso não encontrado.' });
    }
    const solved = await solveProblem(data);
    if (data.caseId) {
      await pool.query(
        'UPDATE cases SET ai_guidance=$1, complaint_message=$2, official_links=$3::jsonb, updated_at=NOW() WHERE id=$4 AND user_id=$5',
        [solved.guidance, solved.complaintMessage, JSON.stringify(solved.links || []), data.caseId, req.user.sub]
      );
      await pool.query(
        'INSERT INTO case_messages(case_id,user_id,role,content) VALUES($1,$2,$3,$4)',
        [data.caseId, req.user.sub, 'assistant', solved.guidance]
      );
    }
    res.json(solved);
  } catch (err) { next(err); }
});

app.patch('/api/cases/:id/status', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ status: z.enum(['em_andamento', 'aguardando_resposta', 'resolvido', 'arquivado']) });
    const { status } = schema.parse(req.body);
    const result = await pool.query(
      'UPDATE cases SET status=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id,status,updated_at',
      [status, req.params.id, req.user.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Caso não encontrado.' });
    res.json({ case: result.rows[0] });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Confira os campos preenchidos.', details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
  console.error(err);
  res.status(500).json({ error: 'Ocorreu um erro. Tente novamente mais tarde.' });
});

const port = Number(process.env.PORT || 3001);
try {
  await initializeDatabase();
  app.listen(port, () => console.log(`Resolve Tudo API rodando na porta ${port}`));
} catch (err) {
  console.error('Falha ao inicializar o banco de dados:', err);
  process.exit(1);
}
