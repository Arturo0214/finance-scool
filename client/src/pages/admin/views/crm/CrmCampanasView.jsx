/**
 * CrmCampanasView — Campañas de incentivos (p.ej. "Rumbo a la Grandeza").
 * El asesor ve su categoría, puntos y qué le falta para el siguiente destino
 * (Certificado → Puerto Vallarta → Barcelona → Japón). La agencia ve el
 * leaderboard de la promotoría. Datos calculados en vivo desde la base de FSC.
 *
 * Nota: mientras no exista el feed de prima POR PRODUCTO, los puntos usan la
 * prima 1:1 (sin ponderación 300%/200%…). El banner lo advierte.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  Plane, Trophy, RefreshCw, MapPin, CheckCircle2, AlertTriangle,
  TrendingUp, Sparkles, Crown, Info,
} from 'lucide-react';
import { getCrmCSS, fmtMoney } from './crmShared';

const MES_LABEL = { jul: 'Jul', ago: 'Ago', sep: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dic' };

export default function CrmCampanasView({ isAgency }) {
  const [campanas, setCampanas] = useState([]);
  const [slug, setSlug] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const loadAvance = useCallback(async (s) => {
    if (!s) return;
    setLoading(true); setErr('');
    try { setData(await api.crmCampanaAvance(s)); }
    catch (e) { setErr(e.message); setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.crmCampanas();
        setCampanas(r.campanas || []);
        const first = (r.campanas || []).find(c => c.activa) || (r.campanas || [])[0];
        if (first) { setSlug(first.slug); await loadAvance(first.slug); }
        else setLoading(false);
      } catch (e) { setErr(e.message); setLoading(false); }
    })();
  }, [loadAvance]);

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando campaña...</p></div></>;

  const cats = data?.campana?.categorias || [];
  const av = data?.avance;
  const lb = data?.leaderboard;

  return (
    <>
      <style>{getCrmCSS()}</style>
      <style>{`
        .camp-hero{background:linear-gradient(135deg,#0a4da2,#062a5c);color:#fff;border-radius:18px;padding:22px 24px;position:relative;overflow:hidden}
        .destino{flex:1;min-width:120px;text-align:center;padding:12px 8px;border-radius:12px;position:relative}
        .destino.done{background:rgba(255,255,255,.14)}
        .destino.next{background:rgba(255,215,0,.16);outline:2px solid #ffd24a}
        .destino .pt{font-size:20px;font-weight:800}
      `}</style>

      <div className="crm-toolbar">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Plane size={20} color={C.accent} /> Campañas</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>Tus puntos, tu categoría y el destino que estás por conquistar.</p>
        </div>
        <div className="crm-toolbar-right">
          {campanas.length > 1 && (
            <select className="crm-select" value={slug} onChange={e => { setSlug(e.target.value); loadAvance(e.target.value); }}>
              {campanas.map(c => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
            </select>
          )}
          <button className="crm-btn ghost" onClick={() => loadAvance(slug)}><RefreshCw size={15} /> Actualizar</button>
        </div>
      </div>

      {err && <div className="crm-chart-card" style={{ borderLeft: `4px solid ${C.red}`, color: C.red, display: 'flex', gap: 8 }}><AlertTriangle size={16} /> {err}</div>}
      {campanas.length === 0 && !err && <div className="crm-chart-card">No hay campañas cargadas todavía.</div>}

      {data && (
        <>
          <div className="camp-hero" style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, opacity: .8, textTransform: 'uppercase', letterSpacing: .6 }}>{data.campana.nombre}</div>
            <div style={{ fontSize: 12, opacity: .7 }}>{data.campana.inicio} → {data.campana.fin}</div>
            {av && (
              <div style={{ display: 'flex', gap: 30, marginTop: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div><span style={{ fontSize: 40, fontWeight: 800 }}>{av.puntos}</span><span style={{ fontSize: 14, opacity: .8 }}> pts</span></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: '#ffd24a' }}>{av.categoria?.nombre || 'En ruta'}</div><div style={{ fontSize: 11.5, opacity: .8 }}>{av.categoria?.premio || 'aún sin categoría'}</div></div>
                <div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtMoney(av.prima_campana)}</div><div style={{ fontSize: 11.5, opacity: .8 }}>Prima de campaña</div></div>
                {av.siguiente && <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div style={{ fontSize: 13 }}>Te faltan <b style={{ color: '#ffd24a', fontSize: 18 }}>{av.faltan_siguiente}</b> pts</div><div style={{ fontSize: 11.5, opacity: .85 }}>para {av.siguiente.nombre} · {av.siguiente.premio}</div></div>}
              </div>
            )}
          </div>

          {data.ponderacion_pendiente && (
            <div className="crm-chart-card" style={{ borderLeft: `4px solid ${C.amber}`, background: C.amberBg, display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
              <Info size={16} color={C.amber} style={{ marginTop: 2 }} />
              <div style={{ fontSize: 12.5, color: '#7C4A16' }}><b>Puntos preliminares.</b> Falta el feed de prima <b>por producto</b> para aplicar la ponderación (Riders 300%, Retiro Plus 200%…). Con eso los puntos reflejan el cálculo oficial. El mapeo plan_id→producto está en borrador, pendiente de confirmar con Flavio.</div>
            </div>
          )}

          {/* ── Ruta de destinos (categorías) ── */}
          {av && cats.length > 0 && (
            <div className="crm-chart-card" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> La ruta</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cats.map(c => {
                  const done = av.puntos >= c.puntos_min;
                  const next = !done && av.siguiente?.nombre === c.nombre;
                  return (
                    <div key={c.nombre} className={`destino${done ? ' done' : ''}${next ? ' next' : ''}`} style={{ border: `1px solid ${C.line}` }}>
                      {done ? <CheckCircle2 size={16} color={C.green} /> : next ? <Plane size={16} color={C.amber} /> : <MapPin size={16} color={C.line} />}
                      <div className="pt" style={{ color: done ? C.green : C.ink }}>{c.puntos_min}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>{c.nombre}</div>
                      <div style={{ fontSize: 10.5, color: C.textMuted }}>{c.premio}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Mes a mes (asesor) ── */}
          {av && (
            <div className="crm-chart-card" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 10 }}>Mes a mes · {av.meses_meta} mes(es) con meta {av.extras > 0 && <span style={{ color: C.green }}>· +{av.extras} pts por constancia</span>}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {av.por_mes.map(m => (
                  <div key={m.mes} style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: m.con_data ? (m.puntos > 0 ? C.greenBg : '#F1F5F9') : '#FafBfC', border: `1px solid ${C.line}`, opacity: m.con_data ? 1 : .5 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>{MES_LABEL[m.mes]}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: m.puntos > 0 ? C.green : C.ink }}>{m.puntos} pt</div>
                    <div style={{ fontSize: 10.5, color: C.textMuted }}>{m.con_data ? fmtMoney(m.prima) : '—'}</div>
                  </div>
                ))}
              </div>
              {av.requisitos?.conservacion && (
                <div style={{ marginTop: 12, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, color: av.requisitos.conservacion.ok ? C.green : C.red }}>
                  {av.requisitos.conservacion.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  Requisito de conservación ≥{Math.round(av.requisitos.conservacion.min * 100)}%: tu índice va en {(av.requisitos.conservacion.valor * 100).toFixed(1)}% {av.requisitos.conservacion.ok ? '· cumples' : '· aún no cumples'}
                </div>
              )}
            </div>
          )}

          {/* ── Leaderboard (agencia) ── */}
          {lb && (
            <>
              <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Trophy size={17} color={C.gold} /> Leaderboard de la campaña ({lb.length})</h3>
              <div className="crm-chart-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%' }}>
                  <thead><tr><th style={{ width: 40 }}>#</th><th>Asesor</th><th style={{ textAlign: 'right' }}>Puntos</th><th>Categoría</th><th style={{ textAlign: 'right' }}>Prima campaña</th><th style={{ textAlign: 'center' }}>Meses meta</th></tr></thead>
                  <tbody>
                    {lb.map((f, i) => (
                      <tr key={f.clave} style={i < 3 ? { background: C.goldBg } : undefined}>
                        <td style={{ fontWeight: 700, color: i < 3 ? C.gold : C.textMuted }}>{i < 3 ? <Crown size={13} style={{ verticalAlign: -2 }} /> : ''} {i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{f.nombre}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: C.ink }}>{f.puntos}</td>
                        <td style={{ color: f.categoria ? C.green : C.textMuted, fontSize: 12.5 }}>{f.categoria?.nombre || 'en ruta'}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMoney(f.prima_campana)}</td>
                        <td style={{ textAlign: 'center', color: C.textMuted }}>{f.meses_meta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
