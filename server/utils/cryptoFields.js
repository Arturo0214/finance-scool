/**
 * Cifrado de campos sensibles del CRM — AES-256-GCM en reposo.
 * Formato almacenado: enc:v1:<iv b64>:<authTag b64>:<ciphertext b64>
 *
 * La llave viene de CRM_ENCRYPTION_KEY (64 chars hex = 32 bytes).
 * Fallback: derivada de JWT_SECRET para no romper producción si falta,
 * pero SIEMPRE debe configurarse una llave propia en Railway.
 */
const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function getKey() {
  const hex = process.env.CRM_ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  console.warn('⚠️  CRM_ENCRYPTION_KEY no configurada — usando llave derivada de JWT_SECRET (configúrala en producción)');
  return crypto.createHash('sha256').update(`${process.env.JWT_SECRET || 'financescool_secret'}::crm-fields`).digest();
}

let KEY;
function key() { if (!KEY) KEY = getKey(); return KEY; }

function encryptValue(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  const str = String(plain);
  if (str.startsWith(PREFIX)) return str; // ya cifrado
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

function decryptValue(stored) {
  if (stored === null || stored === undefined || stored === '') return stored;
  const str = String(stored);
  if (!str.startsWith(PREFIX)) return stored; // dato legado sin cifrar
  try {
    const [ivB64, tagB64, ctB64] = str.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (e) {
    console.error('decryptValue: no se pudo descifrar (¿cambió la llave?):', e.message);
    return null;
  }
}

/* Campos cifrados por tabla */
const ENCRYPTED_FIELDS = {
  crm_clients: ['telefono', 'email', 'rfc', 'direccion', 'notas', 'fecha_nacimiento'],
  crm_policies: ['poliza', 'notas'],
  crm_reminders: ['descripcion'],
};

function encryptFields(obj, table) {
  if (!obj) return obj;
  const fields = ENCRYPTED_FIELDS[table] || [];
  const out = { ...obj };
  for (const f of fields) if (f in out) out[f] = encryptValue(out[f]);
  return out;
}

function decryptFields(obj, table) {
  if (!obj) return obj;
  const fields = ENCRYPTED_FIELDS[table] || [];
  const out = { ...obj };
  for (const f of fields) if (f in out) out[f] = decryptValue(out[f]);
  // Relaciones anidadas de Supabase (p.ej. crm_clients(nombre, telefono))
  for (const rel of Object.keys(ENCRYPTED_FIELDS)) {
    if (out[rel] && typeof out[rel] === 'object' && rel !== table) out[rel] = decryptFields(out[rel], rel);
  }
  return out;
}

const decryptRows = (rows, table) => (rows || []).map(r => decryptFields(r, table));

module.exports = { encryptValue, decryptValue, encryptFields, decryptFields, decryptRows, ENCRYPTED_FIELDS };
