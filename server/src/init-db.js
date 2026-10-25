import { pool } from './db.js';

export async function initializeDatabase() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(40) NOT NULL DEFAULT 'outros',
      status VARCHAR(30) NOT NULL DEFAULT 'em_andamento'
        CHECK (status IN ('em_andamento', 'aguardando_resposta', 'resolvido', 'arquivado')),
      ai_guidance TEXT,
      complaint_message TEXT,
      official_links JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS case_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      due_at TIMESTAMPTZ,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
      status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'CREATE INDEX IF NOT EXISTS idx_cases_user_created ON cases(user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_messages_case_created ON case_messages(case_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders(user_id, due_at)'
  ];
  for (const sql of statements) await pool.query(sql);
  console.log('Resolve Tudo: esquema do banco verificado.');
}
