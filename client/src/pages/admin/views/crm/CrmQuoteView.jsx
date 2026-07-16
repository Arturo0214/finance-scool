/**
 * CrmQuoteView — Cotizador PPR (Art. 151 LISR)
 * Calculadora de deducción fiscal + proyección de retiro con propuesta
 * imprimible para el prospecto. Puede guardarse en el expediente.
 */
import { useState, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Calculator, Printer, Save } from 'lucide-react';
import { getCrmCSS, fmtMoneyFull } from './crmShared';

const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

export default function CrmQuoteView() {
  const [f, setF] = useState({
    nombre: '', edad: 35, edadRetiro: 65, aportMensual: 5000,
    rendimiento: 8, ingresoAnual: 600000, tasaISR: 30, uma: 113.14,
  });
  const [clients, setClients] = useState(null);
  const [saveClient, setSaveClient] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  const r = useMemo(() => {
    const anios = Math.max((f.edadRetiro || 65) - (f.edad || 30), 1);
    const aportAnual = (f.aportMensual || 0) * 12;
    const topeUMA = (f.uma || 113.14) * 365 * 5;
    const topeIngreso = (f.ingresoAnual || 0) * 0.10;
    const tope = Math.min(topeIngreso || topeUMA, topeUMA);
    const deducible = Math.min(aportAnual, tope);
    const devolucion = deducible * ((f.tasaISR || 0) / 100);
    const costoReal = (f.aportMensual || 0) - devolucion / 12;

    const rm = (f.rendimiento || 0) / 100 / 12;
    let saldo = 0, aportado = 0;
    const serie = [];
    for (let y = 1; y <= anios; y++) {
      for (let m = 0; m < 12; m++) { saldo = saldo * (1 + rm) + (f.aportMensual || 0); aportado += (f.aportMensual || 0); }
      serie.push({ edad: (f.edad || 30) + y, 'Total aportado': Math.round(aportado), 'Saldo proyectado': Math.round(saldo) });
    }
    return {
      anios, aportAnual, tope, topeUMA, topeIngreso, deducible, devolucion, costoReal,
      saldoFinal: saldo, aportado, rendimientoGenerado: saldo - aportado,
      devolucionesAcum: devolucion * anios,
      pensionMensual: (saldo * 0.04) / 12, // regla del 4% anual
      serie,
    };
  }, [f]);

  const guardarEnExpediente = async () => {
    if (!saveClient) return;
    setSaving(true);
    try {
      const texto = `📊 Cotización PPR — aportación ${fmt(f.aportMensual)}/mes, retiro a los ${f.edadRetiro} años (${r.anios} años de plan). ` +
        `Deducible anual: ${fmt(r.deducible)} → devolución ISR est. ${fmt(r.devolucion)}/año (costo real ${fmt(r.costoReal)}/mes). ` +
        `Saldo proyectado al retiro: ${fmt(r.saldoFinal)} (aportado ${fmt(r.aportado)} + rendimiento ${fmt(r.rendimientoGenerado)} al ${f.rendimiento}%). ` +
        `Pensión mensual estimada (regla 4%): ${fmt(r.pensionMensual)}.`;
      await api.crmCreateNote({ client_id: Number(saveClient), tipo: 'nota', texto });
      setMsg('✓ Cotización guardada en el expediente del cliente');
      setTimeout(() => setMsg(''), 3500);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const loadClients = async () => { if (!clients) { const d = await api.crmGetClients().catch(() => ({})); setClients(d.clients || []); } };

  const num = (k, label, props = {}) => (
    <div className="field" style={{ marginBottom: 12 }}>
      <label>{label}</label>
      <input type="number" value={f[k]} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <div className="view">
      <style>{getCrmCSS()}{`
        @media print {
          body * { visibility: hidden; }
          #ppr-proposal, #ppr-proposal * { visibility: visible; }
          #ppr-proposal { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Cotizador PPR</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>Deducción Art. 151 LISR + proyección de retiro — genera la propuesta en segundos</p>
        </div>
        <div className="crm-toolbar-right">
          <button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Imprimir / PDF</button>
        </div>
      </div>

      {msg && <div className="info-box" style={{ marginBottom: 14 }}><p>{msg}</p></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20, alignItems: 'start' }} className="ppr-grid">
        <style>{`@media(max-width:900px){ .ppr-grid { grid-template-columns:1fr !important; } }`}</style>

        {/* ── Parámetros ── */}
        <div className="crm-chart-card" style={{ marginBottom: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Calculator size={16} color={C.gold} /> Datos del prospecto</h3>
          <p className="sub">Ajusta y la propuesta se recalcula al instante</p>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Nombre (para la propuesta)</label>
            <input value={f.nombre} onChange={set('nombre')} placeholder="Ej. María Fernanda Ríos" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            {num('edad', 'Edad actual', { min: 18, max: 70 })}
            {num('edadRetiro', 'Edad de retiro', { min: 55, max: 75 })}
            {num('aportMensual', 'Aportación mensual', { step: 500 })}
            {num('rendimiento', 'Rendimiento anual %', { step: 0.5 })}
            {num('ingresoAnual', 'Ingreso anual (MXN)', { step: 10000 })}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Tasa ISR marginal</label>
              <select value={f.tasaISR} onChange={set('tasaISR')}>
                {[1.92, 6.4, 10.88, 16, 17.92, 21.36, 23.52, 30, 32, 34, 35].map(t => <option key={t} value={t}>{t}%</option>)}
              </select>
            </div>
          </div>
          {num('uma', 'UMA diaria vigente', { step: 0.01 })}
          <p style={{ fontSize: 11, color: C.textLight, margin: '4px 0 0' }}>
            Tope deducible Art. 151: el menor entre 10% del ingreso ({fmt(r.topeIngreso)}) y 5 UMAs anuales ({fmt(r.topeUMA)}).
          </p>

          {/* Guardar en expediente */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: 'block', marginBottom: 6 }}>Guardar en expediente</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="crm-select" style={{ flex: 1, minWidth: 0 }} value={saveClient} onFocus={loadClients} onChange={e => setSaveClient(e.target.value)}>
                <option value="">Elegir cliente...</option>
                {(clients || []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button className="btn-secondary" disabled={!saveClient || saving} onClick={guardarEnExpediente}><Save size={14} /></button>
            </div>
          </div>
        </div>

        {/* ── Propuesta ── */}
        <div id="ppr-proposal" className="crm-chart-card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.gold, fontWeight: 700 }}>Finance SCool · Plan Personal de Retiro</div>
              <h3 style={{ fontSize: 21, marginTop: 4 }}>{f.nombre ? `Propuesta para ${f.nombre}` : 'Tu propuesta de retiro'}</h3>
            </div>
            <span style={{ fontSize: 11.5, color: C.textMuted }}>{new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <p className="sub">Aportando {fmt(f.aportMensual)} al mes durante {r.anios} años (retiro a los {f.edadRetiro})</p>

          <div className="crm-kpi-detail" style={{ marginTop: 6 }}>
            <div className="crm-kpi-box">
              <div className="k-label">Saldo al retiro</div>
              <div className="k-value" style={{ color: C.primary }}>{fmt(r.saldoFinal)}</div>
              <div className="k-sub">al {f.rendimiento}% anual compuesto</div>
            </div>
            <div className="crm-kpi-box">
              <div className="k-label">Devolución ISR anual</div>
              <div className="k-value" style={{ color: C.green }}>{fmt(r.devolucion)}</div>
              <div className="k-sub">deducible {fmt(r.deducible)} × {f.tasaISR}%</div>
            </div>
            <div className="crm-kpi-box">
              <div className="k-label">Costo real mensual</div>
              <div className="k-value">{fmt(r.costoReal)}</div>
              <div className="k-sub">aportas {fmt(f.aportMensual)}, el SAT te regresa {fmt(r.devolucion / 12)}/mes</div>
            </div>
            <div className="crm-kpi-box">
              <div className="k-label">Pensión mensual est.</div>
              <div className="k-value" style={{ color: C.gold }}>{fmt(r.pensionMensual)}</div>
              <div className="k-sub">retirando 4% anual del saldo</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={r.serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="edad" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `${v} años`} />
              <YAxis tickFormatter={v => '$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : Math.round(v / 1000) + 'k')} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={58} />
              <Tooltip formatter={(v, n) => [fmtMoneyFull(v), n]} labelFormatter={v => `A los ${v} años`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Saldo proyectado" stroke={C.primary} strokeWidth={2.5} fill={`${C.primary}20`} />
              <Line type="monotone" dataKey="Total aportado" stroke={C.gold} strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <span>Total aportado: <b style={{ color: C.text }}>{fmt(r.aportado)}</b></span>
            <span>Rendimiento generado: <b style={{ color: C.green }}>{fmt(r.rendimientoGenerado)}</b></span>
            <span>Devoluciones ISR acumuladas: <b style={{ color: C.green }}>{fmt(r.devolucionesAcum)}</b></span>
          </div>
          <p style={{ fontSize: 10, color: C.textLight, marginTop: 12 }}>
            Proyección ilustrativa con rendimiento constante; no constituye garantía. Deducibilidad conforme al Art. 151 fracc. V de la LISR vigente. La devolución depende de la situación fiscal de cada contribuyente.
          </p>
        </div>
      </div>
    </div>
  );
}
