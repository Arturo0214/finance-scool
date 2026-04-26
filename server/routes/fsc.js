const express = require('express');
const { getDB } = require('../models/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN || '';
const HUBSPOT_PIPELINE_ID = 'default';
const STAGE_LABELS = {
  '1099262896': 'Calificado para asesoria',
  '1099262897': 'Cita agendada',
  '1099262898': 'Analisis de necesidades',
  '1099262899': 'Propuesta / cotizacion',
  '1099262900': 'Seguimiento / objeciones',
  '1099262901': 'Solicitud completada',
  '1099262902': 'Cerrada ganada',
  '1099262903': 'Cerrada perdida',
};

// All routes require authentication
router.use(verifyToken);

// ─── GET /stats ───
// NOTE: defined before /:phone to avoid matching "stats" as a phone param
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();

    const statuses = [
      'nuevo',
      'en_calificacion',
      'calificado',
      'cita_agendada',
      'no_calificado',
      'cerrado_no_calificado',
    ];

    const [totalResult, ...statusResults] = await Promise.all([
      db.from('fsc_conversations').select('id', { count: 'exact', head: true }),
      ...statuses.map(s =>
        db.from('fsc_conversations').select('id', { count: 'exact', head: true }).eq('lead_status', s)
      ),
    ]);

    const byStatus = {};
    statuses.forEach((s, i) => {
      byStatus[s] = statusResults[i].count || 0;
    });

    res.json({ total: totalResult.count || 0, byStatus });
  } catch (err) {
    console.error('FSC stats error:', err);
    res.status(500).json({ error: 'Error al obtener estadisticas' });
  }
});

// ─── GET /hubspot-pipeline ───
router.get('/hubspot-pipeline', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: 'pipeline', operator: 'EQ', value: HUBSPOT_PIPELINE_ID },
              ],
            },
          ],
          properties: ['dealname', 'dealstage', 'pipeline', 'createdate', 'description'],
          limit: 100,
          sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('HubSpot API error:', response.status, errBody);
      return res.status(502).json({ error: 'Error al consultar HubSpot' });
    }

    const data = await response.json();

    const deals = (data.results || []).map(deal => ({
      id: deal.id,
      dealname: deal.properties.dealname,
      dealstage: deal.properties.dealstage,
      stageLabel: STAGE_LABELS[deal.properties.dealstage] || deal.properties.dealstage,
      pipeline: deal.properties.pipeline,
      createdate: deal.properties.createdate,
      description: deal.properties.description,
    }));

    res.json({ deals, total: data.total || deals.length });
  } catch (err) {
    console.error('HubSpot pipeline error:', err);
    res.status(500).json({ error: 'Error al obtener pipeline de HubSpot' });
  }
});

// ─── GET / ───
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { status, search } = req.query;

    let query = db
      .from('fsc_conversations')
      .select(
        'id, whatsapp_number, nombre_lead, lead_status, filtro_actual, prioridad, regimen_fiscal, rango_ingreso, objetivo, fecha_cita, hora_cita, created_at, updated_at'
      );

    if (status) query = query.eq('lead_status', status);
    if (search) query = query.or(`nombre_lead.ilike.%${search}%,whatsapp_number.ilike.%${search}%`);

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const conversations = (data || []).map(row => {
      return { ...row, lastMessagePreview: '' };
    });

    res.json({ conversations });
  } catch (err) {
    console.error('FSC list error:', err);
    res.status(500).json({ error: 'Error al obtener conversaciones FSC' });
  }
});

// ─── GET /:phone ───
router.get('/:phone', async (req, res) => {
  try {
    const db = getDB();
    const { data, error } = await db
      .from('fsc_conversations')
      .select('*')
      .eq('whatsapp_number', req.params.phone)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Conversacion no encontrada' });

    res.json(data);
  } catch (err) {
    console.error('FSC detail error:', err);
    res.status(500).json({ error: 'Error al obtener conversacion' });
  }
});

module.exports = router;
