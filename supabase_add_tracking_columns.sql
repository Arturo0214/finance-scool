-- =====================================================
-- Finance S Cool — Agregar columnas de tracking/atribución
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 22 abril 2026
-- =====================================================

-- Columnas de atribución de leads (de dónde viene cada lead)
ALTER TABLE fsc_conversations
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'whatsapp_directo',
ADD COLUMN IF NOT EXISTS ad_id TEXT,
ADD COLUMN IF NOT EXISTS ad_campaign TEXT,
ADD COLUMN IF NOT EXISTS ad_headline TEXT;

-- Índice para queries rápidos por fuente (dashboard/funnel)
CREATE INDEX IF NOT EXISTS idx_fsc_lead_source ON fsc_conversations(lead_source);

-- Índice para filtrar por campaña
CREATE INDEX IF NOT EXISTS idx_fsc_ad_campaign ON fsc_conversations(ad_campaign);

-- Verificar que se crearon correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'fsc_conversations'
AND column_name IN ('lead_source', 'ad_id', 'ad_campaign', 'ad_headline');
