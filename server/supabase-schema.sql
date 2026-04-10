-- Finance SCool Supabase Schema
-- Run this SQL in your Supabase SQL Editor to create all tables

-- Users table
-- Roles: 'superadmin' (agency owner), 'agencia' (agency team), 'asesor' (Finance SCool advisors), 'admin' (legacy)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'asesor',
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  service TEXT,
  message TEXT,
  source TEXT DEFAULT 'landing',
  status TEXT DEFAULT 'nuevo',
  income_type TEXT,
  approx_income TEXT,
  declaracion TEXT,
  retiro_plan TEXT,
  assigned_to BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Migration: add CTA fields to existing leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS income_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS approx_income TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS declaracion TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS retiro_plan TEXT;

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads(assigned_to);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  all_day INTEGER DEFAULT 0,
  color TEXT DEFAULT '#C9A84C',
  user_id BIGINT,
  lead_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_lead_id FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS events_user_id_idx ON events(user_id);
CREATE INDEX IF NOT EXISTS events_lead_id_idx ON events(lead_id);
CREATE INDEX IF NOT EXISTS events_start_date_idx ON events(start_date);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_sender_id FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_channel_idx ON messages(channel);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_note_lead_id FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_note_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS notes_lead_id_idx ON notes(lead_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at);

-- WhatsApp Leads table
CREATE TABLE IF NOT EXISTS whatsapp_leads (
  id BIGSERIAL PRIMARY KEY,
  wa_id TEXT UNIQUE NOT NULL,
  contact_name TEXT,
  historial_chat TEXT DEFAULT '[]',
  estado TEXT DEFAULT 'nuevo',
  origin TEXT DEFAULT 'whatsapp',
  assigned_to TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  blocked BOOLEAN DEFAULT FALSE,
  modo_humano BOOLEAN DEFAULT FALSE,
  mensaje_pendiente TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_leads_wa_id_idx ON whatsapp_leads(wa_id);
CREATE INDEX IF NOT EXISTS whatsapp_leads_estado_idx ON whatsapp_leads(estado);
CREATE INDEX IF NOT EXISTS whatsapp_leads_last_message_idx ON whatsapp_leads(last_message_at);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id BIGSERIAL PRIMARY KEY,
  page TEXT DEFAULT '/',
  source TEXT DEFAULT 'direct',
  referrer TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visits_created_at_idx ON visits(created_at);
CREATE INDEX IF NOT EXISTS visits_page_idx ON visits(page);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT,
  user_id BIGINT,
  date DATE NOT NULL,
  time TEXT,
  type TEXT DEFAULT 'consulta',
  notes TEXT,
  status TEXT DEFAULT 'programada',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_appt_lead_id FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_appt_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(date);
CREATE INDEX IF NOT EXISTS appointments_user_id_idx ON appointments(user_id);

-- Migration: ensure fsc_conversations has modo_humano column
ALTER TABLE fsc_conversations ADD COLUMN IF NOT EXISTS modo_humano BOOLEAN DEFAULT FALSE;

-- Migration: ensure lead_states has modo_humano column (used by n8n workflow)
ALTER TABLE lead_states ADD COLUMN IF NOT EXISTS modo_humano BOOLEAN DEFAULT FALSE;
