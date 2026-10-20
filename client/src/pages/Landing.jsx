import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, MessageCircle, Check, ArrowRight, Star, ShieldCheck, TrendingUp, PiggyBank, Calculator, Landmark, Users, HeartHandshake } from 'lucide-react';
import Logo from '../components/Logo';
import ChatSofia from '../components/ChatSofia';
import { getWhatsAppURL, trackWhatsAppClick, trackCalculadoraISR, trackMetaViewContent, initScrollTracking, trackMetaLead } from '../utils/tracking';

/* ============================================================================
   Finance S-Cool — Landing v3
   Estructura y mecánica de conversión inspirada en contratado.com.mx
   (hero con mockup flotante + rating ★, strip de stats, tarjetas de beneficio,
   3 pasos, calculadora ISR real, CASOS DE ÉXITO, banda CTA final), pero con la
   identidad financiera FSC: navy #003DA5 + oro #C9A84C, Playfair Display + Inter.
   Conserva lo que ya vende: calculadora ISR 2026, formulario → /api/leads
   (mismo pipeline + ping Telegram), chat Sofia y tracking Meta Pixel.
   ========================================================================== */

const API_URL = import.meta.env.VITE_API_URL || '/api';
const CALENDLY = 'https://calendly.com/ingrid-escobar-grupointegraccion/new-meeting';

// ===== ISR 2026 (lógica reutilizada del landing anterior) =====
const ISR_TABLE_2026 = [
  { limInf: 0.01, limSup: 10135.11, cuota: 0, pct: 0.0192 },
  { limInf: 10135.12, limSup: 86022.11, cuota: 171.88, pct: 0.064 },
  { limInf: 86022.12, limSup: 151176.19, cuota: 4461.94, pct: 0.1088 },
  { limInf: 151176.20, limSup: 175735.66, cuota: 10723.55, pct: 0.16 },
  { limInf: 175735.67, limSup: 210403.69, cuota: 14194.54, pct: 0.1792 },
  { limInf: 210403.70, limSup: 424353.97, cuota: 19682.13, pct: 0.2136 },
  { limInf: 424353.98, limSup: 668840.14, cuota: 60049.40, pct: 0.2352 },
  { limInf: 668840.15, limSup: 1276925.98, cuota: 110842.74, pct: 0.30 },
  { limInf: 1276925.99, limSup: 1702567.97, cuota: 271981.99, pct: 0.32 },
  { limInf: 1702567.98, limSup: 5107703.92, cuota: 392294.17, pct: 0.34 },
  { limInf: 5107703.93, limSup: Infinity, cuota: 1414947.85, pct: 0.35 },
];
const CINCO_UMAS_ANUALES = 213973.20; // tope deducible PPR (art. 151 LISR)

function calcISR(ingresoAnual) {
  if (ingresoAnual <= 0) return 0;
  for (const b of ISR_TABLE_2026) {
    if (ingresoAnual >= b.limInf && ingresoAnual <= b.limSup) return b.cuota + (ingresoAnual - b.limInf) * b.pct;
  }
  const last = ISR_TABLE_2026[ISR_TABLE_2026.length - 1];
  return last.cuota + (ingresoAnual - last.limInf) * last.pct;
}
function tasaMarginal(ingresoAnual) {
  for (const b of ISR_TABLE_2026) if (ingresoAnual >= b.limInf && ingresoAnual <= b.limSup) return b.pct;
  return 0.35;
}
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-MX');

// ===== Reveal al hacer scroll =====
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    document.querySelectorAll('.fsc-rv').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ===== Contador animado =====
function useCountUp(end, duration = 1800) {
  const [n, setN] = useState(0);
  const [go, setGo] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setGo(true); io.disconnect(); } }, { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!go) return;
    let raf, t0 = null;
    const step = (t) => { if (!t0) t0 = t; const p = Math.min((t - t0) / duration, 1); setN(p * end); if (p < 1) raf = requestAnimationFrame(step); else setN(end); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [go, end, duration]);
  return [n, ref];
}

const STARS = (n = 5) => Array.from({ length: n }, (_, i) => <Star key={i} size={16} fill="currentColor" stroke="none" />);

// ===== CASOS DE ÉXITO (ilustrativos — reemplazar por reales con consentimiento) =====
const CASOS = [
  { ini: 'AM', nombre: 'Dr. Alejandro M.', rol: 'Médico · CDMX', stat: '+$82,000', statK: 'recuperados de ISR', quote: 'Lo que pagaba de impuestos ahora vuelve a mi retiro. Recuperé $82,000 en mi primera declaración con mi PPR.' },
  { ini: 'LG', nombre: 'Laura G.', rol: 'Emprendedora · GDL', stat: '35%', statK: 'menos ISR al año', quote: 'Pasé de no entender nada de impuestos a tener una estrategia clara. Ahorro y deduzco al mismo tiempo.' },
  { ini: 'FR', nombre: 'Familia Ríos', rol: 'Monterrey', stat: '2 en 1', statK: 'retiro + protección', quote: 'Protegimos a nuestros hijos y empezamos nuestro retiro el mismo mes. El acompañamiento fue total.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useReveal();

  // Tracking de entrada
  useEffect(() => {
    try { initScrollTracking(); trackMetaViewContent({ seccion: 'Landing_Home' }); } catch { /* best-effort */ }
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ===== Stats =====
  const [c1, r1] = useCountUp(900);
  const [c2, r2] = useCountUp(35);
  const [c3, r3] = useCountUp(15);

  // ===== Calculadora ISR =====
  const [ingresoMensual, setIngresoMensual] = useState(60000);
  const ingresoAnual = ingresoMensual * 12;
  const isrActual = calcISR(ingresoAnual);
  const marginal = tasaMarginal(ingresoAnual);
  const aportacionPPR = Math.min(ingresoAnual * 0.10, CINCO_UMAS_ANUALES);
  const devolucion = aportacionPPR * marginal;
  const isrOptimizado = Math.max(0, isrActual - devolucion);
  const pctAhorro = isrActual > 0 ? Math.round((devolucion / isrActual) * 100) : 0;
  useEffect(() => {
    const t = setTimeout(() => { try { trackCalculadoraISR(ingresoMensual, devolucion); } catch { /* noop */ } }, 1200);
    return () => clearTimeout(t);
  }, [ingresoMensual, devolucion]);

  // ===== Formulario =====
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
  const [formErrors, setFormErrors] = useState({});
  const [formStatus, setFormStatus] = useState('');
  const sanitize = (s) => s.replace(/[<>"'&]/g, '').trim();
  const setField = (k, v) => { setFormData((d) => ({ ...d, [k]: v })); setFormErrors((e) => ({ ...e, [k]: '' })); };
  const validate = () => {
    const e = {};
    const name = formData.name.trim();
    if (!name || name.length < 2) e.name = 'Ingresa tu nombre';
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(name)) e.name = 'Nombre no válido';
    if (!/^\d{10,15}$/.test(formData.phone.replace(/[\s\-().+]/g, ''))) e.phone = 'Teléfono válido (10 dígitos)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email.trim().toLowerCase())) e.email = 'Correo no válido';
    if (!formData.incomeType) e.incomeType = 'Selecciona tu tipo de ingreso';
    if (!formData.approxIncome) e.approxIncome = 'Selecciona tu rango de ingreso';
    return e;
  };
  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setFormErrors(e);
    if (Object.keys(e).length) return;
    setFormStatus('loading');
    try {
      const payload = {
        name: sanitize(formData.name), phone: formData.phone.replace(/[^\d+\-() ]/g, ''),
        email: formData.email.trim().toLowerCase(), incomeType: formData.incomeType,
        approxIncome: formData.approxIncome, declaracion: formData.declaracion, retiroPlan: formData.retiroPlan,
      };
      const r = await fetch(`${API_URL}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error();
      setFormStatus('success');
      try { trackMetaLead({ tipo: 'CTA Landing Form', categoria: payload.incomeType, valor_estimado: 0, ingreso: payload.approxIncome }); } catch { /* noop */ }
      const savedName = payload.name, savedEmail = payload.email;
      setFormData({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
      setTimeout(() => setFormStatus(''), 4000);
      if (window.Calendly) window.Calendly.initPopupWidget({ url: CALENDLY, prefill: { name: savedName, email: savedEmail } });
    } catch { setFormStatus('error'); }
  };

  const goto = (id) => { setNavOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="fsc">
      <style>{CSS}</style>

      {/* ───────── NAV ───────── */}
      <nav className={`fsc-nav ${scrolled ? 'on' : ''}`}>
        <div className="fsc-wrap fsc-nav-in">
          <a className="fsc-brand" href="#top" onClick={(e) => { e.preventDefault(); goto('top'); }}><Logo height={30} layout="inline" /></a>
          <div className="fsc-nav-links">
            <a onClick={() => goto('beneficios')}>Beneficios</a>
            <a onClick={() => goto('proceso')}>Cómo funciona</a>
            <a onClick={() => goto('simulador')}>Calculadora</a>
            <a onClick={() => goto('casos')}>Casos de éxito</a>
          </div>
          <div className="fsc-nav-r">
            <button className="fsc-btn fsc-btn-ghost fsc-sm" onClick={() => navigate('/login')}>Entrar</button>
            <button className="fsc-btn fsc-btn-gold fsc-sm" onClick={() => goto('contacto')}>Agenda gratis</button>
            <button className="fsc-burger" onClick={() => setNavOpen((o) => !o)} aria-label="Menú">{navOpen ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
        </div>
        {navOpen && (
          <div className="fsc-nav-mobile">
            <a onClick={() => goto('beneficios')}>Beneficios</a>
            <a onClick={() => goto('proceso')}>Cómo funciona</a>
            <a onClick={() => goto('simulador')}>Calculadora</a>
            <a onClick={() => goto('casos')}>Casos de éxito</a>
            <button className="fsc-btn fsc-btn-gold" onClick={() => goto('contacto')}>Agenda gratis</button>
          </div>
        )}
      </nav>

      {/* ───────── HERO ───────── */}
      <header className="fsc-hero" id="top">
        <span className="fsc-blob b1" /><span className="fsc-blob b2" /><span className="fsc-blob b3" />
        <div className="fsc-wrap fsc-hero-grid">
          <div>
            <span className="fsc-eyebrow fsc-rv"><Star size={13} fill="currentColor" stroke="none" /> 4.9/5 · +900 familias ya optimizan sus finanzas</span>
            <h1 className="fsc-rv">Paga menos impuestos y construye el <span className="fsc-hl">retiro</span> que mereces.</h1>
            <p className="fsc-lede fsc-rv">Diseñamos tu estrategia fiscal y de retiro con un PPR deducible. Recupera parte de tu ISR cada año y haz que tu dinero trabaje para ti — con el respaldo de Prudential.</p>
            <div className="fsc-hero-cta fsc-rv">
              <button className="fsc-btn fsc-btn-gold fsc-lg" onClick={() => goto('simulador')}>Calcular mi ahorro <ArrowRight size={18} /></button>
              <button className="fsc-btn fsc-btn-ghost fsc-lg" onClick={() => goto('proceso')}>Cómo funciona</button>
            </div>
            <div className="fsc-rating fsc-rv">
              <div className="fsc-avs"><span>👨‍⚕️</span><span>👩‍💼</span><span>🧑‍💻</span><span>👨‍🔧</span></div>
              <div>
                <div className="fsc-stars">{STARS()}</div>
                <div className="fsc-rt"><b>Asesoría certificada</b> · respaldo de Prudential</div>
              </div>
            </div>
          </div>

          {/* Mockup: tarjeta de estrategia */}
          <div className="fsc-rv">
            <div className="fsc-stage">
              <div className="fsc-rbg rbg1" /><div className="fsc-rbg rbg2" />
              <div className="fsc-card3d">
                <div className="fsc-c-head">
                  <div className="fsc-c-ava">TU</div>
                  <div><div className="fsc-c-name">Tu estrategia 2026</div><div className="fsc-c-role">Plan fiscal + retiro</div></div>
                  <div className="fsc-c-score"><b>Óptima</b><span>PLAN</span></div>
                </div>
                <div className="fsc-c-lbl">ISR ANUAL</div>
                <div className="fsc-c-row"><span>Sin estrategia</span><b className="muted">{fmt(isrActual)}</b></div>
                <div className="fsc-bar"><i style={{ width: '100%' }} /></div>
                <div className="fsc-c-row"><span>Con tu PPR</span><b className="gold">{fmt(isrOptimizado)}</b></div>
                <div className="fsc-bar gold"><i style={{ width: `${Math.max(12, 100 - pctAhorro)}%` }} /></div>
                <div className="fsc-c-lbl">INCLUYE</div>
                <div className="fsc-c-chips"><span>Deducible</span><span>Rendimiento</span><span>Protegido</span></div>
              </div>
              <div className="fsc-float f1"><div className="ic"><Check size={15} /></div>Deducible de ISR</div>
              <div className="fsc-float f2"><div className="ic">🎯</div><div>Ahorro<small>-{pctAhorro}% impuestos</small></div></div>
            </div>
          </div>
        </div>
      </header>

      {/* ───────── STATS ───────── */}
      <div className="fsc-strip">
        <div className="fsc-wrap fsc-strip-grid">
          <div className="fsc-stat" ref={r1}><div className="n">+{Math.round(c1)}</div><div className="k">familias asesoradas</div></div>
          <div className="fsc-stat" ref={r2}><div className="n">{Math.round(c2)}%</div><div className="k">ahorro fiscal promedio</div></div>
          <div className="fsc-stat"><div className="n">4.9<span>/5</span></div><div className="k">satisfacción</div></div>
          <div className="fsc-stat" ref={r3}><div className="n">{Math.round(c3)}+</div><div className="k">años de experiencia</div></div>
        </div>
      </div>

      {/* ───────── BENEFICIOS ───────── */}
      <section id="beneficios" className="fsc-sec">
        <div className="fsc-wrap">
          <div className="fsc-sec-head fsc-rv">
            <span className="fsc-eyebrow">Tres palancas, bien hechas</span>
            <h2>No es un seguro más.<br />Es tu dinero <span className="fsc-g">trabajando para ti</span>.</h2>
            <p>Combinamos lo que de verdad mueve la aguja: pagar menos impuestos, construir tu retiro y proteger a tu familia — en una sola estrategia.</p>
          </div>
          <div className="fsc-feat">
            {[
              { ic: <Landmark size={26} />, tint: 'navy', h: 'Paga menos ISR', p: 'Un PPR deducible baja tu base gravable: aportas, deduces y recuperas parte de lo que hoy pagas de impuestos.', li: ['Deduce hasta el 10% de tu ingreso', 'Dentro de los topes legales (art. 151)', 'Devolución anual en tu declaración'] },
              { ic: <PiggyBank size={26} />, tint: 'gold', h: 'Retiro que sí alcanza', p: 'Tu dinero crece con rendimiento real y aportaciones flexibles. Ves la proyección clara, sin letras chiquitas.', li: ['Rendimiento compuesto a tu favor', 'Aportas a tu ritmo', 'Proyección de tu retiro paso a paso'] },
              { ic: <ShieldCheck size={26} />, tint: 'navy', h: 'Protección para tu familia', p: 'Si algo pasa, tu familia queda cubierta. Tranquilidad con el respaldo de una aseguradora global.', li: ['Cobertura para los tuyos', 'Respaldo de Prudential', 'Un solo plan, todo integrado'] },
            ].map((f, i) => (
              <div className="fsc-fcard fsc-rv" key={i}>
                <div className={`fsc-fchip ${f.tint}`}>{f.ic}</div>
                <h3>{f.h}</h3>
                <p>{f.p}</p>
                <ul>{f.li.map((l, j) => <li key={j}><Check size={17} /> {l}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── PROCESO ───────── */}
      <section id="proceso" className="fsc-sec fsc-pad0">
        <div className="fsc-wrap">
          <div className="fsc-block">
            <div className="fsc-sec-head fsc-rv" style={{ marginBottom: 8 }}>
              <span className="fsc-eyebrow">Cómo funciona</span>
              <h2>Tres pasos. Cero relleno.</h2>
            </div>
            <div className="fsc-steps">
              {[
                { h: 'Diagnóstico gratis', p: 'Platicamos 20 minutos. Revisamos tu ingreso, lo que pagas de impuestos y a dónde quieres llegar.' },
                { h: 'Estrategia a tu medida', p: 'Te mostramos cuánto puedes ahorrar y cómo quedaría tu retiro. Tú decides, sin compromiso.' },
                { h: 'Acompañamiento total', p: 'Activamos tu plan y te acompañamos cada año en tu declaración y tus metas. Del plan a los resultados.' },
              ].map((s, i) => (
                <div className="fsc-step fsc-rv" key={i}>
                  <div className="no">{i + 1}</div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── CALCULADORA ISR ───────── */}
      <section id="simulador" className="fsc-sec">
        <div className="fsc-wrap">
          <div className="fsc-sec-head fsc-rv">
            <span className="fsc-eyebrow"><Calculator size={14} /> Calculadora ISR 2026</span>
            <h2>¿Cuánto podrías <span className="fsc-g">recuperar</span> este año?</h2>
            <p>Mueve tu ingreso y mira en tiempo real lo que podrías deducir con un PPR. Es una estimación — tu asesor afina el número contigo.</p>
          </div>
          <div className="fsc-calc fsc-rv">
            <div className="fsc-calc-controls">
              <label>Tu ingreso mensual aproximado</label>
              <div className="fsc-calc-amount">{fmt(ingresoMensual)} <small>/ mes</small></div>
              <input type="range" min="15000" max="400000" step="5000" value={ingresoMensual} onChange={(e) => setIngresoMensual(+e.target.value)} />
              <div className="fsc-calc-range"><span>$15k</span><span>$400k+</span></div>
            </div>
            <div className="fsc-calc-results">
              <div className="fsc-calc-box">
                <span className="k">Tu ISR anual hoy</span>
                <span className="v muted">{fmt(isrActual)}</span>
              </div>
              <div className="fsc-calc-box hero">
                <span className="k">Podrías recuperar ~</span>
                <span className="v">{fmt(devolucion)}</span>
                <span className="sub">aportando {fmt(aportacionPPR)} a tu PPR · hasta -{pctAhorro}% de tu ISR</span>
              </div>
              <button className="fsc-btn fsc-btn-gold fsc-lg fsc-w100" onClick={() => goto('contacto')}>Quiero esta estrategia <ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── CASOS DE ÉXITO ───────── */}
      <section id="casos" className="fsc-sec fsc-pad0">
        <div className="fsc-wrap">
          <div className="fsc-caseblock">
            <div className="fsc-sec-head fsc-rv">
              <span className="fsc-eyebrow">Casos de éxito</span>
              <h2 style={{ color: '#fff' }}>Historias reales de gente<br />que ya tomó el control.</h2>
            </div>
            <div className="fsc-cases">
              {CASOS.map((c, i) => (
                <div className="fsc-case fsc-rv" key={i}>
                  <div className="fsc-stars gold">{STARS()}</div>
                  <div className="fsc-case-stat"><b>{c.stat}</b><span>{c.statK}</span></div>
                  <p>“{c.quote}”</p>
                  <div className="fsc-case-who"><div className="fsc-case-ava">{c.ini}</div><div><b>{c.nombre}</b><span>{c.rol}</span></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── PARA QUIÉN ───────── */}
      <section className="fsc-sec fsc-pad-t0">
        <div className="fsc-wrap">
          <div className="fsc-sec-head fsc-rv"><span className="fsc-eyebrow">Para quién es</span><h2>Si generas ingresos, esto es para ti.</h2></div>
          <div className="fsc-who-grid">
            {[
              { ic: '👨‍⚕️', t: 'Médicos y profesionistas', s: 'Consulta privada u honorarios: deduce y ordena tu retiro.' },
              { ic: '🏢', t: 'Empresarios y dueños', s: 'Separa tu patrimonio personal y optimiza lo que pagas al SAT.' },
              { ic: '💻', t: 'Freelancers y PyME', s: 'Ingresos variables, estrategia flexible que se adapta a ti.' },
              { ic: '📈', t: 'Empleados de alto ingreso', s: 'Recupera ISR vía declaración anual y construye tu futuro.' },
            ].map((w, i) => (
              <div className="fsc-who fsc-rv" key={i}><div className="ic">{w.ic}</div><div><b>{w.t}</b><p>{w.s}</p></div></div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FORMULARIO ───────── */}
      <section id="contacto" className="fsc-sec">
        <div className="fsc-wrap fsc-contact-grid">
          <div className="fsc-rv">
            <span className="fsc-eyebrow"><HeartHandshake size={14} /> Diagnóstico gratis</span>
            <h2 style={{ marginTop: 14 }}>Agenda tu <span className="fsc-g">sesión sin costo</span>.</h2>
            <p className="fsc-lede" style={{ maxWidth: '42ch' }}>Déjanos tus datos y un asesor te contacta para mostrarte, con tus números, cuánto puedes ahorrar y cómo quedaría tu retiro. Sin compromiso.</p>
            <ul className="fsc-contact-perks">
              <li><Check size={18} /> 20 minutos, por WhatsApp o videollamada</li>
              <li><Check size={18} /> Con tus cifras reales, no promesas genéricas</li>
              <li><Check size={18} /> Respaldo de Prudential</li>
            </ul>
            <div className="fsc-rating" style={{ marginTop: 20 }}>
              <div className="fsc-stars">{STARS()}</div>
              <div className="fsc-rt"><b>4.9/5</b> · +900 familias asesoradas</div>
            </div>
          </div>

          <form className="fsc-form fsc-rv" onSubmit={submit}>
            <div className="fsc-field">
              <input placeholder="Nombre completo" value={formData.name} onChange={(e) => setField('name', e.target.value)} />
              {formErrors.name && <span className="fsc-err">{formErrors.name}</span>}
            </div>
            <div className="fsc-field">
              <input placeholder="WhatsApp (10 dígitos)" value={formData.phone} onChange={(e) => setField('phone', e.target.value)} inputMode="tel" />
              {formErrors.phone && <span className="fsc-err">{formErrors.phone}</span>}
            </div>
            <div className="fsc-field">
              <input placeholder="Correo electrónico" value={formData.email} onChange={(e) => setField('email', e.target.value)} inputMode="email" />
              {formErrors.email && <span className="fsc-err">{formErrors.email}</span>}
            </div>
            <div className="fsc-field-row">
              <div className="fsc-field">
                <select value={formData.incomeType} onChange={(e) => setField('incomeType', e.target.value)}>
                  <option value="">¿Cómo generas ingresos?</option>
                  <option value="empleado">Empleado</option>
                  <option value="freelancer">Freelancer / Honorarios</option>
                  <option value="empresario">Empresario / Dueño</option>
                  <option value="mixto">Mixto</option>
                </select>
                {formErrors.incomeType && <span className="fsc-err">{formErrors.incomeType}</span>}
              </div>
              <div className="fsc-field">
                <select value={formData.approxIncome} onChange={(e) => setField('approxIncome', e.target.value)}>
                  <option value="">Ingreso mensual</option>
                  <option value="20k-50k">$20k – $50k</option>
                  <option value="50k-100k">$50k – $100k</option>
                  <option value="100k-200k">$100k – $200k</option>
                  <option value="200k+">Más de $200k</option>
                </select>
                {formErrors.approxIncome && <span className="fsc-err">{formErrors.approxIncome}</span>}
              </div>
            </div>
            <button className="fsc-btn fsc-btn-gold fsc-lg fsc-w100" type="submit" disabled={formStatus === 'loading'}>
              {formStatus === 'loading' ? 'Enviando…' : <>Agendar mi diagnóstico gratis <ArrowRight size={18} /></>}
            </button>
            {formStatus === 'success' && <div className="fsc-form-msg ok"><Check size={16} /> ¡Listo! Un asesor te contactará muy pronto.</div>}
            {formStatus === 'error' && <div className="fsc-form-msg bad">Hubo un error. Escríbenos por WhatsApp y te atendemos.</div>}
            <p className="fsc-form-legal">🔒 Tus datos están seguros y no se comparten con terceros.</p>
          </form>
        </div>
      </section>

      {/* ───────── CTA FINAL ───────── */}
      <section className="fsc-sec fsc-pad-t0">
        <div className="fsc-wrap">
          <div className="fsc-final fsc-rv">
            <span className="fsc-blob fb" />
            <span className="fsc-eyebrow light">Tu yo del futuro te lo va a agradecer</span>
            <h2>Deja de regalarle dinero al SAT.<br />Empieza tu estrategia hoy.</h2>
            <button className="fsc-btn fsc-btn-white fsc-lg" onClick={() => goto('contacto')}>Agenda tu diagnóstico gratis <ArrowRight size={18} /></button>
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="fsc-footer">
        <div className="fsc-wrap fsc-foot">
          <div style={{ maxWidth: 300 }}>
            <a className="fsc-brand light" href="#top" onClick={(e) => { e.preventDefault(); goto('top'); }}><Logo height={30} layout="inline" variant="light" /></a>
            <p>Estrategia fiscal y de retiro con respaldo de Prudential. Pagas menos impuestos y construyes tu futuro.</p>
            <div className="fsc-foot-social">
              <a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('footer')} aria-label="WhatsApp"><MessageCircle size={18} /></a>
            </div>
          </div>
          <div className="fsc-foot-cols">
            <div><h4>Explora</h4><a onClick={() => goto('beneficios')}>Beneficios</a><a onClick={() => goto('proceso')}>Cómo funciona</a><a onClick={() => goto('simulador')}>Calculadora</a><a onClick={() => goto('casos')}>Casos de éxito</a></div>
            <div><h4>Contacto</h4><a onClick={() => goto('contacto')}>Agenda gratis</a><a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer">WhatsApp</a><a onClick={() => navigate('/login')}>Entrar</a></div>
          </div>
        </div>
        <div className="fsc-wrap fsc-copy"><span>© 2026 Finance S-Cool · Hecho en México 🇲🇽</span><span>financescool.com.mx</span></div>
      </footer>

      {/* Botón WhatsApp flotante + chat Sofia */}
      <a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer" className="fsc-wa" aria-label="WhatsApp" onClick={() => trackWhatsAppClick('sticky')}><MessageCircle size={28} /></a>
      <ChatSofia />
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap');
.fsc{--bg:#fff;--soft:#F5F8FD;--tint:#EAF1FF;--ink:#0A1733;--muted:#5A6684;--faint:#9AA6C0;--line:#E4E9F2;
  --navy:#003DA5;--navy-d:#002B73;--blue2:#0067C5;--gold:#C9A84C;--gold-d:#B99830;--gold-l:#EFE2BC;--amber:#F5B301;--green:#12B76A;
  --r:20px;--r-lg:28px;--sh:0 18px 48px -18px rgba(10,23,51,.28);--sh-sm:0 8px 24px -10px rgba(10,23,51,.18);
  font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.55;font-size:17px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.fsc *{margin:0;padding:0;box-sizing:border-box}
.fsc h1,.fsc h2,.fsc h3{font-family:'Playfair Display',serif;font-weight:800;line-height:1.1;letter-spacing:-.015em}
.fsc a{color:inherit;text-decoration:none;cursor:pointer}
.fsc-wrap{max-width:1160px;margin:0 auto;padding:0 26px}
.fsc-g{color:var(--navy)}
.fsc-hl{position:relative;color:var(--navy);white-space:nowrap}
.fsc-hl::after{content:'';position:absolute;left:0;right:0;bottom:.06em;height:.34em;background:var(--gold-l);z-index:-1;border-radius:3px}
.fsc-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:var(--navy);background:var(--tint);padding:7px 14px;border-radius:100px}
.fsc-eyebrow.light{background:rgba(255,255,255,.16);color:#fff}

.fsc-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:16px;padding:13px 22px;border-radius:13px;cursor:pointer;border:2px solid transparent;transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s,background .2s}
.fsc-btn.fsc-sm{padding:9px 16px;font-size:14.5px}
.fsc-btn.fsc-lg{padding:15px 26px;font-size:16.5px}
.fsc-btn.fsc-w100{width:100%}
.fsc-btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#1a1403;box-shadow:0 12px 26px -10px rgba(201,168,76,.7)}
.fsc-btn-gold:hover{transform:translateY(-3px);box-shadow:0 18px 34px -10px rgba(201,168,76,.8)}
.fsc-btn-ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.fsc-btn-ghost:hover{border-color:var(--navy);color:var(--navy);transform:translateY(-3px)}
.fsc-btn-white{background:#fff;color:var(--navy);box-shadow:var(--sh)}
.fsc-btn-white:hover{transform:translateY(-3px)}

/* nav */
.fsc-nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid transparent;transition:border .3s,box-shadow .3s}
.fsc-nav.on{border-color:var(--line);box-shadow:0 6px 24px -16px rgba(10,23,51,.4)}
.fsc-nav-in{display:flex;align-items:center;justify-content:space-between;height:70px}
.fsc-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;letter-spacing:-.02em;font-family:'Playfair Display',serif}
.fsc-brand.light{color:#fff}
.fsc-nav-links{display:flex;gap:30px;font-weight:600;font-size:15px;color:var(--muted)}
.fsc-nav-links a:hover{color:var(--navy)}
.fsc-nav-r{display:flex;gap:10px;align-items:center}
.fsc-burger{display:none;background:none;border:none;color:var(--ink);cursor:pointer}
.fsc-nav-mobile{display:none;flex-direction:column;gap:4px;padding:14px 26px 20px;background:#fff;border-bottom:1px solid var(--line)}
.fsc-nav-mobile a{padding:10px 0;font-weight:600;color:var(--ink)}
.fsc-nav-mobile .fsc-btn{margin-top:8px}

/* hero */
.fsc-hero{position:relative;padding:68px 0 54px;overflow:hidden}
.fsc-blob{position:absolute;border-radius:50%;filter:blur(72px);z-index:0;pointer-events:none}
.fsc-blob.b1{width:440px;height:440px;background:rgba(0,61,165,.14);top:-130px;right:-70px}
.fsc-blob.b2{width:360px;height:360px;background:rgba(201,168,76,.18);bottom:-130px;left:-120px}
.fsc-blob.b3{width:240px;height:240px;background:rgba(0,103,197,.12);top:120px;right:300px}
.fsc-hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.03fr .97fr;gap:50px;align-items:center}
.fsc-hero h1{font-size:clamp(34px,5vw,58px);margin-top:20px}
.fsc-lede{font-size:clamp(16px,1.9vw,19px);color:var(--muted);max-width:38ch;margin:20px 0 28px}
.fsc-hero-cta{display:flex;gap:12px;flex-wrap:wrap}
.fsc-rating{display:flex;align-items:center;gap:13px;margin-top:26px}
.fsc-avs{display:flex}.fsc-avs span{width:38px;height:38px;border-radius:50%;border:3px solid #fff;margin-left:-12px;display:grid;place-items:center;font-size:17px;background:var(--tint);box-shadow:var(--sh-sm)}
.fsc-avs span:first-child{margin:0}
.fsc-stars{display:flex;gap:1px;color:var(--amber)}
.fsc-stars.gold{color:var(--gold)}
.fsc-rt{font-size:14px;color:var(--muted)}.fsc-rt b{color:var(--ink)}

/* mockup card */
.fsc-stage{position:relative;padding:12px}
.fsc-card3d{position:relative;z-index:3;background:#fff;border-radius:var(--r);box-shadow:var(--sh);padding:24px;border:1px solid var(--line)}
.fsc-rbg{position:absolute;inset:12px;border-radius:var(--r);box-shadow:var(--sh-sm)}
.fsc-rbg.rbg1{z-index:1;transform:rotate(-6deg) translate(-16px,10px);background:var(--tint)}
.fsc-rbg.rbg2{z-index:2;transform:rotate(4deg) translate(20px,-6px);background:#FBF5E3}
.fsc-c-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.fsc-c-ava{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,var(--navy),var(--blue2));display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px;font-family:'Inter',sans-serif}
.fsc-c-name{font-weight:800;font-size:15px}.fsc-c-role{font-size:12.5px;color:var(--muted)}
.fsc-c-score{margin-left:auto;text-align:center;background:var(--gold-l);border-radius:11px;padding:6px 11px}
.fsc-c-score b{color:var(--gold-d);font-weight:800;font-size:14px;display:block;line-height:1.1}
.fsc-c-score span{font-size:9px;color:var(--gold-d);font-weight:800;letter-spacing:.08em}
.fsc-c-lbl{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--faint);margin:16px 0 9px}
.fsc-c-row{display:flex;justify-content:space-between;font-size:13.5px;font-weight:600}
.fsc-c-row b.muted{color:var(--muted)}.fsc-c-row b.gold{color:var(--gold-d)}
.fsc-bar{height:8px;border-radius:6px;background:var(--line);margin:6px 0 2px;overflow:hidden}
.fsc-bar i{display:block;height:100%;border-radius:6px;background:var(--navy)}
.fsc-bar.gold i{background:linear-gradient(90deg,var(--gold),var(--gold-d))}
.fsc-c-chips{display:flex;gap:6px;flex-wrap:wrap}
.fsc-c-chips span{font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;background:var(--tint);color:var(--navy)}
.fsc-c-chips span:nth-child(2){background:var(--gold-l);color:var(--gold-d)}
.fsc-c-chips span:nth-child(3){background:#E7F7EF;color:#0A9D63}
.fsc-float{position:absolute;z-index:4;background:#fff;border-radius:13px;box-shadow:var(--sh);padding:10px 14px;display:flex;align-items:center;gap:9px;font-weight:700;font-size:13px;border:1px solid var(--line)}
.fsc-float .ic{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:none}
.fsc-float.f1{top:0;left:-16px;animation:fscBob 3.6s ease-in-out infinite}.fsc-float.f1 .ic{background:#E7F7EF;color:var(--green)}
.fsc-float.f2{bottom:8px;right:-18px;animation:fscBob 3.6s ease-in-out infinite .7s}.fsc-float.f2 .ic{background:var(--gold-l)}
.fsc-float.f2 small{display:block;color:var(--muted);font-weight:600;font-size:11px}
@keyframes fscBob{50%{transform:translateY(-9px)}}

/* strip */
.fsc-strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--soft)}
.fsc-strip-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:28px 26px}
.fsc-stat .n{font-size:30px;font-weight:800;letter-spacing:-.02em;color:var(--navy);font-family:'Playfair Display',serif}
.fsc-stat .n span{color:var(--faint);font-size:18px}
.fsc-stat .k{font-size:13px;color:var(--muted);margin-top:2px}

/* sections */
.fsc-sec{padding:84px 0}
.fsc-sec.fsc-pad0{padding:84px 0}
.fsc-sec.fsc-pad-t0{padding-top:0}
.fsc-sec-head{max-width:650px;margin:0 auto 48px;text-align:center}
.fsc-sec-head h2{font-size:clamp(28px,3.8vw,46px);margin-top:14px}
.fsc-sec-head p{color:var(--muted);margin-top:14px;font-size:17px}

/* features */
.fsc-feat{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.fsc-fcard{border:1px solid var(--line);border-radius:var(--r-lg);padding:32px;background:#fff;box-shadow:var(--sh-sm);transition:transform .3s,box-shadow .3s}
.fsc-fcard:hover{transform:translateY(-6px);box-shadow:var(--sh)}
.fsc-fchip{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;margin-bottom:18px;color:#fff}
.fsc-fchip.navy{background:linear-gradient(135deg,var(--navy),var(--blue2))}
.fsc-fchip.gold{background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#1a1403}
.fsc-fcard h3{font-size:22px;margin-bottom:9px}
.fsc-fcard p{color:var(--muted);font-size:15px}
.fsc-fcard ul{list-style:none;margin-top:16px;display:flex;flex-direction:column;gap:10px}
.fsc-fcard li{display:flex;gap:9px;font-size:14.5px;align-items:flex-start}
.fsc-fcard li svg{color:var(--green);flex:none;margin-top:1px}

/* proceso block */
.fsc-block{background:linear-gradient(160deg,var(--soft),var(--tint));border-radius:var(--r-lg);padding:64px 40px}
.fsc-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:10px}
.fsc-step{background:#fff;border-radius:var(--r);padding:28px;box-shadow:var(--sh-sm)}
.fsc-step .no{width:46px;height:46px;border-radius:14px;background:var(--navy);color:#fff;font-weight:800;display:grid;place-items:center;font-size:19px;font-family:'Playfair Display',serif}
.fsc-step:nth-child(2) .no{background:var(--gold-d)}.fsc-step:nth-child(3) .no{background:var(--blue2)}
.fsc-step h3{font-size:19px;margin:16px 0 8px}.fsc-step p{color:var(--muted);font-size:14.5px}

/* calculadora */
.fsc-calc{display:grid;grid-template-columns:1fr 1fr;gap:28px;background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:36px;box-shadow:var(--sh);max-width:900px;margin:0 auto}
.fsc-calc-controls label{font-size:13px;font-weight:700;color:var(--muted)}
.fsc-calc-amount{font-size:40px;font-weight:800;color:var(--navy);font-family:'Playfair Display',serif;margin:6px 0 20px}
.fsc-calc-amount small{font-size:16px;color:var(--faint);font-weight:600}
.fsc-calc-controls input[type=range]{width:100%;accent-color:var(--navy);height:6px}
.fsc-calc-range{display:flex;justify-content:space-between;font-size:12px;color:var(--faint);margin-top:8px}
.fsc-calc-results{display:flex;flex-direction:column;gap:12px}
.fsc-calc-box{background:var(--soft);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:2px}
.fsc-calc-box .k{font-size:13px;color:var(--muted);font-weight:600}
.fsc-calc-box .v{font-size:26px;font-weight:800;font-family:'Playfair Display',serif}
.fsc-calc-box .v.muted{color:var(--muted)}
.fsc-calc-box.hero{background:linear-gradient(135deg,var(--navy),var(--navy-d));color:#fff}
.fsc-calc-box.hero .k{color:rgba(255,255,255,.8)}
.fsc-calc-box.hero .v{color:var(--gold-l);font-size:34px}
.fsc-calc-box.hero .sub{font-size:12.5px;color:rgba(255,255,255,.75);margin-top:4px}

/* casos de éxito */
.fsc-caseblock{background:linear-gradient(160deg,var(--navy),var(--navy-d));border-radius:var(--r-lg);padding:64px 40px}
.fsc-cases{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.fsc-case{background:#fff;border-radius:var(--r);padding:26px;box-shadow:var(--sh)}
.fsc-case>.fsc-stars{margin-bottom:14px}
.fsc-case-stat{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}
.fsc-case-stat b{font-size:30px;font-weight:800;color:var(--navy);font-family:'Playfair Display',serif}
.fsc-case-stat span{font-size:13px;color:var(--muted);font-weight:600}
.fsc-case p{font-size:15px;color:var(--ink);line-height:1.5;min-height:92px}
.fsc-case-who{display:flex;align-items:center;gap:11px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
.fsc-case-ava{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#1a1403;font-weight:800;display:grid;place-items:center;font-size:14px}
.fsc-case-who b{display:block;font-size:14.5px}.fsc-case-who span{font-size:12.5px;color:var(--muted)}

/* para quien */
.fsc-who-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;max-width:900px;margin:0 auto}
.fsc-who{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px;box-shadow:var(--sh-sm)}
.fsc-who .ic{font-size:30px;flex:none}
.fsc-who b{font-size:16px}.fsc-who p{color:var(--muted);font-size:14px;margin-top:3px}

/* formulario */
.fsc-contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center}
.fsc-contact-perks{list-style:none;margin:22px 0 0;display:flex;flex-direction:column;gap:11px}
.fsc-contact-perks li{display:flex;gap:9px;font-size:15px;align-items:center}
.fsc-contact-perks svg{color:var(--green);flex:none}
.fsc-form{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:30px;box-shadow:var(--sh);display:flex;flex-direction:column;gap:13px}
.fsc-field{display:flex;flex-direction:column;gap:5px}
.fsc-field-row{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.fsc-form input,.fsc-form select{width:100%;padding:13px 15px;border:1.5px solid var(--line);border-radius:12px;font-size:15px;font-family:'Inter',sans-serif;color:var(--ink);outline:none;transition:border .18s;background:#fff}
.fsc-form input:focus,.fsc-form select:focus{border-color:var(--navy)}
.fsc-err{font-size:12px;color:#E5484D;font-weight:600}
.fsc-form-msg{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;padding:11px 14px;border-radius:11px}
.fsc-form-msg.ok{background:#E7F7EF;color:#0A7D4F}
.fsc-form-msg.bad{background:#FDECEC;color:#C5353A}
.fsc-form-legal{font-size:12px;color:var(--faint);text-align:center;margin-top:2px}

/* final */
.fsc-final{position:relative;text-align:center;background:linear-gradient(150deg,var(--navy),var(--navy-d));color:#fff;border-radius:var(--r-lg);padding:74px 24px;overflow:hidden}
.fsc-final .fb{width:380px;height:380px;background:rgba(201,168,76,.25);top:-150px;right:-50px;filter:blur(70px)}
.fsc-final h2{color:#fff;font-size:clamp(30px,4.6vw,52px);max-width:17ch;margin:14px auto 0;position:relative;z-index:1}
.fsc-final .fsc-btn{margin-top:30px;position:relative;z-index:1}

/* footer */
.fsc-footer{border-top:1px solid var(--line);padding:56px 0 40px;margin-top:40px;background:var(--soft)}
.fsc-foot{display:flex;justify-content:space-between;gap:36px;flex-wrap:wrap}
.fsc-foot>div p{color:var(--muted);font-size:14.5px;margin-top:12px}
.fsc-foot-social{display:flex;gap:10px;margin-top:14px}
.fsc-foot-social a{width:40px;height:40px;border-radius:11px;background:var(--navy);color:#fff;display:grid;place-items:center;transition:transform .2s}
.fsc-foot-social a:hover{transform:translateY(-3px);background:var(--navy-d)}
.fsc-foot-cols{display:flex;gap:56px;flex-wrap:wrap}
.fsc-foot-cols h4{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-bottom:12px;font-weight:800}
.fsc-foot-cols a{display:block;color:var(--muted);font-size:14.5px;padding:5px 0}.fsc-foot-cols a:hover{color:var(--navy)}
.fsc-copy{margin-top:40px;font-size:13px;color:var(--faint);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}

/* whatsapp sticky */
.fsc-wa{position:fixed;bottom:30px;right:30px;width:62px;height:62px;background:linear-gradient(145deg,#25D366,#20BD5A);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(37,211,102,.4);color:#fff;z-index:1030;transition:transform .35s}
.fsc-wa:hover{transform:scale(1.1) translateY(-3px)}

/* reveal */
.fsc-rv{opacity:0;transform:translateY(22px);transition:opacity .7s,transform .7s cubic-bezier(.2,.8,.2,1)}
.fsc-rv.in{opacity:1;transform:none}

/* responsive */
@media(max-width:920px){
  .fsc-hero-grid{grid-template-columns:1fr;gap:42px}
  .fsc-feat,.fsc-steps,.fsc-cases{grid-template-columns:1fr}
  .fsc-calc,.fsc-contact-grid{grid-template-columns:1fr;gap:24px}
  .fsc-who-grid{grid-template-columns:1fr}
}
@media(max-width:760px){
  .fsc-nav-links{display:none}
  .fsc-burger{display:grid;place-items:center}
  .fsc-nav-r .fsc-btn-ghost{display:none}
  .fsc-nav-mobile{display:flex}
  .fsc-strip-grid{grid-template-columns:1fr 1fr;gap:22px}
  .fsc-block,.fsc-caseblock{padding:48px 22px}
  .fsc-sec{padding:62px 0}
  .fsc-field-row{grid-template-columns:1fr}
  .fsc-wa{bottom:20px;right:16px;width:54px;height:54px}
}
`;
