/**
 * CrmGraficasView — Gráficas del libro de pólizas VIVO.
 * Fuente: crm_pru_polizas_indice (se actualiza con el reporte diario del
 * Business Review). Agencia ve todo; un asesor ve solo su clave.
 *
 * Fase 1 del encargo "sección de gráficas alineada a las pólizas actuales".
 * (Fase 2 pendiente: calculadora de necesidades por prospecto estilo Zeus-S.)
 */
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, LabelList,
} from 'recharts';
import { TrendingUp, ShieldCheck, FileText, Users, AlertTriangle, RefreshCw, Layers } from 'lucide-react';

const mxn = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const mxnK = (n) => { const v = Number(n) || 0; return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : '$' + Math.round(v); };
const pct = (n) => (Number(n) || 0).toFixed(1) + '%';

const ESTATUS_COLOR = { Vigente: C.green, Cancelada: C.red };
const CONSERV_COLOR = { CONSERVADA: C.green, 'PENDIENTE DE PAGO': C.amber, 'NO CONSERVADA': C.red };
const PIE = [C.blue, C.gold, C.green, C.amber, C.red, '#7C3AED', '#0891B2', '#8A6A34'];

const GV_CSS = `
  .gv { --gold:${C.gold}; --ink:${C.ink}; --hair:#E4E8F0; }
  @keyframes gvRise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  .gv-plaque { position:relative; overflow:hidden; display:flex; justify-content:space-between; align-items:center; gap:22px; flex-wrap:wrap; margin-bottom:18px; padding:20px 26px; border-radius:16px; background:radial-gradient(130% 170% at 8% 0%, #14315E 0%, ${C.ink} 55%, #081324 100%); box-shadow:0 16px 40px -22px rgba(4,12,26,.6); animation:gvRise .5s ease backwards; }
  .gv-plaque::before { content:''; position:absolute; inset:0; background-image:radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px); background-size:22px 22px; opacity:.35; pointer-events:none; }
  .gv-overline { display:flex; align-items:center; gap:10px; margin:0 0 5px; }
  .gv-overline span { height:1px; width:24px; background:linear-gradient(90deg,transparent,rgba(193,151,91,.85)); }
  .gv-overline em { font-style:normal; font-size:9.5px; letter-spacing:2.6px; text-transform:uppercase; color:#D6B37E; font-weight:700; }
  .admin-wrap .gv h1.gv-title { font-family:'Fraunces',Georgia,serif; font-size:27px; font-weight:600; margin:0; color:#F2E4C8; }
  .gv-sub { font-size:12px; color:rgba(233,240,250,.6); margin:3px 0 0; }
  .gv-refresh { width:36px; height:36px; border-radius:50%; border:1px solid rgba(193,151,91,.4); background:rgba(255,255,255,.04); color:#D6B37E; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .25s; }
  .gv-refresh:hover { border-color:var(--gold); background:rgba(193,151,91,.14); transform:rotate(90deg); }

  .gv-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(185px, 1fr)); gap:12px; margin-bottom:18px; animation:gvRise .5s .05s ease backwards; }
  .gv-kpi { background:#fff; border:1px solid var(--hair); border-radius:14px; padding:15px 17px; position:relative; overflow:hidden; }
  .gv-kpi::after { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--kc, ${C.blue}); }
  .gv-kpi i { display:flex; align-items:center; gap:7px; font-style:normal; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:${C.textMuted}; font-weight:700; }
  .gv-kpi b { display:block; font-family:'Fraunces',Georgia,serif; font-size:27px; font-weight:600; color:var(--ink); margin-top:7px; font-variant-numeric:tabular-nums; letter-spacing:-.5px; }
  .gv-kpi u { text-decoration:none; font-size:11px; color:${C.textLight}; }

  .gv-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:14px; animation:gvRise .5s .1s ease backwards; }
  @media (max-width: 920px) { .gv-grid { grid-template-columns:1fr; } }
  .gv-card { background:#fff; border:1px solid var(--hair); border-radius:14px; padding:16px 18px; }
  .gv-card.wide { grid-column:1 / -1; }
  .gv-card h3 { margin:0 0 3px; font-size:13.5px; font-weight:700; color:var(--ink); display:flex; align-items:center; gap:8px; }
  .gv-card p.hint { margin:0 0 12px; font-size:11px; color:${C.textMuted}; }
  .gv-conserv-bar { height:16px; border-radius:9px; background:${C.redBg}; overflow:hidden; display:flex; margin:4px 0 10px; }
  .gv-conserv-bar span { display:block; height:100%; }
  .gv-legend { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; color:${C.textMuted}; }
  .gv-legend b { color:var(--ink); }
  .gv-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; vertical-align:-1px; }

  .gv-table { width:100%; border-collapse:collapse; font-size:12px; }
  .gv-table th { text-align:left; font-size:9.5px; letter-spacing:1px; text-transform:uppercase; color:${C.textMuted}; font-weight:700; padding:6px 8px; border-bottom:1px solid var(--hair); }
  .gv-table td { padding:7px 8px; border-bottom:1px solid #F0F2F6; color:${C.text}; }
  .gv-table tr:hover td { background:#FAFBFD; }
  .gv-tnum { text-align:right; font-variant-numeric:tabular-nums; }
  .gv-pill { display:inline-block; font-size:10px; font-weight:700; padding:2px 9px; border-radius:11px; }
  .gv-empty { color:${C.textMuted}; font-size:13px; padding:30px 4px; text-align:center; }
`;

function Kpi({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="gv-kpi" style={{ '--kc': color }}>
      <i><Icon size={13} style={{ color }} /> {label}</i>
      <b>{value}</b>
      {sub && <u>{sub}</u>}
    </div>
  );
}

const pieData = (obj) => Object.entries(obj || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

export default function CrmGraficasView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setData(await api.crmPolizasDashboard()); }
    catch (e) { setError(e.message || 'No se pudo cargar'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const k = data?.kpis || {};
  const ch = data?.charts || {};
  const conserv = useMemo(() => pieData(ch.estatusConservacion), [ch.estatusConservacion]);
  const totalConserv = conserv.reduce((s, x) => s + x.value, 0) || 1;

  if (loading) return <div className="gv"><style>{GV_CSS}</style><p className="gv-empty">Cargando gráficas…</p></div>;
  if (error) return <div className="gv"><style>{GV_CSS}</style><p className="gv-empty" style={{ color: C.red }}>{error}</p></div>;
  if (data?.vacio) return <div className="gv"><style>{GV_CSS}</style><p className="gv-empty">Aún no tienes pólizas asignadas a tu clave.</p></div>;

  return (
    <div className="gv">
      <style>{GV_CSS}</style>

      <div className="gv-plaque">
        <div style={{ position: 'relative' }}>
          <div className="gv-overline"><span /><em>Libro de pólizas · {data.scope === 'agencia' ? 'Agencia completa' : 'Tu cartera'}</em></div>
          <h1 className="gv-title">Gráficas</h1>
          <p className="gv-sub">
            Todo sale en vivo de tus pólizas actuales ({data.periodo || '—'}) · se actualiza solo con el reporte diario
            {data.actualizado ? ` · últ. ${new Date(data.actualizado).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` : ''}
          </p>
        </div>
        <button className="gv-refresh" onClick={load} title="Actualizar"><RefreshCw size={15} /></button>
      </div>

      <div className="gv-kpis">
        <Kpi icon={FileText} label="Pólizas" value={(k.total || 0).toLocaleString('es-MX')} sub={`${k.vigentes || 0} vigentes · ${k.canceladas || 0} canceladas`} color={C.blue} />
        <Kpi icon={TrendingUp} label="Prima vigente" value={mxnK(k.primaVigente)} sub="neta anualizada" color={C.green} />
        <Kpi icon={ShieldCheck} label="Índice conservación" value={pct(k.indiceConservacion)} sub={`${mxnK(k.baseConservada)} de ${mxnK(k.baseConservar)}`} color={k.indiceConservacion >= 60 ? C.green : k.indiceConservacion >= 40 ? C.amber : C.red} />
        <Kpi icon={AlertTriangle} label="Renuevan ≤60 días" value={(k.renovacion60 || 0).toLocaleString('es-MX')} sub="pólizas por vencer" color={C.amber} />
        {data.scope === 'agencia' && <Kpi icon={Users} label="Asesores" value={k.asesores || 0} sub={`${k.planes || 0} planes distintos`} color={C.gold} />}
      </div>

      <div className="gv-grid">
        {/* Índice de conservación — barra apilada */}
        <div className="gv-card wide">
          <h3><ShieldCheck size={15} style={{ color: C.green }} /> Conservación de la cartera</h3>
          <p className="hint">Base conservada vs. lo que falta por conservar — el número que persigue el Business Review.</p>
          <div className="gv-conserv-bar">
            {conserv.map(s => <span key={s.name} style={{ width: `${s.value / totalConserv * 100}%`, background: CONSERV_COLOR[s.name] || C.textLight }} title={`${s.name}: ${s.value}`} />)}
          </div>
          <div className="gv-legend">
            {conserv.map(s => <span key={s.name}><span className="gv-dot" style={{ background: CONSERV_COLOR[s.name] || C.textLight }} /><b>{s.value}</b> {s.name.toLowerCase()}</span>)}
          </div>
        </div>

        {/* Estatus de cálculo */}
        <div className="gv-card">
          <h3><Layers size={15} style={{ color: C.blue }} /> Vigentes vs. canceladas</h3>
          <p className="hint">Estado de cálculo de todas las pólizas del libro.</p>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={pieData(ch.estatusCalculo)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {pieData(ch.estatusCalculo).map((e, i) => <Cell key={i} fill={ESTATUS_COLOR[e.name] || PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} pólizas`, n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Frecuencia de pago */}
        <div className="gv-card">
          <h3><FileText size={15} style={{ color: C.gold }} /> Prima vigente por frecuencia</h3>
          <p className="hint">Cómo se distribuye la prima anualizada según la forma de pago.</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={pieData(ch.primaPorFrecuencia)} margin={{ top: 14, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textMuted }} />
              <YAxis tickFormatter={mxnK} tick={{ fontSize: 10, fill: C.textLight }} width={46} />
              <Tooltip formatter={(v) => mxn(v)} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={C.gold}>
                <LabelList dataKey="value" position="top" formatter={mxnK} style={{ fontSize: 10, fill: C.textMuted }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top planes */}
        <div className="gv-card wide">
          <h3><Layers size={15} style={{ color: C.blue }} /> Planes más vendidos</h3>
          <p className="hint">Los 12 planes con más pólizas en el libro.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ch.topPlanes || []} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: C.textLight }} />
              <YAxis type="category" dataKey="plan" tick={{ fontSize: 10, fill: C.textMuted }} width={74} />
              <Tooltip formatter={(v) => [`${v} pólizas`, 'Pólizas']} />
              <Bar dataKey="n" radius={[0, 6, 6, 0]} fill={C.blue}>
                <LabelList dataKey="n" position="right" style={{ fontSize: 10, fill: C.textMuted }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cartera por asesor (solo agencia) */}
        {data.scope === 'agencia' && (
          <div className="gv-card wide">
            <h3><Users size={15} style={{ color: C.gold }} /> Cartera por asesor</h3>
            <p className="hint">Base a conservar, conservada e índice de conservación por clave. Ordenado por tamaño de cartera.</p>
            <table className="gv-table">
              <thead>
                <tr><th>Clave</th><th className="gv-tnum">Pólizas</th><th className="gv-tnum">Vigentes</th><th className="gv-tnum">A conservar</th><th className="gv-tnum">Conservada</th><th className="gv-tnum">Índice</th></tr>
              </thead>
              <tbody>
                {(ch.porClave || []).map(c => {
                  const col = c.indice >= 60 ? C.green : c.indice >= 40 ? C.amber : C.red;
                  const bg = c.indice >= 60 ? C.greenBg : c.indice >= 40 ? C.amberBg : C.redBg;
                  return (
                    <tr key={c.clave}>
                      <td style={{ fontWeight: 700 }}>{c.clave}</td>
                      <td className="gv-tnum">{c.polizas}</td>
                      <td className="gv-tnum">{c.vigentes}</td>
                      <td className="gv-tnum">{mxnK(c.conservar)}</td>
                      <td className="gv-tnum">{mxnK(c.conservada)}</td>
                      <td className="gv-tnum"><span className="gv-pill" style={{ color: col, background: bg }}>{pct(c.indice)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Próximas renovaciones */}
        <div className="gv-card wide">
          <h3><AlertTriangle size={15} style={{ color: C.amber }} /> Próximas renovaciones (≤60 días)</h3>
          <p className="hint">Pólizas vigentes cuyo "pagado hasta" vence pronto — las que hay que cobrar para no perder conservación.</p>
          {(data.proximasRenov || []).length === 0
            ? <p className="gv-empty" style={{ padding: '12px 0' }}>Ninguna póliza vence en los próximos 60 días. 👌</p>
            : (
              <table className="gv-table">
                <thead>
                  <tr>{data.scope === 'agencia' && <th>Clave</th>}<th>Plan</th><th className="gv-tnum">Prima anual</th><th className="gv-tnum">Base</th><th>Pagado hasta</th></tr>
                </thead>
                <tbody>
                  {(data.proximasRenov || []).map((r, i) => (
                    <tr key={i}>
                      {data.scope === 'agencia' && <td style={{ fontWeight: 700 }}>{r.clave}</td>}
                      <td>{r.plan}</td>
                      <td className="gv-tnum">{mxn(r.prima)}</td>
                      <td className="gv-tnum">{mxnK(r.base)}</td>
                      <td>{new Date(`${r.pagado_hasta}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}
