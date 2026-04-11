/**
 * Migration: Add last_message_preview column to whatsapp_leads
 * Run once: node server/migrate-add-preview.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function migrate() {
  console.log('=== Migration: last_message_preview ===\n');

  // 1. Try adding column via Supabase SQL Editor (Management API)
  // Since PostgREST doesn't support DDL, we add column via Dashboard or psql.
  // This script handles the BACKFILL part.
  //
  // FIRST: Run this SQL in Supabase Dashboard > SQL Editor:
  //   ALTER TABLE whatsapp_leads ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
  //
  // Then run this script to backfill existing previews.

  // 2. Verify column exists
  const { data: test, error: testErr } = await supabase
    .from('whatsapp_leads')
    .select('last_message_preview')
    .limit(1);

  if (testErr && testErr.message.includes('last_message_preview')) {
    console.error('❌ Column last_message_preview does not exist yet.');
    console.error('   Run this SQL in Supabase Dashboard > SQL Editor:');
    console.error('   ALTER TABLE whatsapp_leads ADD COLUMN IF NOT EXISTS last_message_preview TEXT;\n');
    process.exit(1);
  }

  console.log('✅ Column last_message_preview exists\n');

  // 3. Backfill from historial_chat
  console.log('Fetching leads with historial_chat but no preview...');
  const { data: leads, error: fetchErr } = await supabase
    .from('whatsapp_leads')
    .select('id, historial_chat')
    .is('last_message_preview', null)
    .not('historial_chat', 'is', null)
    .limit(1000);

  if (fetchErr) {
    console.error('Error fetching leads:', fetchErr.message);
    process.exit(1);
  }

  console.log(`Found ${(leads || []).length} leads to backfill\n`);

  let updated = 0;
  let skipped = 0;
  for (const lead of (leads || [])) {
    try {
      let chat = lead.historial_chat;
      if (typeof chat === 'string') chat = JSON.parse(chat);
      if (!Array.isArray(chat) || chat.length === 0) { skipped++; continue; }

      const lastMsg = chat[chat.length - 1];
      let preview = '';
      const text = (lastMsg.content || lastMsg.text || lastMsg.body || '').slice(0, 100);

      if (lastMsg.role === 'assistant' || lastMsg.from === 'bot' || lastMsg.from === 'system') {
        preview = 'Bot: ' + text;
      } else if (lastMsg.role === 'agent' || lastMsg.from === 'agent') {
        preview = 'Tú: ' + text;
      } else {
        preview = text;
      }

      if (preview) {
        const { error: upErr } = await supabase
          .from('whatsapp_leads')
          .update({ last_message_preview: preview })
          .eq('id', lead.id);
        if (!upErr) {
          updated++;
        } else {
          console.error(`  Error updating lead ${lead.id}:`, upErr.message);
        }
      } else {
        skipped++;
      }
    } catch (e) {
      skipped++;
    }
  }

  console.log(`\n✅ Backfill complete: ${updated} updated, ${skipped} skipped`);
}

migrate().catch(err => { console.error(err); process.exit(1); });
