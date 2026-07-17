/**
 * CrmQuoteView — Cotizador PPR "La carta de tu futuro"
 * Calculadora Art. 151 LISR + proyección de retiro presentada como una
 * pieza de banca privada: hero cinematográfico, número con conteo
 * animado, hitos del viaje y gráfica luminosa. Imprimible a PDF.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calculator, Printer, Save, Sunrise, Gem, Crown, Coins, Landmark, TrendingUp, Hourglass } from 'lucide-react';
import Logo from '../../../../components/Logo';
import { getCrmCSS } from './crmShared';

const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

/* Conteo animado con easing — el número "crece" hacia su destino */
function useCountUp(value, dur = 900) {
  const [v, setV] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current, to = value;
    prev.current = value;
    if (from === to) return;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return v;
}

const QUOTE_CSS = `
  @keyframes twinkle { 0%,100% { opacity:.15; transform:translateY(0) scale(1); } 50% { opacity:.9; transform:translateY(-14px) scale(1.25); } }
  @keyframes shineSweep { 0% { transform:translateX(-120%) skewX(-18deg); } 100% { transform:translateX(280%) skewX(-18deg); } }
  @keyframes pulseHalo { 0%,100% { box-shadow:0 0 0 0 rgba(232,207,166,.5); } 50% { box-shadow:0 0 0 14px rgba(232,207,166,0); } }
  @keyframes riseSoft { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes goldFlow { 0% { background-position:0% 50%; } 100% { background-position:200% 50%; } }

  .qp-canvas {
    position:relative; border-radius:20px; overflow:hidden; color:#fff;
    background:
      radial-gradient(700px 340px at 88% -12%, rgba(0,136,224,.28), transparent 60%),
      radial-gradient(520px 420px at -8% 108%, rgba(193,151,91,.16), transparent 55%),
      linear-gradient(163deg, #030F28 0%, #051C47 52%, #062254 100%);
    box-shadow:0 30px 60px -25px rgba(3,15,40,.6), inset 0 1px 0 rgba(255,255,255,.07);
    border:1px solid rgba(232,207,166,.18);
  }
  .qp-star { position:absolute; border-radius:50%; background:#E8CFA6; pointer-events:none; animation:twinkle 5s ease-in-out infinite; }
  .qp-eyebrow { font-size:10.5px; letter-spacing:4.5px; text-transform:uppercase; color:#E8CFA6; font-weight:700; }
  .qp-hero-number {
    font-family:'Fraunces',Georgia,serif; font-weight:600; letter-spacing:-1.5px; line-height:1;
    font-size:clamp(44px, 6vw, 68px);
    background:linear-gradient(90deg,#F6E6C8,#E8CFA6 30%,#fff 50%,#E8CFA6 70%,#F6E6C8); background-size:200% auto;
    -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
    animation:goldFlow 6s linear infinite;
    font-variant-numeric:tabular-nums;
  }
  .qp-gem {
    position:relative; overflow:hidden; border:1px solid rgba(255,255,255,.12);
    border-radius:14px; padding:14px 16px; backdrop-filter:blur(6px); animation:riseSoft .6s ease backwards;
    border-top:2.5px solid var(--gc, #E8CFA6);
    background:radial-gradient(160px 90px at 18% -10%, var(--gtint, rgba(232,207,166,.16)), transparent 70%), rgba(255,255,255,.055);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .qp-gem:hover { transform:translateY(-3px); box-shadow:0 16px 30px -16px var(--gtint, rgba(232,207,166,.4)); }
  .qp-gem::after { content:''; position:absolute; top:0; bottom:0; width:38%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.09),transparent); transform:translateX(-120%) skewX(-18deg); }
  .qp-gem:hover::after { animation:shineSweep .9s ease; }
  .qp-gem .g-head { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
  .qp-gem .g-ico { width:24px; height:24px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:var(--gtint, rgba(232,207,166,.16)); color:var(--gc, #E8CFA6); flex-shrink:0; }
  .qp-gem .g-label { font-size:9.5px; text-transform:uppercase; letter-spacing:1.8px; color:var(--gc, rgba(232,207,166,.85)); font-weight:700; }
  .qp-gem .g-value { font-family:'Fraunces',Georgia,serif; font-size:23px; font-weight:600; color:#fff; letter-spacing:-.4px; font-variant-numeric:tabular-nums; text-shadow:0 0 24px var(--gtint, transparent); }
  .qp-gem .g-value .hl { color:var(--gc); }
  .qp-gem .g-sub { font-size:11px; color:rgba(255,255,255,.55); margin-top:3px; line-height:1.45; }
  .qp-gem .g-sub b { color:var(--gc); font-weight:700; }

  .qp-milestone { display:flex; align-items:flex-start; gap:12px; animation:riseSoft .6s ease backwards; }
  .qp-mile-dot { width:34px; height:34px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
    background:linear-gradient(140deg, rgba(232,207,166,.3), rgba(232,207,166,.08)); border:1px solid rgba(232,207,166,.5); color:#E8CFA6; }
  .qp-mile-dot.final { animation:pulseHalo 2.6s ease-in-out infinite; background:linear-gradient(140deg,#E8CFA6,#C1975B); color:#051636; }

  .qp-wait {
    border-radius:14px; padding:16px 18px; border:1px solid rgba(255,120,90,.35);
    background:linear-gradient(120deg, rgba(180,45,45,.28), rgba(120,25,25,.14)); animation:riseSoft .7s ease backwards;
  }
  .qp-divider { height:1px; background:linear-gradient(90deg, transparent, rgba(232,207,166,.5), transparent); margin:20px 0; border:none; }

  @media print {
    @page { size:letter; margin:0; }
    body * { visibility:hidden; }
    #ppr-proposal, #ppr-proposal * { visibility:visible; }
    #ppr-proposal { position:absolute; left:0; top:0; width:100%; border-radius:0 !important; border:none !important; box-shadow:none !important; background:none !important; }
    #ppr-proposal .qp-star { display:none; }
    /* Dos páginas completas, cada una con su lienzo navy a sangre */
    .qp-page {
      height:100vh; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-evenly;
      padding:1.5cm 1.7cm !important; position:relative;
      background:
        radial-gradient(700px 340px at 88% -12%, rgba(0,136,224,.28), transparent 60%),
        radial-gradient(520px 420px at -8% 108%, rgba(193,151,91,.16), transparent 55%),
        linear-gradient(163deg, #030F28 0%, #051C47 52%, #062254 100%) !important;
      -webkit-print-color-adjust:exact; print-color-adjust:exact;
    }
    .qp-page1 { break-after:page; page-break-after:always; }
    .qp-page .qp-divider { margin:10px 0; }
    .qp-hero-number { font-size:64px !important; -webkit-text-fill-color:#EBD3A8 !important; background:none !important; animation:none !important; }
    #ppr-proposal * { animation:none !important; }
    #ppr-proposal .qp-star { display:none !important; }
    /* la regla visibility:visible forzaba a mostrarse el tooltip vacío de recharts */
    #ppr-proposal .recharts-tooltip-wrapper { display:none !important; }
    .qp-mile-dot.final { box-shadow:none !important; }
    .qp-screen-chart { display:none !important; }
    .qp-print-chart { display:block !important; }
  }
  .qp-print-chart { display:none; }
  @media(max-width:900px){ .ppr-grid { grid-template-columns:1fr !important; } }
`;

/* La gráfica "El ascenso" — con dims fijas para impresión o fluida en pantalla */
function ascensoChart(serie, dims) {
  return (
    <ComposedChart data={serie} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} {...(dims || {})}>
      <defs>
        <linearGradient id={dims ? 'qpSaldoP' : 'qpSaldo'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5AA9FF" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#5AA9FF" stopOpacity={0.03} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" vertical={false} />
      <XAxis dataKey="edad" tick={{ fontSize: 10.5, fill: 'rgba(255,255,255,.55)' }} axisLine={false} tickLine={false} />
      <YAxis tickFormatter={v => '$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : Math.round(v / 1000) + 'k')} tick={{ fontSize: 10.5, fill: 'rgba(255,255,255,.55)' }} axisLine={false} tickLine={false} width={54} />
      <Tooltip
        formatter={(v, n) => [fmt(v), n]} labelFormatter={v => `A los ${v} años`}
        contentStyle={{ background: '#0A1E44', border: '1px solid rgba(232,207,166,.35)', borderRadius: 10, fontSize: 12.5, color: '#fff' }}
        labelStyle={{ color: '#E8CFA6', fontWeight: 700 }} itemStyle={{ color: '#fff' }}
      />
      <Area type="monotone" dataKey="Saldo proyectado" stroke="#5AA9FF" strokeWidth={2.5} fill={dims ? 'url(#qpSaldoP)' : 'url(#qpSaldo)'} dot={false} activeDot={{ r: 5, fill: '#E8CFA6', stroke: '#fff' }} />
      <Line type="monotone" dataKey="Total aportado" stroke="#E8CFA6" strokeWidth={2} strokeDasharray="6 4" dot={false} />
    </ComposedChart>
  );
}

const STARS = [
  { top: '12%', left: '8%', s: 3, d: '0s' }, { top: '22%', left: '78%', s: 2, d: '1.2s' },
  { top: '55%', left: '90%', s: 3, d: '2.1s' }, { top: '70%', left: '12%', s: 2, d: '.7s' },
  { top: '38%', left: '45%', s: 2, d: '3s' }, { top: '85%', left: '60%', s: 3, d: '1.8s' },
  { top: '8%', left: '55%', s: 2, d: '2.6s' }, { top: '62%', left: '30%', s: 2, d: '3.6s' },
];

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
    const proyecta = (years) => { let s = 0; for (let m = 0; m < years * 12; m++) s = s * (1 + rm) + (f.aportMensual || 0); return s; };
    let saldo = 0, aportado = 0;
    const serie = [];
    for (let y = 1; y <= anios; y++) {
      for (let m = 0; m < 12; m++) { saldo = saldo * (1 + rm) + (f.aportMensual || 0); aportado += (f.aportMensual || 0); }
      serie.push({ edad: (f.edad || 30) + y, 'Total aportado': Math.round(aportado), 'Saldo proyectado': Math.round(saldo) });
    }
    const rAnual = (f.rendimiento || 0) / 100;
    return {
      anios, aportAnual, tope, topeUMA, topeIngreso, deducible, devolucion, costoReal,
      saldoFinal: saldo, aportado, rendimientoGenerado: saldo - aportado,
      devolucionesAcum: devolucion * anios,
      pensionMensual: (saldo * 0.04) / 12,
      multiplo: aportado > 0 ? saldo / aportado : 0,
      costoDeEsperar: anios > 5 ? saldo - proyecta(anios - 5) : 0,
      aniosDeIngreso: (f.ingresoAnual || 0) > 0 ? saldo / f.ingresoAnual : 0,
      hitoMillon: serie.find(s => s['Saldo proyectado'] >= 1000000)?.edad || null,
      hitoInteres: serie.find(s => s['Saldo proyectado'] * rAnual >= aportAnual)?.edad || null,
      serie,
    };
  }, [f]);

  const saldoAnimado = useCountUp(r.saldoFinal);
  const nombre = f.nombre.trim().split(' ')[0] || '';

  const guardarEnExpediente = async () => {
    if (!saveClient) return;
    setSaving(true);
    try {
      const texto = `📊 Cotización PPR — aportación ${fmt(f.aportMensual)}/mes, retiro a los ${f.edadRetiro} años (${r.anios} años). ` +
        `Deducible anual ${fmt(r.deducible)} → devolución ISR est. ${fmt(r.devolucion)}/año (costo real ${fmt(r.costoReal)}/mes). ` +
        `Saldo proyectado ${fmt(r.saldoFinal)} (aportado ${fmt(r.aportado)} + rendimiento ${fmt(r.rendimientoGenerado)} al ${f.rendimiento}%). ` +
        `Pensión mensual est. ${fmt(r.pensionMensual)}.`;
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
      <style>{getCrmCSS()}{QUOTE_CSS}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Cotizador PPR</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>La carta de tu futuro — deducción Art. 151 + proyección de retiro en una pieza que enamora</p>
        </div>
        <div className="crm-toolbar-right">
          <button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Imprimir / PDF</button>
        </div>
      </div>

      {msg && <div className="info-box" style={{ marginBottom: 14 }}><p>{msg}</p></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 330px) 1fr', gap: 20, alignItems: 'start' }} className="ppr-grid">

        {/* ── Parámetros ── */}
        <div className="crm-chart-card" style={{ marginBottom: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Calculator size={16} color={C.gold} /> Datos del prospecto</h3>
          <p className="sub">Ajusta y la carta se reescribe al instante</p>
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
            Tope Art. 151: el menor entre 10% del ingreso ({fmt(r.topeIngreso)}) y 5 UMAs anuales ({fmt(r.topeUMA)}).
          </p>
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

        {/* ══════════ LA CARTA DE TU FUTURO ══════════ */}
        <div id="ppr-proposal" className="qp-canvas" style={{ maxWidth: 780 }}>
          {STARS.map((s, i) => <span key={i} className="qp-star" style={{ top: s.top, left: s.left, width: s.s, height: s.s, animationDelay: s.d }} />)}

          <div className="qp-page qp-page1" style={{ padding: '30px 34px 10px', position: 'relative' }}>
            {/* Encabezado con logo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Logo height={34} variant="light" layout="inline" />
                <span className="qp-eyebrow" style={{ borderLeft: '1px solid rgba(232,207,166,.35)', paddingLeft: 14 }}>La carta de tu futuro</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>{new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>

            {/* Hero */}
            <div style={{ textAlign: 'center', padding: '28px 0 8px', animation: 'riseSoft .5s ease backwards' }}>
              <p style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 21, color: 'rgba(255,255,255,.88)', margin: '0 0 6px', fontWeight: 500 }}>
                {nombre ? `${nombre}, el día que cumplas ${f.edadRetiro} años` : `El día que cumplas ${f.edadRetiro} años`}
              </p>
              <p style={{ fontSize: 12.5, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(232,207,166,.75)', margin: '0 0 14px', fontWeight: 600 }}>tu libertad tendrá este número</p>
              <div className="qp-hero-number">{fmt(saldoAnimado)}</div>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.7)', margin: '16px auto 0', maxWidth: 520, lineHeight: 1.65 }}>
                Despertar sin despertador. Decir <i>sí</i> al viaje. Cuidar de los tuyos sin pedir permiso.
                Todo empieza con <b style={{ color: '#E8CFA6' }}>{fmt(f.aportMensual)} al mes</b> — que en realidad te cuestan{' '}
                <b style={{ color: '#E8CFA6' }}>{fmt(r.costoReal)}</b>, porque el SAT financia el resto.
              </p>
            </div>

            <hr className="qp-divider" />

            {/* Hitos del viaje */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 4 }}>
              {r.hitoMillon && (
                <div className="qp-milestone" style={{ animationDelay: '.1s' }}>
                  <div className="qp-mile-dot"><Gem size={15} /></div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Tu primer millón</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}>a los <b style={{ color: '#E8CFA6' }}>{r.hitoMillon} años</b> — y de ahí, cuesta abajo</div>
                  </div>
                </div>
              )}
              {r.hitoInteres && (
                <div className="qp-milestone" style={{ animationDelay: '.22s' }}>
                  <div className="qp-mile-dot"><Sunrise size={15} /></div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Tu dinero te alcanza</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}>a los <b style={{ color: '#E8CFA6' }}>{r.hitoInteres} años</b> el interés aporta más que tú</div>
                  </div>
                </div>
              )}
              <div className="qp-milestone" style={{ animationDelay: '.34s' }}>
                <div className="qp-mile-dot final"><Crown size={15} /></div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Libertad a los {f.edadRetiro}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}><b style={{ color: '#E8CFA6' }}>{fmt(r.pensionMensual)}/mes</b> de por vida, sin trabajar</div>
                </div>
              </div>
            </div>

            <hr className="qp-divider" />

            {/* Gemas — psicología del color: oro=riqueza, verde=dinero que
                regresa, azul=crecimiento/confianza, violeta=aspiración */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
              <div className="qp-gem" style={{ animationDelay: '.1s', '--gc': '#F2D9A7', '--gtint': 'rgba(232,207,166,.22)' }}>
                <div className="g-head"><span className="g-ico"><Coins size={13} /></span><span className="g-label">Cada peso se convierte en</span></div>
                <div className="g-value"><span className="hl">${r.multiplo.toFixed(2)}</span></div>
                <div className="g-sub">aportas {fmt(r.aportado)}, cosechas <b>{fmt(r.saldoFinal)}</b></div>
              </div>
              <div className="qp-gem" style={{ animationDelay: '.2s', '--gc': '#6EE7B7', '--gtint': 'rgba(52,211,153,.2)' }}>
                <div className="g-head"><span className="g-ico"><Landmark size={13} /></span><span className="g-label">El SAT te devuelve</span></div>
                <div className="g-value"><span className="hl">{fmt(r.devolucion)}</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>/año</span></div>
                <div className="g-sub">deducible {fmt(r.deducible)} × {f.tasaISR}% — <b>{fmt(r.devolucionesAcum)}</b> en todo el plan</div>
              </div>
              <div className="qp-gem" style={{ animationDelay: '.3s', '--gc': '#7CC4FF', '--gtint': 'rgba(90,169,255,.22)' }}>
                <div className="g-head"><span className="g-ico"><TrendingUp size={13} /></span><span className="g-label">Rendimiento generado</span></div>
                <div className="g-value"><span className="hl">{fmt(r.rendimientoGenerado)}</span></div>
                <div className="g-sub">el interés compuesto hace <b>{Math.max(r.multiplo - 1, 0).toFixed(1)}×</b> tu esfuerzo</div>
              </div>
              {r.aniosDeIngreso >= 1 && (
                <div className="qp-gem" style={{ animationDelay: '.4s', '--gc': '#C4B5FD', '--gtint': 'rgba(167,139,250,.22)' }}>
                  <div className="g-head"><span className="g-ico"><Hourglass size={13} /></span><span className="g-label">Equivale a</span></div>
                  <div className="g-value"><span className="hl">{r.aniosDeIngreso.toFixed(1)} años</span></div>
                  <div className="g-sub">de tu ingreso actual, <b>trabajando cero horas</b></div>
                </div>
              )}
              <div className="qp-gem" style={{ animationDelay: '.5s', '--gc': '#67E8F9', '--gtint': 'rgba(34,211,238,.18)' }}>
                <div className="g-head"><span className="g-ico"><Sunrise size={13} /></span><span className="g-label">Tu futuro cuesta al día</span></div>
                <div className="g-value"><span className="hl">{fmt(r.costoReal / 30)}</span></div>
                <div className="g-sub">menos que una comida a domicilio — <b>decisión de café, resultado de millones</b></div>
              </div>
              <div className="qp-gem" style={{ animationDelay: '.6s', '--gc': '#F9A8D4', '--gtint': 'rgba(244,114,182,.2)' }}>
                <div className="g-head"><span className="g-ico"><Crown size={13} /></span><span className="g-label">Pensión de por vida</span></div>
                <div className="g-value"><span className="hl">{fmt(r.pensionMensual)}</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>/mes</span></div>
                <div className="g-sub">desde los {f.edadRetiro}, cada mes, <b>sin depender de nadie</b></div>
              </div>
            </div>

          </div>

          <div className="qp-page qp-page2" style={{ padding: '10px 34px 26px', position: 'relative' }}>
            {/* Mini-encabezado (visible sobre todo en la página 2 impresa) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span className="qp-eyebrow" style={{ fontSize: 9 }}>Finance SCool · La carta de tu futuro</span>
              <span style={{ fontSize: 10, color: 'rgba(232,207,166,.6)', fontWeight: 700 }}>{f.nombre ? f.nombre : ''}</span>
            </div>

            {/* Gráfica luminosa */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 15.5, color: '#fff' }}>El ascenso</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>— dorado: lo que pones · azul: en lo que se convierte</span>
              </div>
              {/* Pantalla: responsiva. Impresión: gemela de tamaño fijo (el
                  contenedor responsivo no sobrevive al render de impresión). */}
              <div className="qp-screen-chart">
                <ResponsiveContainer width="100%" height={250}>
                  {ascensoChart(r.serie, null)}
                </ResponsiveContainer>
              </div>
              <div className="qp-print-chart">
                {ascensoChart(r.serie, { width: 640, height: 290 })}
              </div>
            </div>

            {/* El costo de esperar */}
            {r.costoDeEsperar > 0 && (
              <div className="qp-wait" style={{ marginTop: 18, animationDelay: '.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: 700, color: '#FFB4A0', marginBottom: 4 }}>⏳ El costo de esperar</div>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.85)', lineHeight: 1.55, maxWidth: 420 }}>
                      Si esta decisión se pospone 5 años, la misma aportación llega a mucho menos.
                      <b> El mejor día para empezar era ayer; el segundo mejor es hoy.</b>
                    </p>
                  </div>
                  <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 30, fontWeight: 600, color: '#FF9B85', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    −{fmt(r.costoDeEsperar)}
                  </div>
                </div>
              </div>
            )}

            {/* Cierre */}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <p style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 16.5, fontStyle: 'italic', color: 'rgba(255,255,255,.9)', margin: 0, lineHeight: 1.6 }}>
                "No se trata de dejar de vivir hoy — se trata de que {nombre ? `la ${nombre} del futuro` : 'tu yo del futuro'} te dé las gracias todos los días."
              </p>
              <div style={{ marginTop: 14, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(232,207,166,.7)', fontWeight: 700 }}>
                Tu asesor Finance SCool · Respaldo Prudential · Beneficio fiscal Art. 151 LISR
              </div>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginTop: 12, lineHeight: 1.5 }}>
                Proyección ilustrativa con rendimiento constante del {f.rendimiento}% anual; no constituye garantía. Deducibilidad conforme al Art. 151 fracc. V de la LISR vigente. La devolución depende de la situación fiscal de cada contribuyente. Pensión estimada con regla del 4% anual.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
