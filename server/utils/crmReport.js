/**
 * Generador del reporte PDF mensual del Business Review por asesor (pdfkit).
 * Recibe el summary que produce buildAgentSummary en routes/crm.js.
 */
const PDFDocument = require('pdfkit');

const AZUL = '#003DA5';
const GRIS = '#64748B';
const VERDE = '#059669';
const AMBAR = '#D97706';
const ROJO = '#DC2626';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const pct = (n, d = 0) => (n == null ? '—' : `${(n * 100).toFixed(d)}%`);

function buildAgentReportPDF(summary, { anio, mes, renovaciones = [], comisiones = null }) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 46, bottom: 46, left: 46, right: 46 } });
  const { agent, kpis, bonos } = summary;
  const t = kpis.totales;
  const cons = kpis.conservacion;
  const W = doc.page.width - 92;

  /* ── Encabezado ── */
  doc.rect(0, 0, doc.page.width, 86).fill(AZUL);
  doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(17).text('Business Review — Incubadora S-COOL', 46, 24);
  doc.font('Helvetica').fontSize(10.5)
    .text(`${agent.nombre}  ·  ${agent.clave || 's/clave'}  ·  Cuaderno ${agent.cuaderno}`, 46, 48)
    .text(`Periodo: ${mes ? MESES[mes - 1] + ' ' : ''}${anio}   |   Generado: ${new Date().toLocaleDateString('es-MX')}`, 46, 63);
  doc.fill('#1E293B');
  let y = 108;

  /* ── KPIs principales ── */
  const kpiData = [
    ['Prima pagada total', money(t.primaTotal), `Nueva ${money(t.primaNueva)} · Renov. ${money(t.primaRenovacion)}`],
    ['Cumplimiento de meta', pct(t.cumplimiento), `Meta anual ${money(t.meta)}`],
    ['Índice de conservación', pct(cons.indiceProyectado, 1), `Base a conservar ${money(cons.baseConservar)}`],
    ['Pipeline', money(t.pipeline), 'En trámite + pendiente de pago'],
    [`Bono trimestral est. (${bonos.trimestre})`, money(bonos.bonoTrimestral.monto),
      bonos.bonoTrimestral.rango ? `Rango ${bonos.bonoTrimestral.rango} · ${pct(bonos.bonoTrimestral.pct, 1)}` : 'Sin rango alcanzado'],
    ['Clientes en cartera', String(summary.clientes.total), `${summary.clientes.funnel.cliente || 0} activos`],
  ];
  const colW = W / 3, boxH = 58;
  kpiData.forEach((k, i) => {
    const x = 46 + (i % 3) * colW, yy = y + Math.floor(i / 3) * (boxH + 10);
    doc.roundedRect(x + 2, yy, colW - 8, boxH, 6).fillAndStroke('#F0F4F8', '#E2E8F0');
    doc.fill(GRIS).font('Helvetica-Bold').fontSize(7.5).text(k[0].toUpperCase(), x + 12, yy + 9, { width: colW - 24 });
    doc.fill(AZUL).font('Helvetica-Bold').fontSize(16).text(k[1], x + 12, yy + 21, { width: colW - 24 });
    doc.fill(GRIS).font('Helvetica').fontSize(7.5).text(k[2], x + 12, yy + 41, { width: colW - 24 });
  });
  y += 2 * (boxH + 10) + 16;

  /* ── Tabla mensual ── */
  doc.fill('#1E293B').font('Helvetica-Bold').fontSize(12).text(`Producción mensual ${anio}`, 46, y);
  y += 20;
  const cols = ['Mes', 'Prima nueva', 'Renovación', 'Meta', 'Cumplim.'];
  const cw = [W * 0.2, W * 0.22, W * 0.22, W * 0.2, W * 0.16];
  doc.rect(46, y, W, 18).fill(AZUL);
  let x = 46;
  cols.forEach((c, i) => { doc.fill('#fff').font('Helvetica-Bold').fontSize(8.5).text(c, x + 6, y + 5, { width: cw[i] - 10 }); x += cw[i]; });
  y += 18;
  kpis.months.forEach((m, i) => {
    const cumpl = m.meta > 0 ? (m.primaNueva + m.primaRenovacion) / m.meta : null;
    if (i % 2 === 0) { doc.rect(46, y, W, 15).fill('#F8FAFC'); }
    x = 46;
    const vals = [MESES[i], money(m.primaNueva), money(m.primaRenovacion), money(m.meta),
      cumpl == null ? '—' : pct(cumpl)];
    vals.forEach((v, j) => {
      const color = j === 4 && cumpl != null ? (cumpl >= 1 ? VERDE : cumpl >= 0.7 ? AMBAR : ROJO) : '#1E293B';
      doc.fill(color).font(j === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).text(v, x + 6, y + 3.5, { width: cw[j] - 10 });
      x += cw[j];
    });
    y += 15;
  });
  y += 14;

  /* ── Renovaciones próximas ── */
  if (renovaciones.length) {
    if (y > 640) { doc.addPage(); y = 46; }
    doc.fill('#1E293B').font('Helvetica-Bold').fontSize(12).text('Renovaciones próximas (90 días)', 46, y);
    y += 18;
    renovaciones.slice(0, 10).forEach(r => {
      doc.fill(GRIS).font('Helvetica').fontSize(9)
        .text(`• ${r.cliente} — ${r.plan || 'póliza'} · vence ${r.fecha_renovacion} · prima ${money(r.prima)}`, 52, y);
      y += 14;
    });
    y += 10;
  }

  /* ── Comisiones ── */
  if (comisiones) {
    if (y > 660) { doc.addPage(); y = 46; }
    doc.fill('#1E293B').font('Helvetica-Bold').fontSize(12).text('Comisiones', 46, y);
    y += 18;
    doc.fill(GRIS).font('Helvetica').fontSize(9.5)
      .text(`Estimadas: ${money(comisiones.estimada)}    Pagadas por GNP: ${money(comisiones.pagada)}    Conciliadas: ${money(comisiones.conciliada)}    Por conciliar: ${money(comisiones.porConciliar)}`, 52, y);
    y += 22;
  }

  /* ── Pie ── */
  doc.fill('#94A3B8').font('Helvetica').fontSize(7.5)
    .text('Documento confidencial — Finance S-Cool / Incubadora S-COOL. Generado automáticamente por el CRM.', 46, doc.page.height - 40, { width: W, align: 'center' });

  doc.end();
  return doc;
}

module.exports = { buildAgentReportPDF };
