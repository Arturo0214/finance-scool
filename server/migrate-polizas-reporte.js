/**
 * CLI del importador del "Reporte de pólizas" Prudential.
 * La lógica vive en server/utils/importPolizasReporte.js (misma que usa la
 * carga diaria desde la UI). Idempotente: matchea por número de póliza.
 *
 * Uso: node server/migrate-polizas-reporte.js ["/ruta/al/Reporte.xlsx"]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const XLSX = require('xlsx');
const { getDB } = require('./models/database');
const { importarReporte } = require('./utils/importPolizasReporte');

const FILE = process.argv[2] || '/Users/arturosuarez/Downloads/Reporte de pólizas (2).xlsx';

(async () => {
  const resumen = await importarReporte(getDB(), {
    workbook: XLSX.readFile(FILE),
    archivo: FILE.split('/').pop(),
    usuario: 'CLI local',
  });
  console.log('Importación completa:', JSON.stringify(resumen, null, 1));
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
