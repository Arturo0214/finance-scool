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
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  RefreshCw, Sparkles, RotateCcw, HandCoins, ShieldCheck, TrendingUp,
  Flame, AlertTriangle, Target, ArrowRight, Trophy, GripVertical,
  KanbanSquare, CalendarClock, MessageCircle, PhoneMissed, X,
} from 'lucide-react';
import { getCrmCSS, fmtMoney, etapaInfo, fmtDate } from './crmShared';
import { BonoRaceTrack, PromotoriaRace, raceCSS } from './CrmRaceTrack';

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

/* Arma el shape de "próximos pasos" a partir del tablero de la promotoría:
   misma estructura que /ingresos/proximos-pasos pero agregando TODA la cartera
   (cada paso trae el asesor dueño). El umbral de la promotoría es 84%. */
function buildPromoData(promo, overviewAgentes) {
  const p4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const acc = promo.accionables || {};
  const rehabilitables = acc.rehabilitables || [];
  const pendientes = acc.pendientesPago || [];

  const pasos = [];
  for (const p of rehabilitables) {
    const pesoUrg = p.urgencia === 'EXTREMA' ? 1000 : p.urgencia === 'ALTA' ? 700 : p.urgencia === 'MEDIA' ? 400 : 150;
    pasos.push({
      tipo: 'rehabilitar', urgencia: p.urgencia,
      prioridad: Math.round(pesoUrg - (p.dias_para_vencer_etapa || 0) + (p.impacto_indice || 0) * 200),
      titulo: `Rehabilita la póliza ${p.poliza}${p.plan_id ? ' · ' + p.plan_id : ''}`,
      detalle: `${p.agente || p.clave || ''}${p.dias_para_vencer_etapa != null ? ` · quedan ${p.dias_para_vencer_etapa}d para vencer la etapa` : ''}`,
      agente: p.agente, clave: p.clave,
      monto: p.monto, impacto_indice: p4(p.impacto_indice),
      cta: {}, // sin simulador en modo promotoría: elige un asesor para simular
    });
  }
  for (const p of pendientes) {
    pasos.push({
      tipo: 'cobrar', urgencia: 'MEDIA',
      prioridad: Math.round(500 + (p.impacto_indice || 0) * 200),
      titulo: `Cobra la póliza ${p.poliza}${p.plan_id ? ' · ' + p.plan_id : ''}`,
      detalle: `${p.agente || p.clave || ''} · vigente con pago pendiente · al cobrar sube el índice`,
      agente: p.agente, clave: p.clave,
      monto: p.monto, impacto_indice: p4(p.impacto_indice),
      cta: {},
    });
  }
  pasos.sort((a, b) => b.prioridad - a.prioridad);

  const rr = promo.rehabResumen || { total: 0, monto: 0, por_urgencia: {} };
  const bono = (overviewAgentes || []).reduce((s, a) => s + (a.bonos?.total_trimestre || 0), 0);
  return {
    promotoria: true,
    numAgentes: promo.agentes,
    indice: {
      cobrado: p4(promo.indice.hoy.actual),
      realista: p4(promo.indice.hoy.conPendiente),
      techo: p4(promo.indice.siCobraYRehabilitaTodo),
      minimoBono: promo.umbral || 0.84,
    },
    bono_trimestre: r2(bono),
    resumen: {
      rehabilitables: rr.total, monto_rehab: r2(rr.monto),
      urgentes: (rr.por_urgencia?.EXTREMA || 0) + (rr.por_urgencia?.ALTA || 0),
      pendientes: pendientes.length,
      monto_pendiente: r2(pendientes.reduce((s, x) => s + (x.monto || 0), 0)),
    },
    pasos: pasos.slice(0, 60),
  };
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

  // Proyección comercial: carrera a bonos, escenarios y faltantes (motor PIR)
  const [proye, setProye] = useState(null);

  // Tareas de hoy: reporte del día, recordatorios vencidos/para hoy
  const [tareas, setTareas] = useState(null);
  // clave → clasificación (activo / inactivo c-s producción) para agrupar el selector
  const [clasifMap, setClasifMap] = useState(null);
  const [modalTarea, setModalTarea] = useState(null); // 'reporte'|'recordatorios'|'prospeccion'|'cobranza'
  const navigate = useNavigate();

  /* Agencia/admin sin clave = tablero de TODA la promotoría; con clave (o rol
     asesor) = el día de ese asesor. El asesor nunca ve a los demás. */
  const loadPasos = useCallback(async (cv) => {
    setLoading(true); setErr(''); setProye(null);
    try {
      if (isAgency && !cv) {
        const [promo, ov] = await Promise.all([api.crmIngresosPromotoria(), api.crmIngresosOverview()]);
        setAgentes((ov.agentes || []).filter(a => a.clave));
        setData(buildPromoData(promo, ov.agentes));
        setPicked({}); setSimResult(null); setClave('');
      } else {
        const d = await api.crmIngresosProximosPasos(cv || '');
        setData(d); setPicked({}); setSimResult(null);
        if (d?.clave) setClave(d.clave);
      }
      api.crmIngresosProyeccion(cv || '').then(setProye).catch(() => setProye(null));
    } catch (e) { setErr(e.message || 'No se pudo cargar'); setData(null); }
    finally { setLoading(false); }
  }, [isAgency]);

  // Agencia: arranca con la promotoría completa; asesor: su propia clave
  useEffect(() => {
    loadPasos('');
    // Pipeline accionable (independiente del índice; asesor=suyo, agencia=promotoría)
    api.crmPipelineAcciones().then(setPipe).catch(() => setPipe(null));
    if (isAgency) {
      api.crmGetAgents()
        .then(r => setClasifMap(new Map((r.agents || []).filter(a => a.clave).map(a => [a.clave, a.clasificacion || 'activo']))))
        .catch(() => setClasifMap(null));
    }
    // Tareas de hoy: carga del reporte + recordatorios pendientes al día
    (async () => {
      try {
        /* fechas en horario LOCAL (en-CA = YYYY-MM-DD): comparar en UTC marcaba
           "pendiente" por las noches aunque el reporte ya estuviera cargado */
        const dLocal = (x) => new Date(x).toLocaleDateString('en-CA');
        const hoyIso = dLocal(new Date());
        const [li, rem] = await Promise.all([
          api.crmLastImport().catch(() => null),
          api.crmGetReminders({ to: hoyIso }).catch(() => ({ reminders: [] })),
        ]);
        const pend = (rem.reminders || []).filter(r => !['completado', 'cancelado', 'hecho'].includes(String(r.estatus || r.estado || '').toLowerCase()));
        setTareas({
          ultima: li?.ultima || null,
          cargadoHoy: !!(li?.ultima && dLocal(li.ultima.created_at) === hoyIso),
          vencidos: pend.filter(r => String(r.fecha).slice(0, 10) < hoyIso),
          paraHoy: pend.filter(r => String(r.fecha).slice(0, 10) === hoyIso),
        });
      } catch { setTareas(null); }
    })();
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
        .esc-chip{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:11px;padding:8px 12px;font-size:11.5px;flex:1;min-width:150px}
        .esc-chip b{display:block;font-size:15px;color:#7CE7B1}
        ${raceCSS}
      `}</style>

      {/* ── Toolbar ── */}
      <div className="crm-toolbar">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color={C.gold} /> {data?.promotoria ? 'El Día de la Promotoría' : 'Mi Día'}
          </h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>
            {data?.promotoria
              ? `Los próximos pasos de los ${data.numAgentes} asesores para subir índice, bonos y conservación.`
              : 'Tus próximos pasos para subir índice, bonos y conservación.'}
          </p>
        </div>
        <div className="crm-toolbar-right">
          {isAgency && agentes.length > 0 && (() => {
            const cl = (a) => (clasifMap?.get(a.clave)) || 'activo';
            const activos = agentes.filter(a => cl(a) === 'activo');
            const inactivos = agentes.filter(a => cl(a) !== 'activo' && cl(a) !== 'administrativo');
            return (
              <select className="crm-select" value={clave} onChange={e => loadPasos(e.target.value)}>
                <option value="">🏢 Toda la promotoría</option>
                <optgroup label="Activos">
                  {activos.map(a => <option key={a.clave} value={a.clave}>{a.nombre} · {a.clave}</option>)}
                </optgroup>
                {inactivos.length > 0 && (
                  <optgroup label="Inactivos (con/sin producción)">
                    {inactivos.map(a => <option key={a.clave} value={a.clave}>{a.nombre} · {a.clave}</option>)}
                  </optgroup>
                )}
              </select>
            );
          })()}
          <button className="crm-btn ghost" onClick={() => loadPasos(clave)} title="Actualizar"><RefreshCw size={15} /> Actualizar</button>
        </div>
      </div>

      {err && <div className="crm-chart-card" style={{ borderLeft: `4px solid ${C.red}`, color: C.red }}><AlertTriangle size={16} /> {err}</div>}

      {data && (
        <>
          {/* ── ✅ Tareas de hoy: lo que hay que HACER antes de ver números ── */}
          {tareas && (
            <div className="crm-chart-card" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
                <CalendarClock size={17} color={C.accent} /> Tareas de hoy{data.promotoria ? ' — promotoría' : ''}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                {isAgency && (
                  <div style={{ borderLeft: `4px solid ${tareas.cargadoHoy ? C.green : C.amber}`, background: tareas.cargadoHoy ? C.greenBg : C.amberBg, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                    onClick={() => setModalTarea('reporte')} title="Ver detalle">
                    <div style={{ fontSize: 11, color: C.textMuted }}>📄 Reporte de pólizas</div>
                    <b style={{ fontSize: 13.5, color: tareas.cargadoHoy ? C.green : '#B45309' }}>
                      {tareas.cargadoHoy
                        ? `Cargado hoy ${new Date(tareas.ultima.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} ✓`
                        : 'Pendiente: sube el reporte del día'}
                    </b>
                    {!tareas.cargadoHoy && tareas.ultima && <div style={{ fontSize: 10.5, color: C.textMuted }}>último: {fmtDate(tareas.ultima.created_at)}</div>}
                  </div>
                )}
                <div style={{ borderLeft: `4px solid ${tareas.vencidos.length ? C.red : C.green}`, background: tareas.vencidos.length ? C.redBg : C.greenBg, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => setModalTarea('recordatorios')} title="Ver detalle">
                  <div style={{ fontSize: 11, color: C.textMuted }}>🔔 Recordatorios</div>
                  <b style={{ fontSize: 13.5, color: tareas.vencidos.length ? C.red : C.green }}>
                    {tareas.vencidos.length} vencidos · {tareas.paraHoy.length} para hoy
                  </b>
                  {(tareas.vencidos[0] || tareas.paraHoy[0]) && (
                    <div style={{ fontSize: 10.5, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(tareas.vencidos[0] || tareas.paraHoy[0]).titulo}{(tareas.vencidos[0] || tareas.paraHoy[0]).crm_clients?.nombre ? ` · ${(tareas.vencidos[0] || tareas.paraHoy[0]).crm_clients.nombre}` : ''}
                    </div>
                  )}
                </div>
                {pipe && (
                  <div style={{ borderLeft: `4px solid ${pipe.resumen.sin_accion + pipe.resumen.vencidas ? C.amber : C.green}`, background: pipe.resumen.sin_accion + pipe.resumen.vencidas ? C.amberBg : C.greenBg, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                    onClick={() => setModalTarea('prospeccion')} title="Ver detalle">
                    <div style={{ fontSize: 11, color: C.textMuted }}>📞 Prospección</div>
                    <b style={{ fontSize: 13.5, color: '#B45309' }}>{pipe.resumen.sin_accion} sin próxima acción · {pipe.resumen.vencidas} vencidas</b>
                    <div style={{ fontSize: 10.5, color: C.textMuted }}>{pipe.resumen.hoy} citas/acciones para hoy</div>
                  </div>
                )}
                <div style={{ borderLeft: `4px solid ${data.resumen.urgentes ? C.red : '#0891B2'}`, background: data.resumen.urgentes ? C.redBg : '#E6F6F9', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => setModalTarea('cobranza')} title="Ver detalle">
                  <div style={{ fontSize: 11, color: C.textMuted }}>💰 Cobranza y rescates</div>
                  <b style={{ fontSize: 13.5, color: data.resumen.urgentes ? C.red : '#0891B2' }}>
                    {data.resumen.pendientes} por cobrar · {data.resumen.urgentes} rehab. urgentes
                  </b>
                  <div style={{ fontSize: 10.5, color: C.textMuted }}>{fmtMoney(data.resumen.monto_pendiente)} por cobrar · {fmtMoney(data.resumen.monto_rehab)} rescatable</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Hero: índice + bono (misma construcción que Tableros: HOY manda) ── */}
          <div className="midia-hero" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontSize: 12, opacity: .75, textTransform: 'uppercase', letterSpacing: .6 }}>Índice de conservación · hoy</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: indiceColor(data.indice.cobrado) }}>{pctTxt(data.indice.cobrado, 1)}</span>
                  <span style={{ fontSize: 13, opacity: .8 }}>cobrado hoy</span>
                </div>
                <IndiceBar cobrado={data.indice.cobrado} realista={data.indice.realista} techo={data.indice.techo} />
                <div style={{ display: 'flex', gap: 16, fontSize: 11.5, opacity: .9, flexWrap: 'wrap' }}>
                  <span>Realista (si cobras pendientes) <b>{pctTxt(data.indice.realista, 1)}</b></span>
                  <span>Techo (cobrando y rehabilitando todo) <b>{pctTxt(data.indice.techo, 1)}</b></span>
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

          {/* ── 🏁 Carrera a tus bonos: el CRM que predice (proyección PIR viva) ── */}
          {proye && !data.promotoria && proye.trimestral && (
            <div className="race-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <b style={{ fontSize: 14.5 }}>🏁 Carrera a tus bonos — {proye.periodo?.trimestre}Q{proye.periodo?.anio}</b>
                <span style={{ fontSize: 11.5, opacity: .85 }}>
                  Prima promedio {proye.prima_promedio_es_promotoria ? 'de la promotoría (aún sin cartera propia)' : 'de tu cartera'}: <b>{fmtMoney(proye.prima_promedio)}</b>{proye.polizas_en_cartera > 0 ? <> · {proye.polizas_en_cartera} pólizas</> : null}
                  {proye.corte_primas && <> · bonos con corte oficial BR a <b>{proye.corte_primas}</b></>}
                </span>
              </div>
              {proye.indice.bloqueado && (
                <div style={{ background: 'rgba(248,113,113,.16)', border: '1px solid rgba(248,113,113,.4)', borderRadius: 10, padding: '7px 12px', fontSize: 12, marginBottom: 8 }}>
                  🚧 Tu índice ({(proye.indice.operativo * 100).toFixed(1)}%) está bajo el 86%: los bonos están bloqueados aunque llegues al rango. Primero cobra y rehabilita.
                </div>
              )}
              <BonoRaceTrack
                titulo="Bono trimestral · venta nueva"
                progreso={proye.venta.ubicacionQ}
                rangos={proye.trimestral.rangos}
                bloqueado={proye.indice.bloqueado}
                llevasTxt={<span title="El rango del bono se define por la prima de UBICACIÓN (anualizada); el bono se paga sobre la prima PAGADA del trimestre.">
                  Ubicación <b>{fmtMoney(proye.venta.ubicacionQ)}</b> (define tu rango) · pagada del Q <b>{fmtMoney(proye.venta.pagadaInicialQ)}</b>
                </span>}
                faltanteTxt={proye.trimestral.siguiente
                  ? <>Te faltan <b>{fmtMoney(proye.trimestral.siguiente.faltante)}</b>{proye.trimestral.siguiente.polizas_equivalentes ? <> ≈ <b>{proye.trimestral.siguiente.polizas_equivalentes} pólizas</b></> : null} para R{proye.trimestral.siguiente.rango} → bono {fmtMoney(proye.trimestral.siguiente.bono_al_llegar)}</>
                  : <>🏆 Rango máximo alcanzado</>}
              />
              <BonoRaceTrack
                titulo="Bono de renovación · conservación"
                emoji="🚙"
                progreso={proye.venta.ubicacionQ}
                rangos={proye.conservacion.rangos}
                bloqueado={proye.indice.bloqueado}
                llevasTxt={<span title="El rango se define por la prima de UBICACIÓN; este bono se paga sobre la prima de RENOVACIÓN pagada del trimestre.">
                  Ubicación <b>{fmtMoney(proye.venta.ubicacionQ)}</b> · renovación pagada del Q <b>{fmtMoney(proye.venta.renovacionQ)}</b>
                </span>}
                faltanteTxt={proye.conservacion.siguiente
                  ? <>Te faltan <b>{fmtMoney(proye.conservacion.siguiente.faltante)}</b> de ubicación → bono renovación {fmtMoney(proye.conservacion.siguiente.bono_al_llegar)}</>
                  : <>🏆 Rango máximo alcanzado</>}
              />
              {proye.meta_mes?.meta > 0 && (
                <div style={{ margin: '10px 0 4px', fontSize: 11.5 }}>
                  Meta del mes: <b>{fmtMoney(proye.meta_mes.vendido)}</b> de {fmtMoney(proye.meta_mes.meta)} ({Math.round((proye.meta_mes.pct || 0) * 100)}%)
                  {proye.meta_mes.faltante > 0 && <> · te faltan <b>{fmtMoney(proye.meta_mes.faltante)}</b></>}
                  <div style={{ height: 7, background: 'rgba(255,255,255,.1)', borderRadius: 4, marginTop: 4 }}>
                    <div style={{ height: 7, width: `${Math.min(100, (proye.meta_mes.pct || 0) * 100)}%`, borderRadius: 4, background: 'linear-gradient(90deg,#C1975B,#E8CFA6)', transition: 'width .8s' }} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {(proye.escenarios || []).map(e => (
                  <div key={e.venta_extra} className="esc-chip" title={`Cada peso vendido te regresa ~${(e.comision_marginal * 100).toFixed(1)}% en bonos del trimestre`}>
                    Si vendes <b style={{ display: 'inline', color: '#fff' }}>+{fmtMoney(e.venta_extra)}</b> este Q
                    <b>bono {fmtMoney(e.bono_trimestre)} {e.delta_bono > 0 ? `(+${fmtMoney(e.delta_bono)})` : ''}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
          {proye?.carrera && data.promotoria && (
            <div className="race-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <b style={{ fontSize: 14.5 }}>🏁 Carrera de la promotoría — venta nueva del trimestre</b>
                <span style={{ fontSize: 11.5, opacity: .85 }}>
                  Posición vs. el líder · 🚧 = índice bajo 86% (bonos bloqueados)
                  {proye.corte_primas && <> · venta y bonos con corte oficial BR a <b>{proye.corte_primas}</b></>}
                </span>
              </div>
              <PromotoriaRace carrera={proye.carrera} max={12} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: data.promotoria ? 'minmax(0,1fr)' : 'minmax(0,1.15fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
            {/* ── Próximos pasos ── */}
            <div>
              <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Target size={17} color={C.accent} /> Próximos pasos{data.promotoria ? ' de la promotoría' : ''}</h3>
              {data.promotoria && data.pasos.length > 0 && (
                <p className="sub" style={{ margin: '-6px 0 12px' }}>Cada paso indica a qué asesor pertenece. Para usar el simulador de índice, elige un asesor en el selector de arriba.</p>
              )}
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
                          {data.promotoria && p.agente && <span className="midia-chip" style={{ background: '#EEF1F6', color: C.textMuted }}>{p.agente}</span>}
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

            {/* ── Simulador de arrastre (por asesor; en promotoría se elige uno) ── */}
            {!data.promotoria && (
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
            )}
          </div>

          {/* ── Modal de detalle de la tarea: el dato completo SIN salir de Mi Día ── */}
          {modalTarea && (() => {
            const CFG = {
              reporte: { titulo: '📄 Reporte de pólizas del día', destino: '/admin/crm', destinoLabel: 'Ir a Tableros a cargar' },
              recordatorios: { titulo: '🔔 Recordatorios pendientes', destino: '/admin/crm-recordatorios', destinoLabel: 'Abrir Recordatorios' },
              prospeccion: { titulo: '📞 Prospección — próxima acción obligatoria', destino: '/admin/crm-pipeline', destinoLabel: 'Abrir Pipeline' },
              cobranza: { titulo: '💰 Cobranza y rescates', destino: '/admin/crm-ingresos', destinoLabel: 'Abrir Ingresos (simulador y detalle)' },
            }[modalTarea];
            const fila = (key, left, mid, right) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(11,27,51,.06)', fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: C.ink }}>{left}</span>
                {mid && <span style={{ fontSize: 11.5, color: C.textMuted, flexShrink: 0 }}>{mid}</span>}
                {right}
              </div>
            );
            const wa = (tel) => {
              const t = String(tel || '').replace(/\D/g, '');
              return t ? <a className="crm-icon-btn wa" href={`https://wa.me/${t}`} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={13} /></a> : null;
            };
            return (
              <div className="modal-overlay" onClick={() => setModalTarea(null)}>
                <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
                  <div className="modal-head">
                    <h2 style={{ fontSize: 17 }}>{CFG.titulo}{data.promotoria ? ' — promotoría' : ''}</h2>
                    <button className="close-btn" onClick={() => setModalTarea(null)}><X size={20} /></button>
                  </div>
                  <div className="modal-body" style={{ overflowY: 'auto' }}>
                    {modalTarea === 'reporte' && tareas && (
                      <>
                        {tareas.cargadoHoy
                          ? <div className="info-box" style={{ background: C.greenBg }}><p>✓ El reporte de hoy ya está cargado ({new Date(tareas.ultima.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{tareas.ultima.usuario ? ` por ${tareas.ultima.usuario}` : ''}). Todas las secciones reflejan este corte.</p></div>
                          : <div className="info-box" style={{ background: C.amberBg }}><p>⚠ Aún no se carga el Reporte de pólizas de hoy. Súbelo en Tableros para que índice, cartera y rehabilitaciones estén al día.</p></div>}
                        {tareas.ultima?.resumen && (
                          <p style={{ fontSize: 12.5, color: C.textMuted }}>
                            Última carga: {tareas.ultima.archivo || 's/n'} · {tareas.ultima.resumen.filas} filas · {tareas.ultima.resumen.insertadas} nuevas · {tareas.ultima.resumen.actualizadas} actualizadas · {tareas.ultima.resumen.canceladas} canceladas · {tareas.ultima.resumen.revividas} revividas
                          </p>
                        )}
                      </>
                    )}
                    {modalTarea === 'recordatorios' && tareas && (
                      <>
                        {tareas.paraHoy.length > 0 && <h3 style={{ fontSize: 13.5, margin: '0 0 6px' }}>Para hoy ({tareas.paraHoy.length})</h3>}
                        {tareas.paraHoy.slice(0, 25).map(r => fila(`h${r.id}`, `${r.titulo}${r.crm_clients?.nombre ? ' · ' + r.crm_clients.nombre : ''}`, `${r.tipo || ''}${r.crm_agents?.nombre ? ' · ' + r.crm_agents.nombre : ''}`, wa(r.crm_clients?.telefono)))}
                        <h3 style={{ fontSize: 13.5, margin: '14px 0 6px', color: C.red }}>Vencidos ({tareas.vencidos.length})</h3>
                        {tareas.vencidos.slice(0, 40).map(r => fila(`v${r.id}`, `${r.titulo}${r.crm_clients?.nombre ? ' · ' + r.crm_clients.nombre : ''}`, `${fmtDate(r.fecha)}${r.crm_agents?.nombre ? ' · ' + r.crm_agents.nombre : ''}`, wa(r.crm_clients?.telefono)))}
                        {tareas.vencidos.length > 40 && <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>…y {tareas.vencidos.length - 40} vencidos más — ábrelos en Recordatorios para depurarlos.</p>}
                      </>
                    )}
                    {modalTarea === 'prospeccion' && pipe && (
                      <>
                        <h3 style={{ fontSize: 13.5, margin: '0 0 6px', color: C.red }}>Sin próxima acción ({pipe.grupos.sin_accion.length}) — agéndales algo</h3>
                        {pipe.grupos.sin_accion.slice(0, 25).map(c => fila(`s${c.id}`, c.nombre, `${etapaInfo(c.etapa).label}${c.agente ? ' · ' + c.agente : ''}`, wa(c.telefono)))}
                        <h3 style={{ fontSize: 13.5, margin: '14px 0 6px', color: C.amber }}>Acciones vencidas ({pipe.grupos.vencidas.length}) — reprograma o ejecuta</h3>
                        {pipe.grupos.vencidas.slice(0, 25).map(c => fila(`p${c.id}`, c.nombre, `${c.accion ? `${c.accion.titulo} · ${fmtDate(c.accion.fecha)}` : ''}${c.agente ? ' · ' + c.agente : ''}`, wa(c.telefono)))}
                      </>
                    )}
                    {modalTarea === 'cobranza' && (
                      <>
                        <h3 style={{ fontSize: 13.5, margin: '0 0 6px', color: '#0891B2' }}>Por cobrar ({data.resumen.pendientes} · {fmtMoney(data.resumen.monto_pendiente)})</h3>
                        {data.pasos.filter(p => p.tipo === 'cobrar').slice(0, 25).map((p, i) => fila(`c${i}`, p.titulo, `${data.promotoria && p.agente ? p.agente + ' · ' : ''}${fmtMoney(p.monto)}`, <span style={{ color: C.green, fontWeight: 700, fontSize: 11.5 }}>+{((p.impacto_indice || 0) * 100).toFixed(2)}% índice</span>))}
                        <h3 style={{ fontSize: 13.5, margin: '14px 0 6px', color: C.amber }}>Rehabilitables ({data.resumen.rehabilitables} · {fmtMoney(data.resumen.monto_rehab)}) — {data.resumen.urgentes} urgentes</h3>
                        {data.pasos.filter(p => p.tipo === 'rehabilitar').slice(0, 25).map((p, i) => fila(`r${i}`, p.titulo, `${data.promotoria && p.agente ? p.agente + ' · ' : ''}${p.urgencia || ''} · ${fmtMoney(p.monto)}`, <span style={{ color: C.green, fontWeight: 700, fontSize: 11.5 }}>+{((p.impacto_indice || 0) * 100).toFixed(2)}% índice</span>))}
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid rgba(11,27,51,.08)' }}>
                    <button className="btn-secondary" onClick={() => setModalTarea(null)}>Cerrar</button>
                    <button className="btn-primary" onClick={() => { setModalTarea(null); navigate(CFG.destino); }}>{CFG.destinoLabel}</button>
                  </div>
                </div>
              </div>
            );
          })()}

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
