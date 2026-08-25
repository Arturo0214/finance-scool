/**
 * Integración con Fireflies.ai — "Inteligencia de citas".
 * Trae de las reuniones grabadas: resumen, temas clave y action items, para
 * volcarlos al CRM como nota + tareas (pendientes) del cliente.
 *
 * TODO SE ACTIVA con la variable de entorno FIREFLIES_API_KEY. Sin ella, la
 * integración queda "apagada" y los endpoints responden { enabled:false } en
 * lugar de fallar — así el resto del CRM funciona igual mientras Ingrid
 * confirma las licencias. La API es GraphQL: POST https://api.fireflies.ai/graphql
 * con `Authorization: Bearer <API_KEY>`. Docs: https://docs.fireflies.ai/
 */
const FIREFLIES_URL = 'https://api.fireflies.ai/graphql';

const firefliesKey = () => (process.env.FIREFLIES_API_KEY || '').trim();
const firefliesEnabled = () => firefliesKey().length > 0;

/* Ejecuta una query GraphQL contra Fireflies. Lanza Error con mensaje claro. */
async function ffQuery(query, variables = {}) {
  if (!firefliesEnabled()) {
    const e = new Error('Fireflies no está configurado (falta FIREFLIES_API_KEY)');
    e.code = 'FIREFLIES_DISABLED';
    throw e;
  }
  let resp;
  try {
    resp = await fetch(FIREFLIES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${firefliesKey()}` },
      body: JSON.stringify({ query, variables }),
    });
  } catch (netErr) {
    throw new Error(`No se pudo contactar a Fireflies: ${netErr.message}`);
  }
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.errors) {
    const msg = (json.errors && json.errors.map(e => e.message).join('; ')) || `HTTP ${resp.status}`;
    throw new Error(`Fireflies: ${msg}`);
  }
  return json.data;
}

/* action_items en Fireflies viene como texto (a veces con viñetas/markdown o
   agrupado por persona). Lo normalizamos a un arreglo de strings accionables. */
function parseActionItems(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  return String(raw)
    .split(/\r?\n|•|(?:^|\s)[-*]\s+/g)
    .map(s => s.replace(/^\s*[-*•\d.)\]]+\s*/, '').trim())
    .filter(s => s.length > 2);
}

const toIso = (d) => {
  if (d == null) return null;
  const n = Number(d);
  const date = new Date(n > 1e12 ? n : n * 1000); // epoch ms o s
  return isNaN(date.getTime()) ? null : date.toISOString();
};

/* Lista de reuniones recientes (id, título, fecha, duración, participantes). */
async function listTranscripts({ limit = 25, mine = null } = {}) {
  const data = await ffQuery(`
    query Recientes($limit: Int) {
      transcripts(limit: $limit) {
        id title date duration organizer_email participants
      }
    }`, { limit });
  const list = (data && data.transcripts) || [];
  return list.map(t => ({
    id: t.id, titulo: t.title || 'Reunión sin título', fecha: toIso(t.date),
    duracion_min: t.duration ? Math.round(t.duration) : null,
    organizador: t.organizer_email || null, participantes: t.participants || [],
  }));
}

/* Detalle de una reunión con resumen + action items normalizados. */
async function getTranscript(id) {
  const data = await ffQuery(`
    query Detalle($id: String!) {
      transcript(id: $id) {
        id title date duration organizer_email participants
        summary { overview short_summary keywords action_items bullet_gist outline }
      }
    }`, { id });
  const t = data && data.transcript;
  if (!t) throw new Error('Reunión no encontrada en Fireflies');
  const s = t.summary || {};
  return {
    id: t.id, titulo: t.title || 'Reunión sin título', fecha: toIso(t.date),
    duracion_min: t.duration ? Math.round(t.duration) : null,
    organizador: t.organizer_email || null, participantes: t.participants || [],
    resumen: s.overview || s.short_summary || s.bullet_gist || '',
    temas: Array.isArray(s.keywords) ? s.keywords : (s.keywords ? [s.keywords] : []),
    outline: s.outline || null,
    action_items: parseActionItems(s.action_items),
  };
}

module.exports = { firefliesEnabled, ffQuery, listTranscripts, getTranscript, parseActionItems };
