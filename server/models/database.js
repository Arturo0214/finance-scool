const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jisfqytmoiaikaohyens.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '<SUPABASE_SERVICE_ROLE_KEY>';

let supabase;

function getDB() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

async function initDB() {
  const db = getDB();

  // Check if users table is accessible
  const { error: checkError } = await db.from('users').select('id').limit(1);

  if (checkError && checkError.code === 'PGRST116') {
    console.log('Tables not found. Please run setup-supabase.js first.');
    throw new Error('Supabase tables not initialized. Run setup-supabase.js');
  }

  if (checkError) {
    console.error('DB check error:', checkError.message);
    // Don't crash — maybe tables exist with RLS; continue
  }

  // Ensure admin user exists
  const { data: admin } = await db
    .from('users')
    .select('id')
    .eq('email', process.env.ADMIN_EMAIL || 'admin@financescool.com')
    .maybeSingle();

  if (!admin) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
    const { error } = await db.from('users').insert([{
      name: 'Arturo Suárez',
      email: process.env.ADMIN_EMAIL || 'admin@financescool.com',
      password: hash,
      role: 'superadmin'
    }]);
    if (!error) console.log('✅ Agency admin (Arturo) created — role: superadmin');
    else console.error('Admin seed error:', error.message);
  }

  // No seed users or demo data — team members are created via /admin/team
  // All leads come from real sources (landing form, WhatsApp, Meta campaigns)
}

// ─── SQL-to-Supabase query translator ──────────────────────────────────────
// Parses the simple parameterized SQL used across the routes and executes it
// via Supabase query builder. Supports SELECT, INSERT, UPDATE, DELETE.

async function executeSql(sql, params = []) {
  const db = getDB();
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT')) return executeSelect(sql, params, db);
  if (trimmed.startsWith('INSERT')) return executeInsert(sql, params, db);
  if (trimmed.startsWith('UPDATE')) return executeUpdate(sql, params, db);
  if (trimmed.startsWith('DELETE')) return executeDelete(sql, params, db);
  return [];
}

function extractTable(sql) {
  const m = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+(\w+)/i);
  return m ? m[1] : null;
}

function parseWhereClause(whereStr, params, startIdx) {
  // Returns { filters: [{col, val}], endIdx }
  const filters = [];
  let idx = startIdx;
  const parts = whereStr.split(/\s+AND\s+/i);
  for (const part of parts) {
    const eq = part.match(/(\w+)\s*=\s*\?/);
    if (eq && idx < params.length) {
      filters.push({ col: eq[1], val: params[idx++] });
    }
  }
  return { filters, nextIdx: idx };
}

async function executeSelect(sql, params, db) {
  const sqlL = sql.toLowerCase();

  // Handle JOIN queries
  if (sqlL.includes('join')) return executeSelectWithJoin(sql, params, db);

  const table = extractTable(sql);
  if (!table) return [];

  let query = db.from(table).select('*');
  let paramIdx = 0;

  // WHERE
  const whereM = sqlL.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|\s+group\s+by|$)/i);
  if (whereM) {
    const whereStr = whereM[1];
    // equality
    const eqParts = whereStr.split(/\s+and\s+/i);
    for (const part of eqParts) {
      const eq = part.match(/(\w+)\s*=\s*\?/);
      if (eq && paramIdx < params.length) {
        query = query.eq(eq[1], params[paramIdx++]);
      }
      const like = part.match(/(\w+)\s+like\s+\?/i);
      if (like && paramIdx < params.length) {
        query = query.ilike(like[1], params[paramIdx++]);
      }
    }
    // IN clause
    const inM = whereStr.match(/(\w+)\s+in\s*\((\?(?:\s*,\s*\?)*)\)/i);
    if (inM) {
      const col = inM[1];
      const count = (inM[2].match(/\?/g) || []).length;
      const vals = params.slice(paramIdx, paramIdx + count);
      paramIdx += count;
      query = query.in(col, vals);
    }
  }

  // ORDER BY
  const orderM = sqlL.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
  if (orderM) query = query.order(orderM[1], { ascending: !orderM[2] || orderM[2].toLowerCase() === 'asc' });

  // LIMIT
  const limitM = sqlL.match(/limit\s+(\d+)/i);
  if (limitM) query = query.limit(parseInt(limitM[1]));

  const { data, error } = await query;
  if (error) { console.error('Select error:', error.message); return []; }
  return Array.isArray(data) ? data : [];
}

async function executeSelectWithJoin(sql, params, db) {
  const sqlL = sql.toLowerCase();
  const table = extractTable(sql);
  if (!table) return [];

  const joinM = sqlL.match(/join\s+(\w+)/i);
  const joinTable = joinM ? joinM[1] : null;
  const selectStr = joinTable ? `*,${joinTable}(*)` : '*';

  let query = db.from(table).select(selectStr);
  let paramIdx = 0;

  const whereM = sqlL.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
  if (whereM) {
    const parts = whereM[1].split(/\s+and\s+/i);
    for (const part of parts) {
      const eq = part.match(/(?:\w+\.)?(\w+)\s*=\s*\?/);
      if (eq && paramIdx < params.length) query = query.eq(eq[1], params[paramIdx++]);
    }
  }

  const orderM = sqlL.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
  if (orderM) query = query.order(orderM[1], { ascending: !orderM[2] || orderM[2].toLowerCase() === 'asc' });

  const limitM = sqlL.match(/limit\s+(\d+)/i);
  if (limitM) query = query.limit(parseInt(limitM[1]));

  const { data, error } = await query;
  if (error) { console.error('Join select error:', error.message); return []; }

  if (!Array.isArray(data)) return [];
  return data.map(row => {
    const flat = { ...row };
    if (joinTable && row[joinTable]) {
      Object.assign(flat, {
        sender_name: row[joinTable].name,
        author: row[joinTable].name,
        [`${joinTable}_name`]: row[joinTable].name,
      });
    }
    return flat;
  });
}

async function executeInsert(sql, params, db) {
  const tableM = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (!tableM) return [];
  const table = tableM[1];
  const cols = tableM[2].split(',').map(c => c.trim());
  const record = {};
  cols.forEach((col, i) => { record[col] = params[i]; });

  const { data, error } = await db.from(table).insert([record]).select();
  if (error) { console.error('Insert error:', error.message); return []; }
  return Array.isArray(data) ? data : [];
}

async function executeUpdate(sql, params, db) {
  const tableM = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableM) return [];
  const table = tableM[1];

  const setM = sql.match(/SET\s+(.+?)\s+WHERE/i);
  if (!setM) return [];

  const setClauses = setM[1].split(',').map(s => s.trim());
  const updateData = {};
  let idx = 0;
  for (const clause of setClauses) {
    const m = clause.match(/(\w+)\s*=\s*\?/);
    if (m && idx < params.length) updateData[m[1]] = params[idx++];
  }

  const whereM = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
  if (!whereM) return [];

  const { data, error } = await db.from(table).update(updateData).eq(whereM[1], params[idx]).select();
  if (error) { console.error('Update error:', error.message); return []; }
  return Array.isArray(data) ? data : [];
}

async function executeDelete(sql, params, db) {
  const tableM = sql.match(/DELETE\s+FROM\s+(\w+)/i);
  if (!tableM) return [];
  const table = tableM[1];

  const whereM = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
  if (!whereM) return [];

  const { data, error } = await db.from(table).delete().eq(whereM[1], params[0]).select();
  if (error) { console.error('Delete error:', error.message); return []; }
  return Array.isArray(data) ? data : [];
}

// ─── Public API ─────────────────────────────────────────────────────────────

async function queryAll(sql, params = []) {
  return executeSql(sql, params);
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

async function runQuery(sql, params = []) {
  const result = await executeSql(sql, params);
  const lastId = result?.[0]?.id || null;
  const changes = Array.isArray(result) ? result.length : 0;
  return { lastInsertRowid: lastId, changes };
}

async function saveDB() {
  // Supabase auto-persists, no manual save needed
}

module.exports = { initDB, getDB, queryAll, queryOne, runQuery, saveDB };
