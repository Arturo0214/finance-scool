/**
 * CrmMiDiaView — "Mi Día": el Sistema de Productividad Comercial para el asesor.
 * No muestra datos: dice QUÉ HACER hoy para subir índice, bonos y conservación.
 *
 *  1. Índice de conservación (cobrado / realista / techo) + bono del trimestre.
 *  2. Próximos pasos priorizados (next-best-action) desde /ingresos/proximos-pasos.
 *  3. Simulador de arrastre: mueve pólizas a "Si las trabajo hoy" y ve, en vivo,
 *     cuánto sube tu índice y tu bono (usa /ingresos/simulate).
 *
 * Reusa el motor PIR ya existente (computeIngresos); es capa de presentación.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  RefreshCw, Sparkles, RotateCcw, HandCoins, ShieldCheck, TrendingUp,
  Flame, AlertTriangle, Target, ArrowRight, Trophy, GripVertical,
  KanbanSquare, CalendarClock, MessageCircle, PhoneMissed,
} from 'lucide-react';
import { getCrmCSS, fmtMoney, etapaInfo, fmtDate } from './crmShared';

const pctTxt = (n, dec = 2) => `${((Number(n) || 0) * 100).toFixed(dec)}%`;
const deltaPct = (n, dec = 2) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(dec)}%`;
const indiceColor = (i) => (i >= 0.94 ? C.green : i >= 0.90 ? '#0891B2' : i >= 0.86 ? C.amber : C.red);

const URG = {
  EXTREMA: { label: 'Extrema', color: C.red, bg: C.redBg },
  ALTA: { label: 'Urgente', color: C.amber, bg: C.amberBg },
  MEDIA: { label: 'Media', color: '#0891B2', bg: '#E6F6F9' },
  BAJA: { label: 'Baja', color: C.textMuted, bg: '#EEF1F6' },
};
const TIPO_ICON = { rehabilitar: RotateCcw, cobrar: HandCoins, indice: TrendingUp };

/* Barra del índice con marcas 86 / 90 / 94 y las tres lecturas superpuestas */
function IndiceBar({ cobrado, realista, techo }) {
  const mark = (m) => (
    <div key={m} style={{ position: 'absolute', left: `${m * 100}%`, top: -3, bottom: -3, width: 2, background: C.ink, opacity: 0.5 }} title={`Umbral ${pctTxt(m, 0)}`} />
  );
  return (
    <div style={{ position: 'relative', height: 16, background: 'rgba(11,27,51,.07)', borderRadius: 9, margin: '14px 0 8px' }}>
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, techo * 100)}%`, background: `${indiceColor(techo)}33`, borderRadius: 9, transition: 'width .5s' }} />
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, realista * 100)}%`, background: `${indiceColor(realista)}66`, borderRadius: 9, transition: 'width .5s' }} />
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, cobrado * 100)}%`, background: indiceColor(cobrado), borderRadius: 9, transition: 'width .5s' }} />
      {[0.86, 0.90, 0.94].map(mark)}
    </div>
  );
}

export default function CrmMiDiaView({ isAgency }) {
  const [agentes, setAgentes] = useState([]);
  const [clave, setClave] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Simulador de arrastre
  const [picked, setPicked] = useState({});       // id -> { tipo, titulo, monto, impacto }
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  // Pipeline accionable ("próxima acción obligatoria")
  const [pipe, setPipe] = useState(null);

  const loadPasos = useCallback(async (cv) => {
    setLoading(true); setErr('');
    try {
      const d = await api.crmIngresosProximosPasos(cv || '');
      setData(d); setPicked({}); setSimResult(null);
      if (d?.clave) setClave(d.clave);
    } catch (e) { setErr(e.message || 'No se pudo cargar'); setData(null); }
    finally { setLoading(false); }
  }, []);

  // Agencia: cargar lista de asesores para el selector; asesor: su propia clave
  useEffect(() => {
    (async () => {
      if (isAgency) {
        try {
          const ov = await api.crmIngresosOverview();
          const list = (ov.agentes || []).filter(a => a.clave);
          setAgentes(list);
          await loadPasos(list[0]?.clave || '');
        } catch (e) { setErr(e.message); setLoading(false); }
      } else {
        await loadPasos('');
      }
    })();
    // Pipeline accionable (independiente del índice; asesor=suyo, agencia=promotoría)
    api.crmPipelineAcciones().then(setPipe).catch(() => setPipe(null));
  }, [isAgency, loadPasos]);

  // Recalcular simulación cuando cambia la selección
  useEffect(() => {
    const ids = Object.entries(picked);
    if (!data?.clave || !ids.length) { setSimResult(null); return; }
    const cobrar = ids.filter(([, v]) => v.tipo === 'cobrar').map(([id]) => Number(id));
    const rehab = ids.filter(([, v]) => v.tipo === 'rehabilitar').map(([id]) => Number(id));
    let cancel = false;
    setSimLoading(true);
    api.crmIngresosSimulate({ clave: data.clave, cobrarPolizas: cobrar, rehabilitarPolizas: rehab })
      .then(r => { if (!cancel) setSimResult(r); })
      .catch(() => { if (!cancel) setSimResult(null); })
      .finally(() => { if (!cancel) setSimLoading(false); });
    return () => { cancel = true; };
  }, [picked, data?.clave]);

  const pasosAccionables = (data?.pasos || []).filter(p => p?.cta?.poliza_id && (p.tipo === 'cobrar' || p.tipo === 'rehabilitar'));
  const disponibles = pasosAccionables.filter(p => !picked[p.cta.poliza_id]);

  const add = (p) => setPicked(prev => ({ ...prev, [p.cta.poliza_id]: { tipo: p.tipo, titulo: p.titulo, monto: p.monto, impacto: p.impacto_indice } }));
  const remove = (id) => setPicked(prev => { const n = { ...prev }; delete n[id]; return n; });
  const onDropCanasta = (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const p = pasosAccionables.find(x => String(x.cta.poliza_id) === id); if (p) add(p); };
  const montoPicked = Object.values(picked).reduce((s, v) => s + (v.monto || 0), 0);

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando tu día...</p></div></>;

  return (
    <>
      <style>{getCrmCSS()}</style>
      <style>{`
        .midia-hero{background:linear-gradient(135deg,${C.navy},${C.ink});color:#fff;border-radius:18px;padding:22px 24px;position:relative;overflow:hidden}
        .midia-metric{display:flex;flex-direction:column;gap:2px}
        .midia-metric b{font-size:26px;font-weight:800;line-height:1}
        .midia-metric span{font-size:11px;opacity:.8}
        .paso-card{display:flex;gap:12px;align-items:flex-start;background:${C.card};border:1px solid rgba(11,27,51,.09);border-left-width:4px;border-radius:12px;padding:13px 15px;transition:box-shadow .15s,transform .15s}
        .paso-card:hover{box-shadow:0 6px 20px rgba(5,22,54,.09);transform:translateY(-1px)}
        .drop-zone{min-height:120px;border:2px dashed rgba(11,27,51,.18);border-radius:14px;padding:12px;transition:border-color .15s,background .15s}
        .drop-zone.hot{border-color:${C.accent};background:${C.accent}0d}
        .drag-item{display:flex;align-items:center;gap:8px;background:${C.card};border:1px solid rgba(11,27,51,.1);border-radius:9px;padding:8px 10px;margin-bottom:7px;cursor:grab;font-size:12.5px}
        .drag-item:active{cursor:grabbing}
        .midia-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px}
      `}</style>

      {/* ── Toolbar ── */}
      <div className="crm-toolbar">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={20} color={C.gold} /> Mi Día</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>Tus próximos pasos para subir índice, bonos y conservación.</p>
        </div>
        <div className="crm-toolbar-right">
          {isAgency && agentes.length > 0 && (
            <select className="crm-select" value={clave} onChange={e => loadPasos(e.target.value)}>
              {agentes.map(a => <option key={a.clave} value={a.clave}>{a.nombre} · {a.clave}</option>)}
            </select>
          )}
          <button className="crm-btn ghost" onClick={() => loadPasos(clave)} title="Actualizar"><RefreshCw size={15} /> Actualizar</button>
        </div>
      </div>

      {err && <div className="crm-chart-card" style={{ borderLeft: `4px solid ${C.red}`, color: C.red }}><AlertTriangle size={16} /> {err}</div>}

      {data && (
        <>
          {/* ── Hero: índice + bono ── */}
          <div className="midia-hero" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontSize: 12, opacity: .75, textTransform: 'uppercase', letterSpacing: .6 }}>Índice de conservación</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: indiceColor(data.indice.realista) }}>{pctTxt(data.indice.realista, 1)}</span>
                  <span style={{ fontSize: 13, opacity: .8 }}>realista</span>
                </div>
                <IndiceBar cobrado={data.indice.cobrado} realista={data.indice.realista} techo={data.indice.techo} />
                <div style={{ display: 'flex', gap: 16, fontSize: 11.5, opacity: .9 }}>
                  <span>Cobrado <b>{pctTxt(data.indice.cobrado, 1)}</b></span>
                  <span>Techo <b>{pctTxt(data.indice.techo, 1)}</b></span>
                  <span>Mínimo bono <b>{pctTxt(data.indice.minimoBono, 0)}</b></span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
                <div className="midia-metric"><b>{fmtMoney(data.bono_trimestre)}</b><span>Bono del trimestre</span></div>
                <div className="midia-metric"><b style={{ color: '#FCA5A5' }}>{data.resumen.urgentes}</b><span>Rehab. urgentes</span></div>
                <div className="midia-metric"><b>{data.resumen.rehabilitables}</b><span>Rehab. · {fmtMoney(data.resumen.monto_rehab)}</span></div>
                <div className="midia-metric"><b>{data.resumen.pendientes}</b><span>Por cobrar · {fmtMoney(data.resumen.monto_pendiente)}</span></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
            {/* ── Próximos pasos ── */}
            <div>
              <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Target size={17} color={C.accent} /> Próximos pasos</h3>
              {data.pasos.length === 0 && <div className="crm-chart-card" style={{ textAlign: 'center', color: C.textMuted }}><Trophy size={26} color={C.gold} /><p style={{ margin: '8px 0 0' }}>Cartera sana. Sin acciones urgentes hoy. 🎉</p></div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.pasos.map((p, i) => {
                  const Icon = TIPO_ICON[p.tipo] || Sparkles;
                  const u = URG[p.urgencia] || URG.BAJA;
                  const accionable = p.cta?.poliza_id && (p.tipo === 'cobrar' || p.tipo === 'rehabilitar');
                  const yaEnCanasta = accionable && picked[p.cta.poliza_id];
                  return (
                    <div key={i} className="paso-card" style={{ borderLeftColor: u.color }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: u.bg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon size={17} color={u.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <b style={{ fontSize: 13.5, color: C.ink }}>{p.titulo}</b>
                          {p.urgencia && p.tipo !== 'indice' && <span className="midia-chip" style={{ background: u.bg, color: u.color }}>{p.urgencia === 'EXTREMA' && <Flame size={11} />}{u.label}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{p.detalle}</div>
                        <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11.5, alignItems: 'center', flexWrap: 'wrap' }}>
                          {p.monto > 0 && <span style={{ fontWeight: 700, color: C.ink }}>{fmtMoney(p.monto)}</span>}
                          {p.impacto_indice > 0 && <span style={{ color: C.green, fontWeight: 700 }}><TrendingUp size={12} style={{ verticalAlign: -2 }} /> {deltaPct(p.impacto_indice)} índice</span>}
                          {accionable && (
                            <button className="crm-btn ghost" style={{ padding: '3px 10px', fontSize: 11.5, marginLeft: 'auto' }}
                              onClick={() => yaEnCanasta ? remove(p.cta.poliza_id) : add(p)}>
                              {yaEnCanasta ? 'Quitar del simulador' : <>Simular <ArrowRight size={12} /></>}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Simulador de arrastre ── */}
            <div className="crm-chart-card" style={{ position: 'sticky', top: 12 }}>
              <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7 }}><ShieldCheck size={17} color={C.green} /> Simulador de índice</h3>
              <p className="sub" style={{ margin: '0 0 12px' }}>Arrastra pólizas a “Si las trabajo hoy” y mira cuánto suben tu índice y tu bono.</p>

              {simResult && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: C.greenBg, borderRadius: 11, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Índice operativo</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <b style={{ fontSize: 20, color: indiceColor(simResult.simulado.indice.operativo) }}>{pctTxt(simResult.simulado.indice.operativo, 1)}</b>
                      <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{deltaPct(simResult.delta.indice, 2)}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: C.goldBg, borderRadius: 11, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Bono del trimestre</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <b style={{ fontSize: 20, color: C.gold }}>{fmtMoney(simResult.simulado.bonos.total_trimestre)}</b>
                      {simResult.delta.bonos > 0 && <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>+{fmtMoney(simResult.delta.bonos)}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Zona de arrastre */}
              <div className="drop-zone" onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('hot'); }}
                onDragLeave={e => e.currentTarget.classList.remove('hot')}
                onDrop={e => { e.currentTarget.classList.remove('hot'); onDropCanasta(e); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                  <b>Si las trabajo hoy {simLoading && '· calculando…'}</b>
                  {Object.keys(picked).length > 0 && <span>{Object.keys(picked).length} · {fmtMoney(montoPicked)}</span>}
                </div>
                {Object.keys(picked).length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, padding: '18px 0' }}>Arrastra aquí, o pulsa “Simular” en un paso.</div>}
                {Object.entries(picked).map(([id, v]) => (
                  <div key={id} className="drag-item" style={{ borderLeft: `3px solid ${v.tipo === 'cobrar' ? '#0891B2' : C.amber}` }}>
                    {v.tipo === 'cobrar' ? <HandCoins size={13} color="#0891B2" /> : <RotateCcw size={13} color={C.amber} />}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titulo}</span>
                    <span style={{ color: C.green, fontWeight: 700 }}>{deltaPct(v.impacto || 0)}</span>
                    <button className="crm-icon-btn" onClick={() => remove(id)} title="Quitar">✕</button>
                  </div>
                ))}
              </div>

              {/* Pool disponible */}
              <div style={{ fontSize: 11, color: C.textMuted, margin: '14px 0 8px' }}><b>Disponibles ({disponibles.length})</b></div>
              <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                {disponibles.length === 0 && <div style={{ fontSize: 12, color: C.textMuted, padding: '8px 0' }}>Nada más por simular.</div>}
                {disponibles.map((p) => (
                  <div key={p.cta.poliza_id} className="drag-item" draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', String(p.cta.poliza_id))}
                    onClick={() => add(p)} title="Arrastra o pulsa para agregar">
                    <GripVertical size={13} color={C.textMuted} />
                    {p.tipo === 'cobrar' ? <HandCoins size={13} color="#0891B2" /> : <RotateCcw size={13} color={C.amber} />}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</span>
                    <span style={{ color: C.green, fontWeight: 700 }}>{deltaPct(p.impacto_indice || 0)}</span>
                  </div>
                ))}
              </div>

              {Object.keys(picked).length > 0 && (
                <button className="crm-btn ghost" style={{ marginTop: 12, width: '100%' }} onClick={() => setPicked({})}><RotateCcw size={14} /> Limpiar</button>
              )}
            </div>
          </div>

          {/* ── Pipeline accionable: próxima acción obligatoria ── */}
          {pipe && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7 }}><KanbanSquare size={17} color={C.accent} /> Pipeline accionable</h3>
              <p className="sub" style={{ margin: '0 0 12px' }}>Cada prospecto activo debe tener una próxima acción agendada. Estos son los huecos y lo que vence.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { k: 'sin_accion', label: 'Sin próxima acción', color: C.red, bg: C.redBg, icon: PhoneMissed },
                  { k: 'vencidas', label: 'Acciones vencidas', color: C.amber, bg: C.amberBg, icon: AlertTriangle },
                  { k: 'hoy', label: 'Para hoy', color: '#0891B2', bg: '#E6F6F9', icon: CalendarClock },
                  { k: 'proximas', label: 'Próximas', color: C.green, bg: C.greenBg, icon: Target },
                ].map(({ k, label, color, bg, icon: Ic }) => (
                  <div key={k} className="crm-chart-card" style={{ padding: '12px 14px', borderLeft: `4px solid ${color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted, fontSize: 11 }}><Ic size={13} color={color} /> {label}</div>
                    <b style={{ fontSize: 24, color }}>{pipe.resumen[k]}</b>
                  </div>
                ))}
              </div>

              {[
                { k: 'sin_accion', title: 'Sin próxima acción — agéndala', color: C.red },
                { k: 'vencidas', title: 'Acciones vencidas — reprograma o ejecuta', color: C.amber },
              ].map(({ k, title, color }) => (
                pipe.grupos[k].length > 0 && (
                  <div key={k} className="crm-chart-card" style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, color, fontSize: 13, marginBottom: 8 }}>{title} ({pipe.grupos[k].length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pipe.grupos[k].slice(0, 20).map(c => {
                        const et = etapaInfo(c.etapa);
                        const tel = (c.telefono || '').replace(/\D/g, '');
                        return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(11,27,51,.06)' }}>
                            <span className="midia-chip" style={{ background: `${et.color}22`, color: et.color, flexShrink: 0 }}>{et.label}</span>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: C.ink }}>{c.nombre}</span>
                            {isAgency && c.agente && <span style={{ fontSize: 11, color: C.textMuted }}>{c.agente}</span>}
                            {c.accion
                              ? <span style={{ fontSize: 11.5, color: C.textMuted }}>{c.accion.titulo} · {fmtDate(c.accion.fecha)}</span>
                              : <span style={{ fontSize: 11.5, color: C.red, fontWeight: 700 }}>⚠ sin acción</span>}
                            {tel && <a className="crm-icon-btn wa" title="WhatsApp" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /></a>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
