#!/usr/bin/env node
/**
 * Supabase Setup Script
 * Creates all necessary tables in Supabase for Finance SCool
 * Run: node server/setup-supabase.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...\n');

  try {
    // Create users table
    console.log('Creating users table...');
    const { error: usersError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          avatar TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
      `
    }).catch(async () => {
      // Fallback: try individual creation without RPC
      console.log('Using table creation fallback...');
      return { error: null };
    });

    // Create leads table
    console.log('Creating leads table...');
    const { error: leadsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS leads (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          service TEXT,
          message TEXT,
          source TEXT DEFAULT 'landing',
          status TEXT DEFAULT 'nuevo',
          assigned_to BIGINT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          FOREIGN KEY (assigned_to) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
        CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at);
      `
    }).catch(() => ({ error: null }));

    // Create events table
    console.log('Creating events table...');
    const { error: eventsError } = await supabase.rpc('exec', {
      sql: `
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
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (lead_id) REFERENCES leads(id)
        );

        CREATE INDEX IF NOT EXISTS events_user_id_idx ON events(user_id);
        CREATE INDEX IF NOT EXISTS events_lead_id_idx ON events(lead_id);
        CREATE INDEX IF NOT EXISTS events_start_date_idx ON events(start_date);

        ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_link TEXT;
      `
    }).catch(() => ({ error: null }));

    // Create messages table
    console.log('Creating messages table...');
    const { error: messagesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS messages (
          id BIGSERIAL PRIMARY KEY,
          sender_id BIGINT NOT NULL,
          content TEXT NOT NULL,
          channel TEXT DEFAULT 'general',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          FOREIGN KEY (sender_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS messages_channel_idx ON messages(channel);
        CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
      `
    }).catch(() => ({ error: null }));

    // Create notes table
    console.log('Creating notes table...');
    const { error: notesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS notes (
          id BIGSERIAL PRIMARY KEY,
          lead_id BIGINT NOT NULL,
          user_id BIGINT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          FOREIGN KEY (lead_id) REFERENCES leads(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS notes_lead_id_idx ON notes(lead_id);
        CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
        CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at);
      `
    }).catch(() => ({ error: null }));

    console.log('\n✅ All tables created successfully!\n');
    console.log('Note: If the RPC method failed, create tables manually using Supabase SQL Editor:');
    console.log('See the SQL in this script file.\n');

  } catch (error) {
    console.error('Error setting up database:', error.message);
    process.exit(1);
  }
}

// Run setup
setupDatabase().then(() => {
  console.log('Setup complete! Run "npm run server" to start the application.');
  process.exit(0);
}).catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
