/**
 * Reporte PDF de Rehabilitaciones por asesor.
 * Logo FinanceSCool dibujado nativo en pdfkit (wordmark FINANCE S C ∞ L con el
 * infinito multicolor y la línea naranja), diseño limpio y orden por urgencia.
 * Devuelve un Buffer para adjuntarlo por correo o previsualizarlo en la UI.
 */
const PDFDocument = require('pdfkit');

const NAVY = '#0B1B33';
const NAVY2 = '#122a4d';
const TURQ = '#00ACC1';
const GRIS = '#64748B';
const GRIS2 = '#94A3B8';
const LINEA = '#E2E8F0';
const ROJO = '#DC2626';
const AMBAR = '#B45309';
const CYAN = '#0E7490';
const VERDE = '#059669';
const NARANJA = '#F26522';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const ETAPA_TXT = { AUTOMATICA: 'Automática', CORREO: 'Con correo', FIRMA: 'Con firma', VENCIDA: 'Vencida' };
const URG_TXT = { EXTREMA: 'Extrema', ALTA: 'Urgente', MEDIA: 'Media', BAJA: 'Baja' };
const URG_COLOR = { EXTREMA: ROJO, ALTA: AMBAR, MEDIA: CYAN, BAJA: GRIS };
const URG_RANK = { EXTREMA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

/* ── Logo FinanceSCool nativo (mismo diseño que el componente <Logo/> del front) ──
   Espacio de coordenadas del logo: 200 × 78. Se dibuja escalado a la altura h. */
function drawLogo(doc, x, y, h, variant = 'light') {
  const textColor = variant === 'light' ? '#FFFFFF' : '#1A3A5C';
  const financeColor = variant === 'light' ? '#CFE0F2' : '#2E6EA6';
  const s = h / 78;
  doc.save();
  doc.translate(x, y).scale(s);

  const centered = (str, cx, baseY, size, color, tracking = 0) => {
    doc.font('Helvetica-Bold').fontSize(size).fillColor(color);
    const w = doc.widthOfString(str, { characterSpacing: tracking });
    doc.text(str, cx - w / 2, baseY, { characterSpacing: tracking, baseline: 'alphabetic', lineBreak: false });
  };
  centered('FINANCE', 100, 15, 13, financeColor, 6);
  centered('S', 16, 56, 38, textColor);
  centered('C', 50, 56, 38, textColor);
  centered('L', 181, 56, 38, textColor);

  // Infinito: 8 segmentos bezier con gradiente; back primero, front encima del cruce.
  const segs = [
    [117, 43, 112, 34, 104, 27, 92, 27, '#43A047', '#FDD835'],
    [92, 27, 82, 27, 76, 34, 76, 43, '#FDD835', '#FF8F00'],
    [76, 43, 76, 52, 82, 59, 92, 59, '#FF8F00', '#E91E63'],
    [92, 59, 104, 59, 112, 52, 117, 43, '#E91E63', '#00ACC1'],
    [117, 43, 122, 34, 130, 27, 142, 27, '#00ACC1', '#FF6D00'],
    [142, 27, 152, 27, 158, 34, 158, 43, '#FF6D00', '#E53935'],
    [158, 43, 158, 52, 152, 59, 142, 59, '#E53935', '#3949AB'],
    [142, 59, 130, 59, 122, 52, 117, 43, '#3949AB', '#43A047'],
  ];
  const drawSeg = (i) => {
    const [x1, y1, c1x, c1y, c2x, c2y, x2, y2, ca, cb] = segs[i];
    const g = doc.linearGradient(x1, y1, x2, y2); g.stop(0, ca); g.stop(1, cb);
    doc.moveTo(x1, y1).bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2)
      .lineWidth(9).lineCap('round').lineJoin('round').stroke(g);
  };
  [0, 1, 6, 7].forEach(drawSeg);  // back
  [2, 3, 4, 5].forEach(drawSeg);  // front
  doc.moveTo(4, 72).lineTo(194, 72).lineWidth(2).lineCap('round').stroke(NARANJA);

  doc.restore();
  doc.fillColor('#000');
}

function buildRehabPDFBuffer({ agentName, clave, indiceHoy, indiceConPendiente, lista }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 44, bottom: 48, left: 46, right: 46 } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width, W = PW - 92, LX = 46;

    /* Orden por urgencia → vencimiento de etapa → monto (lo más urgente arriba) */
    const items = [...(lista || [])].sort((a, b) =>
      (URG_RANK[a.urgencia] ?? 9) - (URG_RANK[b.urgencia] ?? 9)
      || (a.dias_para_vencer_etapa ?? 9999) - (b.dias_para_vencer_etapa ?? 9999)
      || (b.monto || 0) - (a.monto || 0));

    const monto = items.reduce((s, r) => s + (r.monto || 0), 0);
    /* Cada fila es una COBERTURA; varias comparten número de póliza. Contamos
       las pólizas distintas para no confundir coberturas con pólizas (feedback
       de mesa de control: "21 pólizas" cuando son 21 coberturas en 9 pólizas). */
    const nPolizas = new Set(items.map(r => String(r.poliza || ''))).size;
    const nCob = items.length;
    const cobTxt = (n) => `${n} cobertura${n === 1 ? '' : 's'}`;
    const polTxt = (n) => `${n} póliza${n === 1 ? '' : 's'}`;
    const por = {
      auto: items.filter(r => r.etapa === 'AUTOMATICA').length,
      correo: items.filter(r => r.etapa === 'CORREO').length,
      firma: items.filter(r => r.etapa === 'FIRMA').length,
    };
    const extremas = items.filter(r => r.urgencia === 'EXTREMA').length;
    const altas = items.filter(r => r.urgencia === 'ALTA').length;
    const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

    /* ── Encabezado ── */
    const HH = 104;
    doc.rect(0, 0, PW, HH).fill(NAVY);
    doc.rect(0, HH, PW, 3).fill(NARANJA);
    drawLogo(doc, LX, 22, 46, 'light');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('Reporte de Rehabilitaciones', LX + 150, 30, { width: W - 150, align: 'right' });
    doc.fillColor('#C7D2E4').font('Helvetica').fontSize(9.5)
      .text(`Incubadora S-COOL · ${agentName || 'Promotoría'}${clave ? '  ·  ' + clave : ''}`, LX + 150, 56, { width: W - 150, align: 'right' })
      .text(indiceConPendiente != null
        ? `Índice de conservación: ${(indiceConPendiente * 100).toFixed(2)}%  ·  cobrado ${indiceHoy != null ? (indiceHoy * 100).toFixed(2) + '%' : '—'}   ·   Generado ${hoy}`
        : `Índice de conservación: ${indiceHoy != null ? (indiceHoy * 100).toFixed(2) + '%' : '—'}   ·   Generado ${hoy}`, LX + 150, 71, { width: W - 150, align: 'right' });
    let y = HH + 24;

    /* ── Tarjetas de resumen ── */
    const cards = [
      ['COBERTURAS RECUPERABLES', String(nCob), `${money(monto)} en riesgo · en ${polTxt(nPolizas)}`, NAVY],
      ['AUTOMÁTICAS · 0–30d', String(por.auto), 'sin trámite del cliente', VERDE],
      ['CORREO / FIRMA', `${por.correo} / ${por.firma}`, '30–90d / 90–180d', CYAN],
      ['URGENTES', String(extremas + altas), `${extremas} extremas · ${altas} altas`, ROJO],
    ];
    const colW = W / 4, boxH = 60;
    cards.forEach((k, i) => {
      const x = LX + i * colW;
      doc.roundedRect(x + 2, y, colW - 8, boxH, 8).fill('#F7F9FC');
      doc.rect(x + 2, y, 3.5, boxH).fill(k[3]);
      doc.fill(GRIS).font('Helvetica-Bold').fontSize(6.8).text(k[0], x + 12, y + 11, { width: colW - 22 });
      doc.fill(NAVY).font('Helvetica-Bold').fontSize(20).text(k[1], x + 12, y + 22, { width: colW - 22 });
      doc.fill(GRIS).font('Helvetica').fontSize(7).text(k[2], x + 12, y + 46, { width: colW - 22 });
    });
    y += boxH + 18;

    /* ── Nota de plazos ── */
    doc.roundedRect(LX, y, W, 30, 7).fill('#FFF7ED');
    doc.fill(AMBAR).font('Helvetica-Bold').fontSize(8).text('El plazo corre desde la cancelación:', LX + 12, y + 7);
    doc.fill('#7C4A16').font('Helvetica').fontSize(8)
      .text('0–30 días  automática  ·  30–90 días  con correo de petición  ·  90–180 días  con firma autógrafa del cliente  ·  +180 días  se pierde.', LX + 12, y + 18, { width: W - 24 });
    y += 30 + 20;

    /* ── Tabla de pólizas ── */
    const cols = ['#', 'Póliza', 'Plan', 'Etapa', 'Cancel.', 'Vence', 'Urgencia', 'Monto'];
    const cw = [W * 0.045, W * 0.17, W * 0.12, W * 0.14, W * 0.10, W * 0.09, W * 0.145, W * 0.15];
    const rowH = 20;
    const header = () => {
      doc.roundedRect(LX, y, W, 20, 4).fill(NAVY);
      let x = LX;
      cols.forEach((c, i) => { doc.fill('#fff').font('Helvetica-Bold').fontSize(8).text(c, x + 6, y + 6, { width: cw[i] - 10, align: i >= 4 ? 'right' : 'left' }); x += cw[i]; });
      y += 20;
    };
    doc.fill(NAVY).font('Helvetica-Bold').fontSize(11).text(`Detalle — ${cobTxt(nCob)} en ${polTxt(nPolizas)} por recuperar`, LX, y);
    y += 18;
    header();

    items.forEach((r, idx) => {
      if (y > doc.page.height - 76) { doc.addPage(); y = 46; header(); }
      const uc = URG_COLOR[r.urgencia] || GRIS;
      if (idx % 2 === 0) doc.rect(LX, y, W, rowH).fill('#F8FAFC');
      doc.rect(LX, y, 3, rowH).fill(uc); // franja de urgencia
      let x = LX;
      const vals = [
        String(idx + 1), String(r.poliza || ''), String(r.plan_id || ''),
        ETAPA_TXT[r.etapa] || r.etapa,
        `${r.dias_desde_cancelacion}d`,
        r.rehabilitable === false ? '—' : `${r.dias_para_vencer_etapa}d`,
        URG_TXT[r.urgencia] || r.urgencia,
        money(r.monto),
      ];
      vals.forEach((v, j) => {
        const color = j === 6 ? uc : (j === 5 && r.dias_para_vencer_etapa <= 7 ? ROJO : '#1E293B');
        doc.fill(color).font(j === 1 || j === 7 ? 'Helvetica-Bold' : j === 6 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.2)
          .text(v, x + 6, y + 6, { width: cw[j] - 10, align: j >= 4 ? 'right' : 'left' });
        x += cw[j];
      });
      y += rowH;
    });

    /* Total */
    doc.moveTo(LX, y).lineTo(LX + W, y).lineWidth(1).stroke(LINEA);
    y += 6;
    doc.fill(NAVY).font('Helvetica-Bold').fontSize(9).text('Total en riesgo', LX + W * 0.5, y, { width: W * 0.35, align: 'right' });
    doc.fill(NAVY).font('Helvetica-Bold').fontSize(9).text(money(monto), LX + W * 0.85, y, { width: W * 0.15, align: 'right' });

    if (!items.length) {
      doc.fill(GRIS).font('Helvetica').fontSize(11).text('No hay pólizas rehabilitables para este asesor. Cartera sana.', LX, y + 10);
    }

    /* ── Pie (dentro del margen inferior para no forzar una página nueva) ── */
    const pieY = doc.page.height - 58;
    doc.moveTo(LX, pieY - 8).lineTo(LX + W, pieY - 8).lineWidth(0.5).stroke(LINEA);
    doc.fill(GRIS2).font('Helvetica').fontSize(7.2)
      .text('Documento confidencial — Finance S-Cool / Incubadora S-COOL. La rehabilitación se ejecuta en Prudential/Zeus. Generado automáticamente por el CRM.',
        LX, pieY, { width: W, align: 'center', lineBreak: false });

    doc.end();
  });
}

module.exports = { buildRehabPDFBuffer, drawLogo };
