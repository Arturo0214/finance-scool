/**
 * CrmIncubadoraView — "Incubadora de vendedores".
 * Analiza qué sostienen los MEJORES asesores (índice, prima nueva, disciplina de
 * cobranza/rehabilitación) y lo convierte en un playbook accionable + las brechas
 * de los nuevos para acelerar su curva. Todo desde datos PIR ya existentes.
 *
 * Agencia: promotoría completa (leaderboard + nuevos). Asesor: su brecha vs el top.
 */
import { useState, useEffect } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  GraduationCap, Trophy, RefreshCw, TrendingUp, Target, Crown,
  BookOpen, ClipboardCheck, ArrowUpRight, AlertTriangle, Sparkles,
} from 'lucide-react';
import { getCrmCSS, fmtMoney } from './crmShared';
import { ChatPanel, chatCSS } from '../../../../components/CrmChatWidget';

const SUGERENCIAS_COACH = [
  '¿Cómo respondo a "lo tengo que pensar"?',
  'Dame un guion de WhatsApp para pedir referidos',
  '¿Cómo le explico el PPR a un cliente de 35 años?',
  '¿Qué digo cuando me dicen "está muy caro"?',
  '¿Cómo cierro a un cliente que ya vio la propuesta?',
];

const pct = (n, d = 1) => `${((Number(n) || 0) * 100).toFixed(d)}%`;
const indiceColor = (i) => (i >= 0.94 ? C.green : i >= 0.90 ? '#0891B2' : i >= 0.86 ? C.amber : C.red);
const fmtVal = (v, fmt) => (fmt === 'pct' ? pct(v) : fmt === 'money' ? fmtMoney(v) : String(v));

export default function CrmIncubadoraView() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true); setErr('');
    api.crmIncubadora().then(setD).catch(e => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Analizando a la promotoría...</p></div></>;

  const esAsesor = d?.scope === 'asesor';

  return (
    <>
      <style>{getCrmCSS()}</style>
      <div className="crm-toolbar">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><GraduationCap size={20} color={C.accent} /> Incubadora de vendedores</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>
            {d?.scope === 'asesor'
              ? 'Los hábitos de los mejores, convertidos en consejos para tu día a día.'
              : 'Qué hacen los mejores, convertido en playbook — para que los nuevos lleguen antes.'}
          </p>
        </div>
        <button className="crm-btn ghost" onClick={load}><RefreshCw size={15} /> Actualizar</button>
      </div>

      {err && <div className="crm-chart-card" style={{ borderLeft: `4px solid ${C.red}`, color: C.red, display: 'flex', gap: 8 }}><AlertTriangle size={16} /> {err}</div>}

      {d && (
        <>
          {/* ── Benchmark del top ── */}
          <div className="crm-chart-card" style={{ background: `linear-gradient(135deg,${C.navy},${C.ink})`, color: '#fff', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: .6, opacity: .8 }}><Crown size={15} color={C.gold} /> {esAsesor ? 'A dónde se puede llegar' : 'Estándar de los mejores'}</div>
            {esAsesor && <div style={{ fontSize: 11.5, opacity: .75, marginTop: 2 }}>La referencia de los mejores de la promotoría — inspiración, no calificación. Cada quien lleva su propio ritmo. 💪</div>}
            <div style={{ display: 'flex', gap: 40, marginTop: 10, flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 32, fontWeight: 800, color: indiceColor(d.benchmark.indice_top) }}>{pct(d.benchmark.indice_top)}</div><div style={{ fontSize: 11.5, opacity: .8 }}>Índice de conservación (mediana top)</div></div>
              <div><div style={{ fontSize: 32, fontWeight: 800 }}>{fmtMoney(d.benchmark.prima_top)}</div><div style={{ fontSize: 11.5, opacity: .8 }}>Prima nueva del trimestre (mediana top)</div></div>
            </div>
          </div>

          {/* ── Playbook ──
             Asesor: SOLO consejos (sin "Mejores vs Resto" — comparar desanima).
             Agencia: comparación completa para gestionar. */}
          <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Sparkles size={17} color={C.gold} /> {esAsesor ? 'Los hábitos que pagan' : 'El playbook'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginBottom: 24 }}>
            {d.playbook.map((p, i) => {
              if (esAsesor) {
                return (
                  <div key={i} className="crm-chart-card" style={{ borderLeft: `4px solid ${C.gold}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>💡 {p.metrica}</div>
                    <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, marginTop: 8 }}>{p.regla}</div>
                  </div>
                );
              }
              const mejor = p.menorEsMejor ? p.top <= p.resto : p.top >= p.resto;
              return (
                <div key={i} className="crm-chart-card" style={{ borderLeft: `4px solid ${C.gold}` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{p.metrica}</div>
                  <div style={{ display: 'flex', gap: 18, margin: '10px 0' }}>
                    <div><div style={{ fontSize: 21, fontWeight: 800, color: C.green }}>{fmtVal(p.top, p.fmt)}</div><div style={{ fontSize: 10.5, color: C.textMuted }}>Mejores</div></div>
                    <div style={{ alignSelf: 'center', color: mejor ? C.green : C.textMuted }}>{mejor && <ArrowUpRight size={16} />}</div>
                    <div><div style={{ fontSize: 21, fontWeight: 800, color: C.textMuted }}>{fmtVal(p.resto, p.fmt)}</div><div style={{ fontSize: 10.5, color: C.textMuted }}>Resto</div></div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{p.regla}</div>
                </div>
              );
            })}
          </div>

          {/* ── Vista del asesor: consejos personales, sin comparaciones ── */}
          {esAsesor && d.yo && (
            <div className="crm-chart-card" style={{ marginBottom: 24, borderTop: `3px solid ${C.gold}` }}>
              <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Target size={17} color={C.accent} /> Tus consejos de hoy</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {d.yo.indice >= 0.86 ? (
                  <div style={{ fontSize: 13 }}>✅ <b>Tu índice ({pct(d.yo.indice)}) está en zona de bonos.</b> Protégelo: cobra cada renovación en cuanto venza y no dejes pasar rehabilitaciones — así los bonos no se te escapan.</div>
                ) : (
                  <div style={{ fontSize: 13 }}>🛡️ <b>Tu prioridad #1 es el índice ({pct(d.yo.indice)}).</b> Cobra tus pendientes y rehabilita esta semana: en <b>Mi Día</b> está tu simulador con el impacto de cada póliza.</div>
                )}
                <div style={{ fontSize: 13 }}>🚀 <b>Vende negocio nuevo cada mes.</b> La constancia pesa más que un mes grande: tu <b>Carrera a tus bonos</b> (Mi Día) te dice exactamente cuánto te acerca cada venta al siguiente rango.</div>
                <div style={{ fontSize: 13 }}>💰 <b>Cada peso cobrado cuenta doble:</b> sube tu índice y desbloquea tus bonos. Revisa <b>Ingresos → Rehabilitaciones</b> antes de que venza cada etapa.</div>
                <div style={{ fontSize: 13 }}>🤝 ¿Dudas de cómo vas o qué sigue? Pregúntale al <b>Copiloto</b> (burbuja de abajo a la derecha) — conoce tus números al día.</div>
              </div>
            </div>
          )}

          {/* ── Leaderboard (agencia) ── */}
          {!esAsesor && d.leaderboard && (
            <>
              <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Trophy size={17} color={C.gold} /> Tabla de la promotoría ({d.total})</h3>
              <div className="crm-chart-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
                <table style={{ width: '100%' }}>
                  <thead><tr>
                    <th style={{ width: 40 }}>#</th><th>Asesor</th><th>Cuaderno</th>
                    <th style={{ textAlign: 'right' }}>Índice</th><th style={{ textAlign: 'right' }}>Prima nueva</th>
                    <th style={{ textAlign: 'right' }}>Bono Q</th><th style={{ textAlign: 'center' }}>Urgentes</th>
                  </tr></thead>
                  <tbody>
                    {d.leaderboard.map(f => {
                      const esTop = f.rank <= d.top_n;
                      return (
                        <tr key={f.clave} style={esTop ? { background: C.goldBg } : undefined}>
                          <td style={{ fontWeight: 700, color: esTop ? C.gold : C.textMuted }}>{esTop ? <Crown size={13} style={{ verticalAlign: -2 }} /> : ''} {f.rank}</td>
                          <td style={{ fontWeight: 600 }}>{f.nombre}{f.es_nuevo && <span className="midia-chip" style={{ marginLeft: 6, background: C.amberBg, color: C.amber, padding: '1px 7px', borderRadius: 20, fontSize: 10 }}>nuevo</span>}</td>
                          <td style={{ color: C.textMuted, fontSize: 12 }}>{f.cuaderno}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: indiceColor(f.indice) }}>{pct(f.indice)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(f.prima_nueva)}</td>
                          <td style={{ textAlign: 'right', color: C.textMuted }}>{fmtMoney(f.bono)}</td>
                          <td style={{ textAlign: 'center', color: f.rehab_urgentes > 0 ? C.red : C.textMuted, fontWeight: f.rehab_urgentes > 0 ? 700 : 400 }}>{f.rehab_urgentes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Onboarding: los nuevos y su brecha ── */}
              {d.nuevos.length > 0 && (
                <>
                  <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><TrendingUp size={17} color={C.green} /> Nuevos — brecha vs. el estándar</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginBottom: 24 }}>
                    {d.nuevos.map(n => (
                      <div key={n.clave} className="crm-chart-card" style={{ borderLeft: `4px solid ${C.green}` }}>
                        <div style={{ fontWeight: 700, color: C.ink }}>{n.nombre}</div>
                        <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8 }}>Mes {n.mes_agente} · {n.cuaderno}</div>
                        <div style={{ fontSize: 12.5, color: C.ink }}>Índice <b style={{ color: indiceColor(n.indice) }}>{pct(n.indice)}</b>{n.brecha_indice > 0 && <span style={{ color: C.amber }}> · faltan {pct(n.brecha_indice)}</span>}</div>
                        <div style={{ fontSize: 12.5, color: C.ink }}>Prima nueva <b>{fmtMoney(n.prima_nueva)}</b>{n.brecha_prima > 0 && <span style={{ color: C.amber }}> · faltan {fmtMoney(n.brecha_prima)}</span>}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── 🧠 Coach de ventas en grande (asesor): el Copiloto con consejos ── */}
          {esAsesor && (
            <>
              <style>{chatCSS}</style>
              <div className="crm-chart-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden', borderTop: `3px solid ${C.gold}` }}>
                <div style={{ background: `linear-gradient(135deg,${C.navy},#0A2A66)`, color: '#fff', padding: '14px 18px' }}>
                  <b style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} color={C.gold} /> Tu coach de ventas</b>
                  <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>
                    Pregúntale cómo manejar objeciones, guiones de llamada o WhatsApp, cómo pedir referidos o cerrar — con tus números reales en mente.
                  </div>
                </div>
                <ChatPanel
                  modo="coach"
                  alto={520}
                  sugerencias={SUGERENCIAS_COACH}
                  intro="¡Hola, coach al habla! 🧠 Cuéntame con qué cliente u objeción estás batallando, o pídeme un guion — te doy una técnica concreta lista para usar, pensada para tu cartera y tu siguiente bono."
                />
              </div>
            </>
          )}

          {/* ── Biblioteca + autoevaluación (siguiente iteración) ── */}
          <div className="crm-chart-card" style={{ borderStyle: 'dashed', color: C.textMuted }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}><b style={{ color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={15} /> Biblioteca de capacitación</b><div style={{ fontSize: 12.5, marginTop: 4 }}>Guiones, presentaciones, calculadoras y micro-cápsulas. Requiere cargar el contenido; se activa al definir el material inicial.</div></div>
              <div style={{ flex: '1 1 240px' }}><b style={{ color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardCheck size={15} /> Autoevaluación</b><div style={{ fontSize: 12.5, marginTop: 4 }}>El asesor se autoevalúa con prompts guiados y registra notas; se enriquece con los resúmenes de <b>Inteligencia de citas</b> (Fireflies).</div></div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
