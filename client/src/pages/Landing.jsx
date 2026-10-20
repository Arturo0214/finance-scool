import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, MessageCircle, ArrowUpRight, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';
import ChatSofia from '../components/ChatSofia';
import { getWhatsAppURL, trackWhatsAppClick, trackCalculadoraISR, trackMetaViewContent, initScrollTracking, trackMetaLead } from '../utils/tracking';

/* ============================================================================
   Finance S-Cool — Landing "Casa de Patrimonio"
   Dirección: banca privada / dark-luxury editorial. Navy casi negro + oro
   champán + marfil. Fraunces (display, alto contraste) + Manrope (cuerpo).
   Profundidad con aurora + grain + glass; motion con reveals escalonados.
   Conserva la lógica probada: calculadora ISR 2026, formulario → /api/leads
   (mismo pipeline + ping Telegram), chat Sofia, tracking Meta Pixel.
   ========================================================================== */

const API_URL = import.meta.env.VITE_API_URL || '/api';
const CALENDLY = 'https://calendly.com/ingrid-escobar-grupointegraccion/new-meeting';

// ===== ISR 2026 (lógica reutilizada) =====
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
const CINCO_UMAS_ANUALES = 213973.20;
function calcISR(a) {
  if (a <= 0) return 0;
  for (const b of ISR_TABLE_2026) if (a >= b.limInf && a <= b.limSup) return b.cuota + (a - b.limInf) * b.pct;
  const l = ISR_TABLE_2026[ISR_TABLE_2026.length - 1];
  return l.cuota + (a - l.limInf) * l.pct;
}
function tasaMarginal(a) { for (const b of ISR_TABLE_2026) if (a >= b.limInf && a <= b.limSup) return b.pct; return 0.35; }
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-MX');
const fmtK = (n) => n >= 1e6 ? '$' + (n / 1e6).toFixed(1).replace('.0', '') + 'M' : '$' + Math.round(n / 1000) + 'k';

// ===== hooks =====
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.px-rv').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
function useCountUp(end, duration = 1900) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let raf, t0 = null, done = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done) {
        done = true;
        const step = (t) => { if (!t0) t0 = t; const p = Math.min((t - t0) / duration, 1); const e2 = 1 - Math.pow(1 - p, 3); setN(e2 * end); if (p < 1) raf = requestAnimationFrame(step); else setN(end); };
        raf = requestAnimationFrame(step);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [end, duration]);
  return [n, ref];
}

// Casos (ilustrativos — reemplazar por reales con consentimiento)
const CASOS = [
  { ini: 'AM', nombre: 'Dr. Alejandro M.', rol: 'Cirujano · CDMX', stat: '+$82,000', k: 'recuperados de ISR en su 1ª declaración', quote: 'Lo que pagaba de impuestos hoy regresa a mi retiro. Nunca imaginé que fuera posible ordenarlo así.' },
  { ini: 'LG', nombre: 'Laura G.', rol: 'Fundadora · Guadalajara', stat: '35%', k: 'menos ISR cada año', quote: 'Pasé de no entender nada de impuestos a tener una estrategia clara. Ahorro y deduzco al mismo tiempo.' },
  { ini: 'FR', nombre: 'Familia Ríos', rol: 'Monterrey', stat: '2 en 1', k: 'retiro y protección el mismo mes', quote: 'Protegimos a nuestros hijos y arrancamos nuestro retiro. El acompañamiento fue de principio a fin.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useReveal();

  useEffect(() => { try { initScrollTracking(); trackMetaViewContent({ seccion: 'Landing_Home' }); } catch { /* best-effort */ } }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Stats
  const [s1, r1] = useCountUp(900);
  const [s2, r2] = useCountUp(4.9, 1600);
  const [s3, r3] = useCountUp(10);

  // Calculadora
  const [ingresoMensual, setIngresoMensual] = useState(80000);
  const anual = ingresoMensual * 12;
  const isr = calcISR(anual);
  const marg = tasaMarginal(anual);
  const aportacion = Math.min(anual * 0.10, CINCO_UMAS_ANUALES);
  const devolucion = aportacion * marg;
  const isrOpt = Math.max(0, isr - devolucion);
  const pct = isr > 0 ? Math.round((devolucion / isr) * 100) : 0;
  // proyección ilustrativa del retiro: aportación anual, 20 años, ~8% anual
  const proy = (() => { let v = 0; for (let i = 0; i < 20; i++) v = (v + aportacion) * 1.08; return v; })();
  useEffect(() => { const t = setTimeout(() => { try { trackCalculadoraISR(ingresoMensual, devolucion); } catch { /* noop */ } }, 1200); return () => clearTimeout(t); }, [ingresoMensual, devolucion]);

  // Formulario
  const [form, setForm] = useState({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
  const [errs, setErrs] = useState({});
  const [status, setStatus] = useState('');
  const sanitize = (s) => s.replace(/[<>"'&]/g, '').trim();
  const setF = (k, v) => { setForm((d) => ({ ...d, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };
  const validate = () => {
    const e = {};
    const name = form.name.trim();
    if (!name || name.length < 2) e.name = 'Ingresa tu nombre';
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(name)) e.name = 'Nombre no válido';
    if (!/^\d{10,15}$/.test(form.phone.replace(/[\s\-().+]/g, ''))) e.phone = 'Teléfono válido (10 dígitos)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim().toLowerCase())) e.email = 'Correo no válido';
    if (!form.incomeType) e.incomeType = 'Elige una opción';
    if (!form.approxIncome) e.approxIncome = 'Elige una opción';
    return e;
  };
  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    setStatus('loading');
    try {
      const payload = { name: sanitize(form.name), phone: form.phone.replace(/[^\d+\-() ]/g, ''), email: form.email.trim().toLowerCase(), incomeType: form.incomeType, approxIncome: form.approxIncome, declaracion: form.declaracion, retiroPlan: form.retiroPlan };
      const r = await fetch(`${API_URL}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error();
      setStatus('success');
      try { trackMetaLead({ tipo: 'CTA Landing Form', categoria: payload.incomeType, valor_estimado: 0, ingreso: payload.approxIncome }); } catch { /* noop */ }
      const nm = payload.name, em = payload.email;
      setForm({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
      setTimeout(() => setStatus(''), 4500);
      if (window.Calendly) window.Calendly.initPopupWidget({ url: CALENDLY, prefill: { name: nm, email: em } });
    } catch { setStatus('error'); }
  };

  const goto = (id) => { setNavOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="px">
      <style>{CSS}</style>
      <div className="px-grain" aria-hidden />

      {/* ───── NAV ───── */}
      <nav className={`px-nav ${scrolled ? 'on' : ''}`}>
        <div className="px-wrap px-nav-in">
          <a className="px-brand" href="#top" onClick={(e) => { e.preventDefault(); goto('top'); }}><Logo height={30} layout="inline" variant="light" /></a>
          <div className="px-nav-links">
            <a onClick={() => goto('filosofia')}>Filosofía</a>
            <a onClick={() => goto('pilares')}>Qué hacemos</a>
            <a onClick={() => goto('calculadora')}>Calculadora</a>
            <a onClick={() => goto('casos')}>Resultados</a>
          </div>
          <div className="px-nav-r">
            <button className="px-link" onClick={() => navigate('/login')}>Entrar</button>
            <button className="px-btn px-btn-gold px-sm" onClick={() => goto('contacto')}>Agenda tu diagnóstico</button>
            <button className="px-burger" onClick={() => setNavOpen((o) => !o)} aria-label="Menú">{navOpen ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
        </div>
        {navOpen && (
          <div className="px-nav-mobile">
            <a onClick={() => goto('filosofia')}>Filosofía</a>
            <a onClick={() => goto('pilares')}>Qué hacemos</a>
            <a onClick={() => goto('calculadora')}>Calculadora</a>
            <a onClick={() => goto('casos')}>Resultados</a>
            <button className="px-btn px-btn-gold" onClick={() => goto('contacto')}>Agenda tu diagnóstico</button>
          </div>
        )}
      </nav>

      {/* ───── HERO ───── */}
      <header className="px-hero" id="top">
        <div className="px-aurora" aria-hidden><span className="a a1" /><span className="a a2" /><span className="a a3" /></div>
        <div className="px-rings" aria-hidden />
        <div className="px-wrap px-hero-grid">
          <div className="px-hero-copy">
            <span className="px-eyebrow px-load" style={{ '--d': '0ms' }}><span className="px-dot" /> Patrimonio · Impuestos · Retiro</span>
            <h1 className="px-load" style={{ '--d': '90ms' }}>Haz que el dinero que hoy pagas al SAT <em>construya tu futuro</em>.</h1>
            <p className="px-lede px-load" style={{ '--d': '180ms' }}>
              Diseñamos tu estrategia fiscal y de retiro con un plan deducible. Recuperas parte de tu ISR cada año y lo conviertes en patrimonio — con el respaldo de Prudential.
            </p>
            <div className="px-hero-cta px-load" style={{ '--d': '270ms' }}>
              <button className="px-btn px-btn-gold px-lg" onClick={() => goto('calculadora')}>Calcular mi ahorro <ArrowRight size={18} /></button>
              <button className="px-btn px-btn-ghost px-lg" onClick={() => goto('contacto')}>Hablar con un asesor</button>
            </div>
            <div className="px-hero-trust px-load" style={{ '--d': '360ms' }}>
              <div className="px-stars">★★★★★</div>
              <span><b>4.9/5</b> · +900 familias asesoradas · respaldo <b>Prudential</b></span>
            </div>
          </div>

          {/* Panel de patrimonio */}
          <div className="px-hero-panel px-load" style={{ '--d': '240ms' }}>
            <div className="px-glass">
              <div className="px-glass-top">
                <div>
                  <div className="px-glass-k">Proyección de tu retiro</div>
                  <div className="px-glass-n">{fmtK(proy)}</div>
                  <div className="px-glass-sub">ilustrativo · 20 años con tu plan</div>
                </div>
                <div className="px-glass-badge"><b>−{pct}%</b><span>ISR</span></div>
              </div>
              <HeroChart />
              <div className="px-glass-foot">
                <div className="px-gf"><span>Aportación anual</span><b>{fmt(aportacion)}</b></div>
                <div className="px-gf"><span>Recuperas de ISR</span><b className="gold">~{fmt(devolucion)}</b></div>
              </div>
            </div>
            <div className="px-chip px-chip-1">✓ 100% deducible</div>
            <div className="px-chip px-chip-2">Respaldo Prudential</div>
          </div>
        </div>
        <div className="px-scroll-hint" aria-hidden>Desliza</div>
      </header>

      {/* ───── MARQUEE / TRUST ───── */}
      <div className="px-marquee">
        <div className="px-marquee-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <div className="px-marquee-row" key={k}>
              <span>Estrategia fiscal</span><i>✦</i><span>PPR deducible</span><i>✦</i><span>Retiro con rendimiento</span><i>✦</i><span>Protección familiar</span><i>✦</i><span>Respaldo Prudential</span><i>✦</i><span>Acompañamiento anual</span><i>✦</i>
            </div>
          ))}
        </div>
      </div>

      {/* ───── FILOSOFÍA / EL COSTO ───── */}
      <section id="filosofia" className="px-sec px-dark">
        <div className="px-wrap px-split">
          <div className="px-rv">
            <span className="px-eyebrow dark"><span className="px-dot" /> La verdad incómoda</span>
            <h2 className="px-display">Cada año regalas al SAT dinero que pudo ser <em>tu retiro</em>.</h2>
          </div>
          <div className="px-rv px-split-r">
            <p>La mayoría de los profesionistas de alto ingreso paga impuestos de más y ahorra para su retiro de menos — porque nadie les mostró que es <b>el mismo movimiento</b>.</p>
            <div className="px-leak">
              <div className="px-leak-row"><span>Sin estrategia</span><div className="px-leak-bar"><i style={{ width: '100%' }} /></div><b>{fmt(isr)}</b></div>
              <div className="px-leak-row gold"><span>Con tu plan</span><div className="px-leak-bar"><i style={{ width: `${Math.max(14, 100 - pct)}%` }} /></div><b>{fmt(isrOpt)}</b></div>
              <div className="px-leak-note">Diferencia estimada en tu ISR anual con un ingreso de {fmt(ingresoMensual)}/mes · <button className="px-inline-link" onClick={() => goto('calculadora')}>ajusta tus números →</button></div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── PILARES (filas editoriales) ───── */}
      <section id="pilares" className="px-sec px-ivory">
        <div className="px-wrap">
          <div className="px-sec-head px-rv">
            <span className="px-eyebrow"><span className="px-dot" /> Qué hacemos por ti</span>
            <h2 className="px-display dark">Una sola estrategia.<br /><em>Tres resultados.</em></h2>
          </div>
          <div className="px-pillars">
            {[
              { n: '01', t: 'Pagas menos impuestos', d: 'Un plan deducible baja tu base gravable: aportas, deduces y recuperas en tu declaración parte de lo que hoy entregas de ISR — dentro de los topes del artículo 151.', tags: ['Deducción hasta 10%', 'Devolución anual'] },
              { n: '02', t: 'Construyes tu retiro', d: 'Ese mismo dinero crece con rendimiento real y aportaciones a tu ritmo. Ves la proyección año con año, sin letras chiquitas ni sorpresas.', tags: ['Rendimiento compuesto', 'Proyección clara'] },
              { n: '03', t: 'Proteges a tu familia', d: 'Si algo pasa, los tuyos quedan cubiertos. Tranquilidad patrimonial con el respaldo de una aseguradora global.', tags: ['Cobertura integral', 'Respaldo Prudential'] },
            ].map((p) => (
              <div className="px-pillar px-rv" key={p.n}>
                <div className="px-pillar-n">{p.n}</div>
                <div className="px-pillar-body">
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </div>
                <div className="px-pillar-tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CALCULADORA ───── */}
      <section id="calculadora" className="px-sec px-dark">
        <div className="px-aurora soft" aria-hidden><span className="a a2" /></div>
        <div className="px-wrap">
          <div className="px-sec-head px-rv">
            <span className="px-eyebrow dark"><span className="px-dot" /> Calculadora ISR 2026</span>
            <h2 className="px-display">¿Cuánto podrías <em>recuperar</em> este año?</h2>
            <p className="px-sub">Mueve tu ingreso y velo en tiempo real. Es una estimación; tu asesor afina el número contigo.</p>
          </div>
          <div className="px-calc px-rv">
            <div className="px-calc-l">
              <div className="px-calc-k">Tu ingreso mensual aproximado</div>
              <div className="px-calc-amount">{fmt(ingresoMensual)}<small>/mes</small></div>
              <input type="range" min="15000" max="400000" step="5000" value={ingresoMensual} onChange={(e) => setIngresoMensual(+e.target.value)} className="px-range" style={{ '--p': `${((ingresoMensual - 15000) / (400000 - 15000)) * 100}%` }} />
              <div className="px-calc-range"><span>$15k</span><span>$400k +</span></div>
              <div className="px-calc-mini">
                <div><span>ISR anual hoy</span><b>{fmt(isr)}</b></div>
                <div><span>Aportación sugerida</span><b>{fmt(aportacion)}</b></div>
              </div>
            </div>
            <div className="px-calc-r">
              <div className="px-calc-big-k">Podrías recuperar</div>
              <div className="px-calc-big">~{fmt(devolucion)}</div>
              <div className="px-calc-big-sub">hasta <b>−{pct}%</b> de tu ISR, convertido en tu retiro</div>
              <button className="px-btn px-btn-gold px-lg px-w100" onClick={() => goto('contacto')}>Quiero esta estrategia <ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CASOS / RESULTADOS ───── */}
      <section id="casos" className="px-sec px-ivory">
        <div className="px-wrap">
          <div className="px-rv px-pull">
            <span className="px-eyebrow"><span className="px-dot" /> Resultados reales</span>
            <blockquote className="px-quote">“En tres años pasé de vivir al día a tener un plan de retiro y pagar <em>30% menos de impuestos</em>. Ojalá lo hubiera hecho antes.”</blockquote>
            <div className="px-quote-who"><b>José L.</b> · Empresario · Puebla</div>
          </div>
          <div className="px-cases">
            {CASOS.map((c) => (
              <figure className="px-case px-rv" key={c.ini}>
                <div className="px-case-stat"><b>{c.stat}</b><span>{c.k}</span></div>
                <blockquote>“{c.quote}”</blockquote>
                <figcaption><span className="px-case-ava">{c.ini}</span><span><b>{c.nombre}</b><em>{c.rol}</em></span></figcaption>
              </figure>
            ))}
          </div>
          <div className="px-stats px-rv">
            <div className="px-stat" ref={r1}><b>+{Math.round(s1)}</b><span>familias asesoradas</span></div>
            <div className="px-stat" ref={r2}><b>{s2.toFixed(1)}<i>/5</i></b><span>satisfacción</span></div>
            <div className="px-stat" ref={r3}><b>{Math.round(s3)}+</b><span>años de experiencia</span></div>
            <div className="px-stat"><b>Prudential</b><span>respaldo asegurador</span></div>
          </div>
        </div>
      </section>

      {/* ───── PROCESO ───── */}
      <section className="px-sec px-dark">
        <div className="px-wrap">
          <div className="px-sec-head px-rv">
            <span className="px-eyebrow dark"><span className="px-dot" /> Cómo trabajamos</span>
            <h2 className="px-display">Tres pasos. <em>Cero relleno.</em></h2>
          </div>
          <div className="px-timeline">
            {[
              { h: 'Diagnóstico sin costo', d: '20 minutos. Revisamos tu ingreso, lo que pagas de impuestos y a dónde quieres llegar.' },
              { h: 'Estrategia a tu medida', d: 'Te mostramos con tus cifras cuánto puedes ahorrar y cómo quedaría tu retiro. Tú decides.' },
              { h: 'Acompañamiento anual', d: 'Activamos tu plan y te acompañamos cada año en tu declaración y tus metas.' },
            ].map((s, i) => (
              <div className="px-tl px-rv" key={i}>
                <div className="px-tl-node">{String(i + 1).padStart(2, '0')}</div>
                <h3>{s.h}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CONTACTO ───── */}
      <section id="contacto" className="px-sec px-dark px-contact">
        <div className="px-aurora soft" aria-hidden><span className="a a1" /><span className="a a3" /></div>
        <div className="px-wrap px-contact-grid">
          <div className="px-rv">
            <span className="px-eyebrow dark"><span className="px-dot" /> Diagnóstico sin costo</span>
            <h2 className="px-display" style={{ marginTop: 16 }}>Agenda tu sesión <em>privada</em>.</h2>
            <p className="px-sub" style={{ maxWidth: '42ch' }}>Déjanos tus datos y un asesor te contacta para mostrarte, con tus números, cuánto puedes ahorrar y cómo quedaría tu retiro. Sin compromiso.</p>
            <ul className="px-perks">
              <li><span>✓</span> 20 minutos, por WhatsApp o videollamada</li>
              <li><span>✓</span> Con tus cifras reales, no promesas genéricas</li>
              <li><span>✓</span> Respaldo de Prudential</li>
            </ul>
          </div>
          <form className="px-form px-rv" onSubmit={submit}>
            <div className="px-f"><input placeholder="Nombre completo" value={form.name} onChange={(e) => setF('name', e.target.value)} />{errs.name && <span className="px-err">{errs.name}</span>}</div>
            <div className="px-f"><input placeholder="WhatsApp (10 dígitos)" inputMode="tel" value={form.phone} onChange={(e) => setF('phone', e.target.value)} />{errs.phone && <span className="px-err">{errs.phone}</span>}</div>
            <div className="px-f"><input placeholder="Correo electrónico" inputMode="email" value={form.email} onChange={(e) => setF('email', e.target.value)} />{errs.email && <span className="px-err">{errs.email}</span>}</div>
            <div className="px-f-row">
              <div className="px-f"><select value={form.incomeType} onChange={(e) => setF('incomeType', e.target.value)}><option value="">¿Cómo generas ingresos?</option><option value="empleado">Empleado</option><option value="freelancer">Freelancer / Honorarios</option><option value="empresario">Empresario / Dueño</option><option value="mixto">Mixto</option></select>{errs.incomeType && <span className="px-err">{errs.incomeType}</span>}</div>
              <div className="px-f"><select value={form.approxIncome} onChange={(e) => setF('approxIncome', e.target.value)}><option value="">Ingreso mensual</option><option value="20k-50k">$20k – $50k</option><option value="50k-100k">$50k – $100k</option><option value="100k-200k">$100k – $200k</option><option value="200k+">Más de $200k</option></select>{errs.approxIncome && <span className="px-err">{errs.approxIncome}</span>}</div>
            </div>
            <button className="px-btn px-btn-gold px-lg px-w100" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Enviando…' : <>Agendar mi diagnóstico <ArrowUpRight size={18} /></>}</button>
            {status === 'success' && <div className="px-msg ok">✓ ¡Listo! Un asesor te contactará muy pronto.</div>}
            {status === 'error' && <div className="px-msg bad">Hubo un error. Escríbenos por WhatsApp y te atendemos.</div>}
            <p className="px-legal">🔒 Tus datos están seguros y no se comparten con terceros.</p>
          </form>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="px-footer">
        <div className="px-wrap px-foot">
          <div style={{ maxWidth: 320 }}>
            <a className="px-brand" href="#top" onClick={(e) => { e.preventDefault(); goto('top'); }}><Logo height={30} layout="inline" variant="light" /></a>
            <p>Estrategia fiscal y de retiro con respaldo de Prudential. Pagas menos impuestos y construyes tu patrimonio.</p>
            <a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('footer')} className="px-foot-wa"><MessageCircle size={17} /> WhatsApp</a>
          </div>
          <div className="px-foot-cols">
            <div><h4>Explora</h4><a onClick={() => goto('filosofia')}>Filosofía</a><a onClick={() => goto('pilares')}>Qué hacemos</a><a onClick={() => goto('calculadora')}>Calculadora</a><a onClick={() => goto('casos')}>Resultados</a></div>
            <div><h4>Contacto</h4><a onClick={() => goto('contacto')}>Agenda gratis</a><a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer">WhatsApp</a><a onClick={() => navigate('/login')}>Entrar</a></div>
          </div>
        </div>
        <div className="px-wrap px-copy"><span>© 2026 Finance S-Cool · Hecho en México</span><span>financescool.com.mx</span></div>
      </footer>

      <a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer" className="px-wa" aria-label="WhatsApp" onClick={() => trackWhatsAppClick('sticky')}><MessageCircle size={27} /></a>
      <ChatSofia />
    </div>
  );
}

// Curva de patrimonio (SVG) para el panel del hero
function HeroChart() {
  return (
    <svg className="px-chart" viewBox="0 0 320 130" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="pxArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D8B257" stopOpacity="0.42" />
          <stop offset="1" stopColor="#D8B257" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pxLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B88A3A" />
          <stop offset="1" stopColor="#F0D99A" />
        </linearGradient>
      </defs>
      {[30, 60, 90].map((y) => <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,.06)" />)}
      <path d="M0,120 C60,112 90,96 140,80 C190,64 230,40 320,12 L320,130 L0,130 Z" fill="url(#pxArea)" />
      <path d="M0,120 C60,112 90,96 140,80 C190,64 230,40 320,12" fill="none" stroke="url(#pxLine)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="320" cy="12" r="4.5" fill="#F0D99A" />
      <circle cx="320" cy="12" r="9" fill="#F0D99A" opacity="0.25" />
    </svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Manrope:wght@400;500;600;700;800&display=swap');
.px{
  --ink:#080B14;--ink2:#0C1120;--panel:#111831;--navy:#0E2552;--navy2:#143069;
  --ivory:#F6F1E6;--ivory2:#EFE8D8;--cream-ink:#1A1D26;
  --gold:#C9A24B;--gold-l:#E8CE8B;--gold-d:#9A7A2E;--line-d:rgba(232,206,139,.16);
  --txt-d:rgba(246,241,230,.72);--txt-dim:rgba(246,241,230,.5);
  --r:18px;--r-lg:26px;
  font-family:'Manrope',system-ui,sans-serif;color:var(--ivory);background:var(--ink);
  font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden;position:relative}
.px *{margin:0;padding:0;box-sizing:border-box}
.px h1,.px h2,.px h3,.px .px-display{font-family:'Fraunces',Georgia,serif;font-weight:600;line-height:1.04;letter-spacing:-.018em}
.px h1 em,.px h2 em,.px .px-display em,.px-quote em{font-style:italic;color:var(--gold-l);font-weight:600}
.px a{color:inherit;text-decoration:none;cursor:pointer}
.px-wrap{max-width:1180px;margin:0 auto;padding:0 28px;position:relative;z-index:2}

/* grain */
.px-grain{position:fixed;inset:0;z-index:9;pointer-events:none;opacity:.05;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* eyebrow / dot / buttons */
.px-eyebrow{display:inline-flex;align-items:center;gap:9px;font-family:'Manrope';font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-l)}
.px-eyebrow.dark{color:var(--gold-l)}
.px-ivory .px-eyebrow{color:var(--gold-d)}
.px-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 12px var(--gold)}
.px-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:'Manrope';font-weight:700;font-size:15.5px;padding:13px 24px;border-radius:12px;cursor:pointer;border:1px solid transparent;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,background .25s,color .25s}
.px-btn.px-sm{padding:9px 18px;font-size:13.5px}
.px-btn.px-lg{padding:15px 28px;font-size:16px}
.px-btn.px-w100{width:100%}
.px-btn-gold{position:relative;background:linear-gradient(100deg,var(--gold-d),var(--gold) 45%,var(--gold-l));color:#1a1203;box-shadow:0 14px 30px -12px rgba(201,162,75,.6);overflow:hidden}
.px-btn-gold::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:translateX(-120%);transition:transform .7s}
.px-btn-gold:hover{transform:translateY(-3px);box-shadow:0 20px 40px -12px rgba(201,162,75,.75)}
.px-btn-gold:hover::after{transform:translateX(120%)}
.px-btn-ghost{background:transparent;color:var(--ivory);border-color:rgba(246,241,230,.28)}
.px-btn-ghost:hover{border-color:var(--gold-l);color:var(--gold-l);transform:translateY(-3px)}
.px-ivory .px-btn-ghost{color:var(--cream-ink);border-color:rgba(20,29,38,.2)}
.px-link{background:none;border:none;color:var(--txt-d);font-family:'Manrope';font-weight:600;font-size:14.5px;cursor:pointer;transition:color .2s}
.px-link:hover{color:var(--gold-l)}
.px-inline-link{background:none;border:none;color:var(--gold-d);font-family:'Manrope';font-weight:700;font-size:inherit;cursor:pointer}
.px-ivory .px-inline-link{color:var(--gold-d)}

/* nav */
.px-nav{position:sticky;top:0;z-index:50;transition:background .3s,border-color .3s,backdrop-filter .3s;border-bottom:1px solid transparent}
.px-nav.on{background:rgba(8,11,20,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--line-d)}
.px-nav-in{display:flex;align-items:center;justify-content:space-between;height:74px}
.px-brand{display:flex;align-items:center}
.px-nav-links{display:flex;gap:34px;font-size:14.5px;font-weight:600;color:var(--txt-d)}
.px-nav-links a{position:relative}
.px-nav-links a:hover{color:var(--gold-l)}
.px-nav-r{display:flex;align-items:center;gap:16px}
.px-burger{display:none;background:none;border:none;color:var(--ivory);cursor:pointer}
.px-nav-mobile{display:none;flex-direction:column;gap:6px;padding:16px 28px 24px;background:rgba(8,11,20,.96);border-bottom:1px solid var(--line-d)}
.px-nav-mobile a{padding:11px 0;font-weight:600;color:var(--ivory)}
.px-nav-mobile .px-btn{margin-top:10px}

/* hero */
.px-hero{position:relative;padding:72px 0 92px;overflow:hidden;background:
  radial-gradient(120% 100% at 80% -10%, #13234b 0%, transparent 55%),
  radial-gradient(90% 90% at 0% 110%, #1a1430 0%, transparent 50%),
  var(--ink)}
.px-aurora{position:absolute;inset:0;z-index:0;pointer-events:none;filter:blur(60px);opacity:.9}
.px-aurora.soft{opacity:.5}
.px-aurora .a{position:absolute;border-radius:50%}
.px-aurora .a1{width:520px;height:520px;background:radial-gradient(circle,rgba(201,162,75,.22),transparent 68%);top:-160px;right:-120px;animation:pxFloat 14s ease-in-out infinite}
.px-aurora .a2{width:460px;height:460px;background:radial-gradient(circle,rgba(30,74,150,.4),transparent 70%);bottom:-180px;left:-120px;animation:pxFloat 18s ease-in-out infinite reverse}
.px-aurora .a3{width:300px;height:300px;background:radial-gradient(circle,rgba(232,206,139,.14),transparent 70%);top:40%;left:46%;animation:pxFloat 20s ease-in-out infinite}
@keyframes pxFloat{50%{transform:translate(28px,-26px) scale(1.08)}}
.px-rings{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background-image:repeating-radial-gradient(circle at 82% 14%,transparent 0,transparent 58px,rgba(232,206,139,.06) 59px,transparent 60px)}
.px-hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:54px;align-items:center;padding-top:36px}
.px-hero-copy h1{font-size:clamp(40px,5.6vw,72px);margin:22px 0;font-weight:600}
.px-lede{font-size:clamp(16px,1.7vw,19px);color:var(--txt-d);max-width:40ch;margin-bottom:32px}
.px-hero-cta{display:flex;gap:14px;flex-wrap:wrap}
.px-hero-trust{display:flex;align-items:center;gap:12px;margin-top:30px;font-size:13.5px;color:var(--txt-dim)}
.px-hero-trust b{color:var(--ivory);font-weight:700}
.px-stars{color:var(--gold-l);letter-spacing:2px;font-size:14px}

/* hero panel */
.px-hero-panel{position:relative}
.px-glass{position:relative;z-index:2;background:linear-gradient(160deg,rgba(28,38,68,.72),rgba(14,20,38,.72));border:1px solid var(--line-d);border-radius:var(--r-lg);padding:26px;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 40px 90px -30px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.06)}
.px-glass-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
.px-glass-k{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--txt-dim);font-weight:700}
.px-glass-n{font-family:'Fraunces',serif;font-size:42px;font-weight:600;color:var(--gold-l);line-height:1.05;margin-top:6px;letter-spacing:-.02em}
.px-glass-sub{font-size:11.5px;color:var(--txt-dim);margin-top:4px}
.px-glass-badge{text-align:center;background:rgba(201,162,75,.14);border:1px solid var(--line-d);border-radius:12px;padding:8px 12px}
.px-glass-badge b{display:block;font-family:'Fraunces',serif;font-size:19px;color:var(--gold-l);line-height:1}
.px-glass-badge span{font-size:9.5px;letter-spacing:.14em;color:var(--txt-dim);font-weight:700}
.px-chart{width:100%;height:120px;display:block}
.px-glass-foot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line-d)}
.px-gf span{display:block;font-size:11.5px;color:var(--txt-dim);margin-bottom:3px}
.px-gf b{font-family:'Fraunces',serif;font-size:19px;color:var(--ivory)}
.px-gf b.gold{color:var(--gold-l)}
.px-chip{position:absolute;z-index:3;background:rgba(8,11,20,.85);border:1px solid var(--line-d);border-radius:11px;padding:9px 14px;font-size:12.5px;font-weight:700;color:var(--ivory);backdrop-filter:blur(8px);box-shadow:0 14px 30px -12px rgba(0,0,0,.6)}
.px-chip-1{top:-16px;left:-18px;color:var(--gold-l);animation:pxBob 4s ease-in-out infinite}
.px-chip-2{bottom:24px;right:-20px;animation:pxBob 4s ease-in-out infinite 1s}
@keyframes pxBob{50%{transform:translateY(-9px)}}
.px-scroll-hint{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--txt-dim);z-index:2}
.px-scroll-hint::after{content:'';display:block;width:1px;height:26px;margin:8px auto 0;background:linear-gradient(var(--gold),transparent);animation:pxLine 2.2s ease-in-out infinite}
@keyframes pxLine{0%,100%{opacity:.3;transform:scaleY(.6)}50%{opacity:1;transform:scaleY(1)}}

/* load animation (hero) */
.px-load{opacity:0;transform:translateY(20px);animation:pxUp .9s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--d)}
@keyframes pxUp{to{opacity:1;transform:none}}

/* marquee */
.px-marquee{background:var(--ink2);border-top:1px solid var(--line-d);border-bottom:1px solid var(--line-d);overflow:hidden;padding:17px 0}
.px-marquee-track{display:flex;width:max-content;animation:pxMarq 32s linear infinite}
.px-marquee-row{display:flex;align-items:center;gap:26px;padding-right:26px;font-family:'Fraunces',serif;font-size:17px;font-style:italic;color:var(--txt-d);white-space:nowrap}
.px-marquee-row i{color:var(--gold);font-style:normal;font-size:12px}
@keyframes pxMarq{to{transform:translateX(-50%)}}

/* sections */
.px-sec{padding:104px 0;position:relative;overflow:hidden}
.px-dark{background:var(--ink)}
.px-ivory{background:var(--ivory);color:var(--cream-ink)}
.px-ivory .px-display,.px-ivory h2,.px-ivory h3{color:var(--cream-ink)}
.px-ivory .px-display em,.px-ivory .px-quote em{color:var(--gold-d)}
.px-sec-head{max-width:720px;margin:0 auto 60px;text-align:center}
.px-sec-head h2{font-size:clamp(30px,4.2vw,54px);margin-top:16px}
.px-sub{color:var(--txt-d);margin-top:16px;font-size:17px}
.px-ivory .px-sub{color:#6B6655}
.px-display{font-size:clamp(30px,4.2vw,54px)}

/* split filosofía */
.px-split{display:grid;grid-template-columns:1.04fr .96fr;gap:56px;align-items:center}
.px-split h2{font-size:clamp(32px,4.4vw,56px)}
.px-split-r p{color:var(--txt-d);font-size:18px}
.px-split-r b{color:var(--ivory)}
.px-leak{margin-top:26px;background:linear-gradient(160deg,rgba(28,38,68,.5),rgba(14,20,38,.5));border:1px solid var(--line-d);border-radius:var(--r);padding:22px}
.px-leak-row{display:grid;grid-template-columns:96px 1fr auto;align-items:center;gap:14px;margin-bottom:12px;font-size:13.5px;font-weight:600;color:var(--txt-d)}
.px-leak-row b{font-family:'Fraunces',serif;font-size:18px;color:var(--ivory)}
.px-leak-row.gold b{color:var(--gold-l)}
.px-leak-bar{height:9px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}
.px-leak-bar i{display:block;height:100%;border-radius:6px;background:rgba(246,241,230,.3)}
.px-leak-row.gold .px-leak-bar i{background:linear-gradient(90deg,var(--gold-d),var(--gold-l))}
.px-leak-note{font-size:12.5px;color:var(--txt-dim);margin-top:8px}

/* pilares */
.px-pillars{border-top:1px solid rgba(20,29,38,.12)}
.px-pillar{display:grid;grid-template-columns:120px 1fr 260px;gap:32px;align-items:start;padding:40px 0;border-bottom:1px solid rgba(20,29,38,.12);transition:background .3s}
.px-pillar:hover{background:rgba(201,162,75,.05)}
.px-pillar-n{font-family:'Fraunces',serif;font-size:56px;font-weight:600;color:var(--gold-d);line-height:.9;opacity:.85}
.px-pillar-body h3{font-size:clamp(22px,2.4vw,30px);margin-bottom:10px}
.px-pillar-body p{color:#5A5547;font-size:15.5px;max-width:52ch}
.px-ivory .px-pillar-body p{color:#5A5547}
.px-pillar-tags{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.px-pillar-tags span{font-size:12.5px;font-weight:700;color:var(--gold-d);background:rgba(201,162,75,.12);border:1px solid rgba(201,162,75,.25);padding:6px 13px;border-radius:100px}

/* calculadora */
.px-calc{display:grid;grid-template-columns:1.1fr 1fr;gap:0;max-width:960px;margin:0 auto;border:1px solid var(--line-d);border-radius:var(--r-lg);overflow:hidden;background:linear-gradient(160deg,rgba(28,38,68,.5),rgba(14,20,38,.6));backdrop-filter:blur(14px)}
.px-calc-l{padding:40px}
.px-calc-k{font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--txt-dim);font-weight:700}
.px-calc-amount{font-family:'Fraunces',serif;font-size:46px;font-weight:600;color:var(--ivory);margin:8px 0 26px;letter-spacing:-.02em}
.px-calc-amount small{font-size:17px;color:var(--txt-dim);font-weight:400}
.px-range{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:5px;background:linear-gradient(90deg,var(--gold) var(--p),rgba(255,255,255,.12) var(--p));outline:none}
.px-range::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(145deg,var(--gold-l),var(--gold-d));cursor:pointer;box-shadow:0 2px 12px rgba(201,162,75,.7),0 0 0 5px rgba(201,162,75,.15)}
.px-range::-moz-range-thumb{width:22px;height:22px;border:none;border-radius:50%;background:linear-gradient(145deg,var(--gold-l),var(--gold-d));cursor:pointer}
.px-calc-range{display:flex;justify-content:space-between;font-size:11.5px;color:var(--txt-dim);margin-top:10px}
.px-calc-mini{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;padding-top:24px;border-top:1px solid var(--line-d)}
.px-calc-mini span{display:block;font-size:12px;color:var(--txt-dim);margin-bottom:4px}
.px-calc-mini b{font-family:'Fraunces',serif;font-size:21px;color:var(--ivory)}
.px-calc-r{padding:40px;background:linear-gradient(160deg,rgba(201,162,75,.14),rgba(201,162,75,.04));display:flex;flex-direction:column;justify-content:center;border-left:1px solid var(--line-d)}
.px-calc-big-k{font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-l);font-weight:700}
.px-calc-big{font-family:'Fraunces',serif;font-size:clamp(44px,6vw,62px);font-weight:600;color:var(--gold-l);line-height:1;margin:8px 0}
.px-calc-big-sub{color:var(--txt-d);font-size:14px;margin-bottom:24px}
.px-calc-big-sub b{color:var(--ivory)}

/* casos */
.px-pull{max-width:860px;margin:0 auto 64px;text-align:center}
.px-quote{font-family:'Fraunces',serif;font-size:clamp(26px,3.4vw,40px);font-weight:500;line-height:1.3;margin-top:22px;letter-spacing:-.01em}
.px-quote-who{margin-top:22px;font-size:14.5px;color:#7a7462}
.px-quote-who b{color:var(--cream-ink)}
.px-cases{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.px-case{background:#fff;border:1px solid rgba(20,29,38,.08);border-radius:var(--r);padding:28px;box-shadow:0 20px 50px -28px rgba(20,29,38,.3);transition:transform .3s,box-shadow .3s}
.px-case:hover{transform:translateY(-6px);box-shadow:0 30px 60px -28px rgba(20,29,38,.4)}
.px-case-stat{margin-bottom:16px}
.px-case-stat b{display:block;font-family:'Fraunces',serif;font-size:36px;color:var(--gold-d);line-height:1}
.px-case-stat span{font-size:12.5px;color:#7a7462;font-weight:600}
.px-case blockquote{font-size:15px;color:#4a4638;line-height:1.55;min-height:92px}
.px-case figcaption{display:flex;align-items:center;gap:11px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(20,29,38,.08)}
.px-case-ava{width:42px;height:42px;border-radius:12px;background:linear-gradient(145deg,var(--gold),var(--gold-d));color:#1a1203;font-weight:800;display:grid;place-items:center;font-size:14px;font-family:'Manrope'}
.px-case figcaption b{display:block;font-size:14.5px;color:var(--cream-ink)}
.px-case figcaption em{font-style:normal;font-size:12.5px;color:#7a7462}
.px-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:56px;padding-top:44px;border-top:1px solid rgba(20,29,38,.12)}
.px-stat{text-align:center}
.px-stat b{display:block;font-family:'Fraunces',serif;font-size:clamp(30px,4vw,44px);color:var(--cream-ink);line-height:1}
.px-stat b i{font-style:normal;font-size:.5em;color:#aaa392}
.px-stat span{font-size:13px;color:#7a7462;margin-top:6px;display:block}

/* timeline */
.px-timeline{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.px-tl{position:relative;padding-top:30px;border-top:1px solid var(--line-d)}
.px-tl-node{position:absolute;top:-19px;left:0;width:38px;height:38px;border-radius:50%;background:var(--ink);border:1px solid var(--gold);color:var(--gold-l);font-family:'Fraunces',serif;font-size:15px;display:grid;place-items:center}
.px-tl h3{font-size:22px;margin-bottom:10px}
.px-tl p{color:var(--txt-d);font-size:15px}

/* contacto */
.px-contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.px-perks{list-style:none;margin-top:26px;display:flex;flex-direction:column;gap:13px}
.px-perks li{display:flex;align-items:center;gap:11px;font-size:15px;color:var(--txt-d)}
.px-perks li span{width:24px;height:24px;flex:none;border-radius:50%;background:rgba(201,162,75,.16);color:var(--gold-l);display:grid;place-items:center;font-size:12px;font-weight:800}
.px-form{background:linear-gradient(160deg,rgba(28,38,68,.6),rgba(14,20,38,.7));border:1px solid var(--line-d);border-radius:var(--r-lg);padding:32px;backdrop-filter:blur(14px);display:flex;flex-direction:column;gap:13px;box-shadow:0 40px 90px -36px rgba(0,0,0,.7)}
.px-f{display:flex;flex-direction:column;gap:5px}
.px-f-row{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.px-form input,.px-form select{width:100%;padding:14px 16px;border:1px solid rgba(246,241,230,.16);border-radius:12px;font-size:15px;font-family:'Manrope';color:var(--ivory);background:rgba(8,11,20,.5);outline:none;transition:border .2s}
.px-form input::placeholder{color:var(--txt-dim)}
.px-form select{color:var(--ivory)}
.px-form option{background:#0c1120;color:var(--ivory)}
.px-form input:focus,.px-form select:focus{border-color:var(--gold)}
.px-err{font-size:12px;color:#E8927A;font-weight:600}
.px-msg{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;padding:12px 15px;border-radius:11px}
.px-msg.ok{background:rgba(126,155,134,.18);color:#A6D6B4}
.px-msg.bad{background:rgba(232,146,122,.16);color:#E8A79A}
.px-legal{font-size:12px;color:var(--txt-dim);text-align:center;margin-top:2px}

/* footer */
.px-footer{background:var(--ink2);border-top:1px solid var(--line-d);padding:60px 0 40px}
.px-foot{display:flex;justify-content:space-between;gap:40px;flex-wrap:wrap}
.px-foot>div p{color:var(--txt-dim);font-size:14.5px;margin-top:14px;max-width:320px}
.px-foot-wa{display:inline-flex;align-items:center;gap:8px;margin-top:16px;color:var(--gold-l);font-weight:600;font-size:14px}
.px-foot-cols{display:flex;gap:60px;flex-wrap:wrap}
.px-foot-cols h4{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-d);margin-bottom:14px;font-weight:800}
.px-foot-cols a{display:block;color:var(--txt-d);font-size:14.5px;padding:6px 0}.px-foot-cols a:hover{color:var(--gold-l)}
.px-copy{margin-top:44px;padding-top:24px;border-top:1px solid var(--line-d);font-size:12.5px;color:var(--txt-dim);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}

/* whatsapp */
.px-wa{position:fixed;bottom:28px;right:28px;width:60px;height:60px;border-radius:50%;background:linear-gradient(145deg,#25D366,#1EA952);display:flex;align-items:center;justify-content:center;color:#fff;z-index:40;box-shadow:0 12px 32px rgba(37,211,102,.4);transition:transform .35s}
.px-wa:hover{transform:scale(1.1) translateY(-3px)}

/* reveal */
.px-rv{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}
.px-rv.in{opacity:1;transform:none}

/* responsive */
@media(max-width:940px){
  .px-hero-grid,.px-split,.px-calc,.px-contact-grid{grid-template-columns:1fr}
  .px-hero-grid{gap:48px;padding-top:12px}
  .px-hero-panel{max-width:440px}
  .px-split{gap:34px}
  .px-pillars .px-pillar{grid-template-columns:70px 1fr;gap:20px}
  .px-pillar-tags{grid-column:2;flex-direction:row;flex-wrap:wrap;margin-top:6px}
  .px-cases,.px-timeline{grid-template-columns:1fr}
  .px-calc-r{border-left:none;border-top:1px solid var(--line-d)}
  .px-scroll-hint{display:none}
}
@media(max-width:720px){
  .px-nav-links{display:none}
  .px-nav-r .px-link{display:none}
  .px-burger{display:grid;place-items:center}
  .px-nav-mobile{display:flex}
  .px-sec{padding:72px 0}
  .px-stats{grid-template-columns:1fr 1fr;gap:28px}
  .px-f-row{grid-template-columns:1fr}
  .px-chip-2{right:0}
  .px-wa{bottom:18px;right:16px;width:52px;height:52px}
}
`;
