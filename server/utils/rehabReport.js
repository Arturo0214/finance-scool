/**
 * Reporte PDF de Rehabilitaciones por asesor (pdfkit + logo FinanceSCool).
 * Devuelve un Buffer para adjuntarlo por correo o descargarlo desde la UI.
 */
const PDFDocument = require('pdfkit');
const path = require('path');

const LOGO = path.join(__dirname, '..', 'assets', 'logo-white.png');
const NAVY = '#071B49';
const TURQ = '#00A99D';
const GRIS = '#64748B';
const ROJO = '#DC2626';
const AMBAR = '#B45309';
const VERDE = '#059669';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const ETAPA_TXT = { AUTOMATICA: 'Automática', CORREO: 'Con correo', FIRMA: 'Con firma', VENCIDA: 'Vencida' };
const URG_COLOR = { EXTREMA: ROJO, ALTA: AMBAR, MEDIA: '#0E7490', BAJA: GRIS };

function buildRehabPDFBuffer({ agentName, clave, indiceHoy, lista }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 46, bottom: 46, left: 46, right: 46 } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 92;
    const items = [...(lista || [])].sort((a, b) => (a.monto || 0) < (b.monto || 0) ? 1 : -1);
    const monto = items.reduce((s, r) => s + (r.monto || 0), 0);
    const por = {
      auto: items.filter(r => r.etapa === 'AUTOMATICA').length,
      correo: items.filter(r => r.etapa === 'CORREO').length,
      firma: items.filter(r => r.etapa === 'FIRMA').length,
    };
    const extremas = items.filter(r => r.urgencia === 'EXTREMA').length;
    const altas = items.filter(r => r.urgencia === 'ALTA').length;

    /* ── Encabezado con logo ── */
    doc.rect(0, 0, doc.page.width, 92).fill(NAVY);
    try { doc.image(LOGO, 46, 20, { width: 52, height: 52 }); } catch { /* sin logo */ }
    doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(17).text('Reporte de Rehabilitaciones', 116, 24);
    doc.font('Helvetica').fontSize(10).fill('#C7D2E4')
      .text(`Incubadora S-COOL  ·  ${agentName || ''}${clave ? '  ·  ' + clave : ''}`, 116, 47)
      .text(`Índice de conservación hoy: ${indiceHoy != null ? (indiceHoy * 100).toFixed(2) + '%' : '—'}   |   Generado: ${new Date().toLocaleDateString('es-MX')}`, 116, 62);
    let y = 112;

    /* ── Resumen ejecutivo (tarjetas) ── */
    const cards = [
      ['PÓLIZAS REHABILITABLES', String(items.length), money(monto) + ' en riesgo'],
      ['AUTOMÁTICAS (0-30d)', String(por.auto), 'sin trámite del cliente'],
      ['CON CORREO / FIRMA', `${por.correo} / ${por.firma}`, '30-90d / 90-180d'],
      ['URGENTES', String(extremas + altas), `${extremas} extremas · ${altas} altas`],
    ];
    const colW = W / 4, boxH = 56;
    cards.forEach((k, i) => {
      const x = 46 + i * colW;
      doc.roundedRect(x + 2, y, colW - 8, boxH, 6).fillAndStroke('#F0F4F8', '#E2E8F0');
      doc.fill(GRIS).font('Helvetica-Bold').fontSize(7).text(k[0], x + 10, y + 9, { width: colW - 20 });
      doc.fill(NAVY).font('Helvetica-Bold').fontSize(17).text(k[1], x + 10, y + 20, { width: colW - 20 });
      doc.fill(GRIS).font('Helvetica').fontSize(7).text(k[2], x + 10, y + 42, { width: colW - 20 });
    });
    y += boxH + 18;

    doc.fill(NAVY).font('Helvetica-Bold').fontSize(8).text(
      'El plazo corre desde la cancelación:  0-30d automática  ·  30-90d con correo de petición  ·  90-180d con firma autógrafa del cliente  ·  +180d se pierde.',
      46, y, { width: W });
    y += 22;

    /* ── Tabla de pólizas ── */
    const cols = ['#', 'Póliza', 'Plan', 'Etapa', 'Días canc.', 'Vence', 'Urgencia', 'Monto'];
    const cw = [W * 0.05, W * 0.16, W * 0.13, W * 0.15, W * 0.12, W * 0.1, W * 0.14, W * 0.15];
    const header = () => {
      doc.rect(46, y, W, 18).fill(NAVY);
      let x = 46;
      cols.forEach((c, i) => { doc.fill('#fff').font('Helvetica-Bold').fontSize(8).text(c, x + 5, y + 5, { width: cw[i] - 8, align: i >= 4 ? 'right' : 'left' }); x += cw[i]; });
      y += 18;
    };
    header();
    items.forEach((r, idx) => {
      if (y > doc.page.height - 70) { doc.addPage(); y = 46; header(); }
      if (idx % 2 === 0) doc.rect(46, y, W, 15).fill('#F8FAFC');
      let x = 46;
      const vals = [
        String(idx + 1), String(r.poliza || ''), String(r.plan_id || ''),
        ETAPA_TXT[r.etapa] || r.etapa,
        `${r.dias_desde_cancelacion}d`,
        r.rehabilitable === false ? '—' : `${r.dias_para_vencer_etapa}d`,
        (r.urgencia || '').charAt(0) + (r.urgencia || '').slice(1).toLowerCase(),
        money(r.monto),
      ];
      vals.forEach((v, j) => {
        const color = j === 6 ? (URG_COLOR[r.urgencia] || '#1E293B') : '#1E293B';
        doc.fill(color).font(j === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
          .text(v, x + 5, y + 3.5, { width: cw[j] - 8, align: j >= 4 ? 'right' : 'left' });
        x += cw[j];
      });
      y += 15;
    });

    if (!items.length) {
      doc.fill(GRIS).font('Helvetica').fontSize(10).text('No hay pólizas rehabilitables. 🎉', 46, y + 10);
    }

    /* ── Pie (arriba del margen inferior para no forzar página nueva) ── */
    const pieY = Math.min(y + 16, doc.page.height - 62);
    doc.fill('#94A3B8').font('Helvetica').fontSize(7.5)
      .text('Documento confidencial — Finance S-Cool / Incubadora S-COOL. La rehabilitación se ejecuta en Prudential/Zeus. Generado automáticamente por el CRM.',
        46, pieY, { width: W, align: 'center' });

    doc.end();
  });
}

module.exports = { buildRehabPDFBuffer };
