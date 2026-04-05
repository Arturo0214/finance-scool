import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, MessageCircle, BarChart3, Lightbulb, Target, Wallet, Clock, Landmark, TrendingUp, GraduationCap, Briefcase, FileText, Shield, Brain, Users, CheckCircle, Camera, Linkedin, Volume2, VolumeX, Heart, PiggyBank, HandCoins } from 'lucide-react';
import Logo from '../components/Logo';

// ==================== ISR 2026 Tax Calculator Logic ====================
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

const UMA_ANUAL = 39606.36;
const CINCO_UMAS = UMA_ANUAL * 5; // ~198,031.80 but doc says 213,973.20 with UMA 2024 108.57
const UMA_DIARIA = 117.16; // 2026
const CINCO_UMAS_ANUALES = 213973.20;
const VALOR_UDI = 8.672954;

function calcISR(ingreso) {
  if (ingreso <= 0) return 0;
  for (const bracket of ISR_TABLE_2026) {
    if (ingreso >= bracket.limInf && ingreso <= bracket.limSup) {
      const excedente = ingreso - bracket.limInf;
      return bracket.cuota + excedente * bracket.pct;
    }
  }
  const last = ISR_TABLE_2026[ISR_TABLE_2026.length - 1];
  const excedente = ingreso - last.limInf;
  return last.cuota + excedente * last.pct;
}

function getMarginalRate(ingreso) {
  for (const bracket of ISR_TABLE_2026) {
    if (ingreso >= bracket.limInf && ingreso <= bracket.limSup) {
      return bracket.pct;
    }
  }
  return 0.35;
}

const TUITION_LIMITS = {
  preescolar: 14200,
  primaria: 12900,
  secundaria: 19900,
  profesional_tecnico: 17100,
  bachillerato: 24500,
};

// ==================== Lazy Video Component ====================
function LazyVideo({ src, className, style, globalMuted = true }) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);

  // Lazy load: start loading when near viewport
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoaded(true); obs.disconnect(); } }, { rootMargin: '200px' });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Track if currently in viewport (for sound)
  useEffect(() => {
    if (!videoRef.current) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.5 });
    obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, [loaded]);

  // Only unmute if globalMuted is off AND this video is in view
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted || !inView;
    }
  }, [globalMuted, inView]);

  return (
    <div ref={ref} className={className} style={style}>
      {loaded && <video ref={videoRef} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}><source src={src} type="video/mp4" /></video>}
    </div>
  );
}

// ==================== Animated Counter Hook (rAF optimized) ====================
function useCountUp(end, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!startOnView) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { setStarted(true); obs.disconnect(); } }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    let startTime = null;
    let rafId;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) { rafId = requestAnimationFrame(animate); }
      else { setCount(end); }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [started, end, duration]);
  return [count, ref];
}

// ==================== Component ====================
export default function Landing() {
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', incomeType: '', approxIncome: '',
    declaracion: '', retiroPlan: ''
  });
  const [formStatus, setFormStatus] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [heroSlide, setHeroSlide] = useState(0);
  const [visibleSections, setVisibleSections] = useState({});
  const [isMuted, setIsMuted] = useState(true);
  const [heroInView, setHeroInView] = useState(true);
  const heroVideoRefs = useRef([]);
  const heroSectionRef = useRef(null);
  const observerRefs = useRef([]);
  const sectionRefs = useRef({});
  const navigate = useNavigate();

  // Animated counters for trust bar
  const [trustCount1, trustRef1] = useCountUp(900, 2000);
  const [trustCount2, trustRef2] = useCountUp(100, 1500);
  const [trustCount3, trustRef3] = useCountUp(10, 1200);

  // Live "people requesting" counter (random 6-20, changes every 8s)
  const [liveUsers, setLiveUsers] = useState(() => Math.floor(Math.random() * 15) + 6);
  useEffect(() => {
    const interval = setInterval(() => setLiveUsers(Math.floor(Math.random() * 15) + 6), 30000);
    return () => clearInterval(interval);
  }, []);

  // Hero carousel slides with videos
  const heroSlides = [
    {
      video: '/assets/hero-shield.mp4',
      title: 'Tu dinero puede hacer más por ti',
      subtitle: 'cuando entiendes cómo moverlo con estrategia',
      stat: '$1,250,000+ MXN',
      statLabel: 'Proyección estimada a 25 años',
    },
    {
      video: '/assets/man-points.mp4',
      title: 'Menos impuestos, más patrimonio',
      subtitle: 'Conecta ahorro, retiro y deducción fiscal de forma inteligente',
      stat: 'Hasta 30%',
      statLabel: 'Devolución estimada de impuestos',
    },
    {
      video: '/assets/flow.mp4',
      title: 'Planea hoy, vive tranquilo mañana',
      subtitle: 'Cada año que esperas, necesitas ahorrar más para llegar al mismo objetivo',
      stat: '25+ años',
      statLabel: 'De crecimiento compuesto a tu favor',
    },
  ];

  // Auto-rotate carousel — wait for current video to finish, then advance
  useEffect(() => {
    const video = heroVideoRefs.current[heroSlide];
    if (!video) return;
    // Restart from beginning so user sees full video
    video.currentTime = 0;
    video.loop = false;
    const onEnded = () => {
      setHeroSlide((prev) => (prev + 1) % heroSlides.length);
    };
    video.addEventListener('ended', onEnded);
    // Fallback: if video is very long (>30s), advance anyway
    const fallback = setTimeout(onEnded, 30000);
    return () => {
      video.removeEventListener('ended', onEnded);
      clearTimeout(fallback);
      video.loop = true;
    };
  }, [heroSlide]);

  // Track hero section visibility — mute all hero videos when scrolled away
  useEffect(() => {
    if (!heroSectionRef.current) return;
    const obs = new IntersectionObserver(([e]) => setHeroInView(e.isIntersecting), { threshold: 0.1 });
    obs.observe(heroSectionRef.current);
    return () => obs.disconnect();
  }, []);

  // Sync mute state on hero videos — only active slide plays sound AND only when hero is in view
  useEffect(() => {
    heroVideoRefs.current.forEach((v, i) => {
      if (v) v.muted = isMuted || !heroInView || i !== heroSlide;
    });
  }, [isMuted, heroSlide, heroInView]);

  // Tax calculator state
  const [taxCalc, setTaxCalc] = useState({
    ingresoAnual: 1200000,
    otrosIngresos: 0,
    medicos: 0,
    funerarios: 0,
    donativos: 0,
    hipotecarios: 0,
    seguroGMM: 0,
    transporteEscolar: 0,
    numHijos: 0,
    hijos: [],
    art185: 0,
    ppr: 100000,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate tax results
  const calcTaxResults = () => {
    const totalIngresos = taxCalc.ingresoAnual + taxCalc.otrosIngresos;
    if (totalIngresos <= 0) return { sinDed: 0, conDedSinRetiro: 0, conDedConRetiro: 0, devolucion: 0, ingresoReal: 0, mensual: 0, pctRecup: 0 };

    // Personal deduction caps
    const capFunerarios = 42794.64;
    const capDonativos = totalIngresos * 0.07;
    const capPersonalTotal = Math.min(totalIngresos * 0.15, CINCO_UMAS_ANUALES);

    let totalPersonal = 0;
    totalPersonal += taxCalc.medicos;
    totalPersonal += Math.min(taxCalc.funerarios, capFunerarios);
    totalPersonal += Math.min(taxCalc.donativos, capDonativos);
    totalPersonal += taxCalc.hipotecarios;
    totalPersonal += taxCalc.seguroGMM;
    totalPersonal += taxCalc.transporteEscolar;

    // Tuition deductions
    taxCalc.hijos.forEach((hijo) => {
      if (hijo.nivel && hijo.monto > 0) {
        const limit = TUITION_LIMITS[hijo.nivel] || 0;
        totalPersonal += Math.min(hijo.monto, limit);
      }
    });

    totalPersonal = Math.min(totalPersonal, capPersonalTotal);

    // Retirement deductions
    const capPPR = Math.min(totalIngresos * 0.10, CINCO_UMAS_ANUALES);
    const capArt185 = 152000;
    const dedArt185 = Math.min(taxCalc.art185, capArt185);
    const dedPPR = Math.min(taxCalc.ppr, capPPR);
    const totalRetiro = dedArt185 + dedPPR;

    // ISR calculations
    const isrSinDed = calcISR(totalIngresos);
    const isrConDedSinRetiro = calcISR(totalIngresos - totalPersonal);
    const isrConDedConRetiro = calcISR(totalIngresos - totalPersonal - totalRetiro);

    const devolucion = isrSinDed - isrConDedConRetiro;
    const ingresoReal = totalIngresos - isrConDedConRetiro;
    const mensual = ingresoReal / 12;
    const pctRecup = totalIngresos > 0 ? getMarginalRate(totalIngresos) * 100 : 0;

    // What they're losing by not using deductions (capped to income)
    const maxDeduciblePersonal = capPersonalTotal;
    const maxDeducibleRetiro = capPPR + capArt185;
    const maxDeducibleTotal = Math.min(maxDeduciblePersonal + maxDeducibleRetiro, totalIngresos);
    const deduciblesNoUsados = Math.max(0, maxDeducibleTotal - totalPersonal - totalRetiro);

    return {
      totalIngresos,
      totalPersonal,
      totalRetiro,
      isrSinDed,
      isrConDedSinRetiro,
      isrConDedConRetiro,
      devolucion,
      devolucionSinRetiro: isrSinDed - isrConDedSinRetiro,
      ingresoReal,
      ingresoRealSinDed: totalIngresos - isrSinDed,
      mensual,
      pctRecup,
      maxDeduciblePersonal,
      maxDeducibleRetiro,
      deduciblesNoUsados,
      capPPR,
    };
  };

  const taxResults = calcTaxResults();

  // Scroll effects (throttled + passive)
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsNavScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('slide-up');
          const id = entry.target.dataset.section;
          if (id) setVisibleSections(prev => ({ ...prev, [id]: true }));
        }
      }),
      { threshold: 0.1 }
    );
    observerRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    Object.values(sectionRefs.current).forEach((ref) => { if (ref) observer.observe(ref); });

    return () => observer.disconnect();
  }, []);

  // Pause infinite animations when sections are out of viewport
  useEffect(() => {
    const animObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        entry.target.classList.toggle('anim-paused', !entry.isIntersecting);
      }),
      { rootMargin: '100px 0px' }
    );
    document.querySelectorAll('.landing-section').forEach((s) => animObserver.observe(s));
    return () => animObserver.disconnect();
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('loading');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormStatus('success');
        setFormData({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
        setTimeout(() => setFormStatus(''), 3000);
      } else { setFormStatus('error'); }
    } catch { setFormStatus('error'); }
  };

  const formatMXN = (n) => {
    if (n === undefined || n === null || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('es-MX');
  };

  const faqItems = [
    { question: '¿Cuáles son las deducciones fiscales autorizadas?', answer: 'Las principales son: honorarios médicos y dentales, gastos funerarios, donativos, intereses reales por créditos hipotecarios, seguro de gastos médicos mayores y transporte escolar obligatorio. Cada una tiene topes específicos conforme a la ley.' },
    { question: '¿Cuánto puedo deducir de la escuela de mis hijos?', answer: 'Depende del nivel educativo. Preescolar: $14,200, Primaria: $12,900, Secundaria: $19,900, Profesional técnico: $17,100 y Bachillerato: $24,500 anuales por hijo. Estos montos son los topes máximos deducibles.' },
    { question: '¿Hay algún artículo para deducción de retiro?', answer: 'Sí, los artículos 151 y 185 de la LISR. Sin embargo, no aplican para todos los casos — necesitas un especialista fiscal que analice tu situación particular para determinar cuál te conviene y cómo aplicarlos correctamente.' },
    { question: '¿Qué me conviene, exentar o deducir? ¿Puedo aplicar ambas?', answer: 'En algunos casos sí puedes combinar ambas estrategias. Todo depende de tu estructura de ingresos, tipo de régimen fiscal y situación particular. Un análisis personalizado te da la respuesta correcta.' },
    { question: '¿Qué me ofrecen con la asesoría personalizada?', answer: 'Revisamos tu situación fiscal completa, calculamos tus escenarios reales con la tabla ISR vigente, identificamos oportunidades de deducción que no estás aprovechando, y diseñamos una estrategia de retiro + ahorro fiscal adaptada a tu caso.' },
    { question: '¿El PPR es seguro?', answer: 'Sí. Los Planes Personales de Retiro están regulados por la CNBV (Comisión Nacional Bancaria y de Valores) y operan bajo el marco legal del Art. 151 LISR, con respaldo institucional en México.' },
  ];

  const styles = `
    /* ==================== Navbar ==================== */
    .landing-navbar {
      position: fixed; top: 0; left: 0; right: 0;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      z-index: 1030; transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 1px 0 rgba(0,18,51,0.06);
      transform: translateZ(0);
    }
    .landing-navbar.scrolled {
      box-shadow: 0 4px 20px rgba(0,18,51,0.1);
      background: rgba(255,255,255,0.98);
    }
    .landing-navbar-content {
      max-width: 1200px; margin: 0 auto; padding: 0 1.5rem;
      display: flex; justify-content: space-between; align-items: center; height: 56px;
    }
    .landing-navbar-logo { text-decoration: none; display: flex; align-items: center; }
    .landing-navbar-logo:hover { opacity: 0.85; }
    .landing-navbar-menu {
      display: flex; gap: 2rem; list-style: none; align-items: center;
    }
    .landing-navbar-menu a {
      color: #2D3436; text-decoration: none; font-weight: 500;
      font-size: 0.9rem; transition: color 150ms;
    }
    .landing-navbar-menu a:hover { color: #003DA5; }
    .landing-navbar-cta { display: flex; gap: 1rem; align-items: center; }
    .landing-btn {
      padding: 0.5rem 1.5rem; border-radius: 1.25rem; font-weight: 600;
      font-size: 0.875rem; border: none; cursor: pointer; transition: all 300ms;
      font-family: 'Inter', sans-serif;
    }
    .landing-btn-primary {
      background: linear-gradient(135deg, #003DA5, #0067C5); color: white;
      box-shadow: 0 10px 15px -3px rgba(0,61,165,0.12);
    }
    .landing-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(0,61,165,0.15); }
    .landing-btn-outline { background: transparent; color: #003DA5; border: 1.5px solid #003DA5; border-radius: 2rem; }
    .landing-btn-outline:hover { background: rgba(0,61,165,0.05); }
    .landing-btn-gold {
      background: linear-gradient(135deg, #D4AF37, #C9A84C, #B99830); color: #001233;
      box-shadow: 0 8px 24px rgba(212,175,55,0.3); font-weight: 700;
    }
    .landing-btn-gold:hover { transform: translateY(-3px); box-shadow: 0 16px 32px rgba(212,175,55,0.4); }
    .landing-navbar .landing-btn-outline { color: #003DA5; border-color: #003DA5; }
    .landing-navbar .landing-btn-outline:hover { background: rgba(0,61,165,0.05); }
    .landing-navbar .landing-btn-primary { background: linear-gradient(135deg, #003DA5, #0052D4); color: white; box-shadow: 0 4px 12px rgba(0,61,165,0.2); }
    .landing-navbar .landing-btn-primary:hover { background: linear-gradient(135deg, #002B75, #003DA5); box-shadow: 0 6px 16px rgba(0,61,165,0.3); }
    .landing-hamburger { display: none; flex-direction: column; gap: 5px; background: transparent; border: none; cursor: pointer; }
    .landing-hamburger span { width: 24px; height: 2.5px; background: #2D3436; border-radius: 2px; transition: all 300ms; }

    /* ==================== Hero ==================== */
    .landing-hero {
      background: linear-gradient(160deg, #001233 0%, #001845 30%, #002855 60%, #003DA5 100%);
      padding-top: 56px; position: relative; overflow: hidden;
      display: flex; align-items: center; min-height: 100vh;
    }
    .landing-hero::before {
      content: ''; position: absolute; top: -20%; right: -10%; width: 700px; height: 700px;
      background: radial-gradient(circle, rgba(201,168,76,0.12) 0%, rgba(0,103,197,0.06) 40%, transparent 70%);
      border-radius: 50%; animation: float 8s ease-in-out infinite;
    }
    .landing-hero::after {
      content: ''; position: absolute; bottom: -30%; left: -15%; width: 600px; height: 600px;
      background: radial-gradient(circle, rgba(0,103,197,0.08) 0%, transparent 60%);
      border-radius: 50%; animation: float 10s ease-in-out infinite reverse;
    }
    @keyframes float { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-20px,0); } }
    .landing-hero-content {
      max-width: 1200px; width: 100%; padding: 2rem 1.5rem;
      display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;
      align-items: center; position: relative; z-index: 1; margin: 0 auto;
    }
    .landing-hero-text h1 {
      color: #FFFFFF; margin-bottom: 1.25rem; font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.15; letter-spacing: -0.03em; font-weight: 800;
      font-family: 'Playfair Display', serif;
    }
    .landing-hero-text h1 span.gold { color: #D4AF37; }
    .landing-hero-text p { color: rgba(255,255,255,0.8); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.7; }
    .landing-hero-cta { display: flex; gap: 1rem; flex-wrap: wrap; }
    .landing-hero-cta .landing-btn { padding: 0.85rem 2rem; font-size: 1rem; min-height: 48px; border-radius: 2rem; }
    .landing-btn-outline-hero {
      background: rgba(255,255,255,0.1); color: white; border: 2px solid rgba(255,255,255,0.4);
      backdrop-filter: blur(8px); font-weight: 600; border-radius: 2rem;
      transition: all 300ms;
    }
    .landing-btn-outline-hero:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.7); transform: translateY(-3px); }

    /* Hero Carousel - Video Based */
    .hero-carousel {
      border-radius: 1.5rem; position: relative; overflow: hidden;
      min-height: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .hero-carousel-video {
      position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
      opacity: 0; transition: opacity 600ms ease; border-radius: 1.5rem;
    }
    .hero-carousel-video.active { opacity: 1; }
    .hero-carousel-overlay {
      position: absolute; inset: 0; border-radius: 1.5rem;
      background: linear-gradient(to top, rgba(0,18,51,0.85) 0%, rgba(0,18,51,0.3) 50%, transparent 100%);
      z-index: 1;
    }
    .hero-slide-content {
      position: absolute; bottom: 0; left: 0; right: 0; padding: 2rem;
      z-index: 2; opacity: 0; transform: translateY(15px); transition: all 500ms ease;
    }
    .hero-slide-content.active { opacity: 1; transform: translateY(0); }
    .hero-slide-title { color: #FFFFFF; font-size: 1.35rem; font-weight: 700; margin-bottom: 0.35rem; line-height: 1.3; font-family: 'Playfair Display', serif; }
    .hero-slide-subtitle { color: rgba(255,255,255,0.75); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem; }
    .hero-slide-stat {
      display: inline-flex; align-items: center; gap: 1rem;
      background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.3);
      border-radius: 1rem; padding: 0.75rem 1.25rem;
    }
    .hero-slide-stat-value { color: #D4AF37; font-size: 1.5rem; font-weight: 700; font-family: 'Playfair Display', serif; }
    .hero-slide-stat-label { color: rgba(255,255,255,0.7); font-size: 0.8rem; }
    .hero-dots { display: flex; gap: 0.5rem; position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%); z-index: 3; }
    .hero-dot {
      width: 8px; height: 8px; border-radius: 50%; border: none; cursor: pointer;
      background: rgba(255,255,255,0.3); transition: all 300ms;
    }
    .hero-dot.active { background: #D4AF37; width: 24px; border-radius: 4px; box-shadow: 0 0 12px rgba(212,175,55,0.4); }

    /* ==================== Reveal Animations ==================== */
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(212,175,55,0.2); } 50% { box-shadow: 0 0 40px rgba(212,175,55,0.4); } }
    @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

    /* ===== Apple-style scroll reveal system (GPU composited) ===== */
    .reveal-up { opacity: 0; transform: translate3d(0,32px,0); filter: blur(3px); will-change: opacity, transform, filter; transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94); }
    .reveal-left { opacity: 0; transform: translate3d(-32px,0,0); filter: blur(3px); will-change: opacity, transform, filter; transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94); }
    .reveal-right { opacity: 0; transform: translate3d(32px,0,0); filter: blur(3px); will-change: opacity, transform, filter; transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94); }
    .reveal-scale { opacity: 0; transform: scale3d(0.92,0.92,1); filter: blur(3px); will-change: opacity, transform, filter; transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94); }
    .revealed { opacity: 1 !important; transform: translate3d(0,0,0) scale3d(1,1,1) !important; filter: blur(0) !important; will-change: auto; }
    .stagger-1 { transition-delay: 0ms; } .stagger-2 { transition-delay: 80ms; } .stagger-3 { transition-delay: 160ms; }
    .stagger-4 { transition-delay: 240ms; } .stagger-5 { transition-delay: 320ms; }

    /* Section-level reveal (GPU composited) */
    .landing-section-header { opacity: 0; transform: translate3d(0,28px,0); filter: blur(3px); will-change: opacity, transform, filter; transition: opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.5s cubic-bezier(0.25,0.46,0.45,0.94); }
    .landing-section-header.revealed { opacity: 1; transform: translate3d(0,0,0); filter: blur(0); will-change: auto; }
    .brand-grid { opacity: 0; transform: translate3d(0,24px,0); filter: blur(3px); will-change: opacity, transform, filter; transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s, transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s, filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s; }
    .brand-grid.revealed { opacity: 1; transform: translate3d(0,0,0); filter: blur(0); will-change: auto; }
    .emotion-grid { opacity: 0; transform: translate3d(0,24px,0); filter: blur(3px); will-change: opacity, transform, filter; transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s, transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s, filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s; }
    .emotion-grid.revealed { opacity: 1; transform: translate3d(0,0,0); filter: blur(0); will-change: auto; }

    /* Pause infinite animations when out of viewport */
    .anim-paused * { animation-play-state: paused !important; }

    /* ==================== Section Base ==================== */
    .landing-section { scroll-margin-top: 80px; contain: layout style; }
    .landing-section-padding {
      padding: 3rem 1.5rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      contain: layout style;
    }
    .landing-section-compact {
      padding: 2rem 1.5rem;
      min-height: auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .landing-section-light { background: #fff; }
    .landing-section-gray { background: linear-gradient(180deg, #F8F9FC, #F0F2F7); }
    .landing-section-blue { background: linear-gradient(160deg, #001233, #001845, #002B75); color: white; position: relative; overflow: hidden; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
    .landing-section-blue::before {
      content: ''; position: absolute; top: -50%; right: -20%; width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 60%); border-radius: 50%;
    }
    .landing-section-header { text-align: center; margin-bottom: 2.5rem; }
    .landing-section-header h2 {
      color: #001233; font-size: clamp(1.75rem, 3.5vw, 2.5rem);
      margin-bottom: 1rem; line-height: 1.2; font-weight: 700;
      font-family: 'Playfair Display', serif; letter-spacing: -0.02em;
    }
    .landing-section-header p { font-size: 1.05rem; color: #5A6577; max-width: 700px; margin: 0 auto; line-height: 1.7; }
    .landing-section-subtitle {
      color: #C9A84C; font-size: 0.8rem; text-transform: uppercase;
      letter-spacing: 0.15em; font-weight: 700; margin-bottom: 1rem; display: inline-block;
      background: linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.05));
      padding: 0.35rem 1rem; border-radius: 2rem; border: 1px solid rgba(201,168,76,0.2);
    }
    .blue-section-header h2 { color: white; }
    .blue-section-header p { color: rgba(255,255,255,0.85); }

    /* ==================== Brand Identity Block ==================== */
    .brand-block { max-width: 1200px; margin: 0 auto; }
    .brand-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
    .brand-left { position: relative; }
    .brand-video-wrapper {
      border-radius: 1.5rem; overflow: hidden; box-shadow: 0 20px 50px rgba(0,18,51,0.15);
      position: relative; aspect-ratio: 4/3;
    }
    .brand-video-wrapper::after {
      content: ''; position: absolute; inset: 0; border-radius: 1.5rem;
      border: 1px solid rgba(0,61,165,0.1);
    }
    .brand-name-highlight {
      display: inline-block; background: linear-gradient(135deg, #003DA5, #0067C5);
      color: white; padding: 0.6rem 1.75rem; border-radius: 0.75rem;
      font-size: 1.35rem; font-weight: 700; margin: 1.5rem 0;
      box-shadow: 0 8px 24px rgba(0,61,165,0.2);
    }
    .oo-infinity {
      background: linear-gradient(90deg, #43A047, #FDD835, #FF8F00, #E91E63, #00ACC1, #FF6D00, #E53935, #3949AB, #43A047);
      background-size: 300% 100%;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: ooRainbow 4s linear infinite;
      font-weight: 800;
    }
    @keyframes ooRainbow { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
    .brand-quote {
      background: linear-gradient(160deg, #001233, #001845);
      border-left: 4px solid #D4AF37; padding: 1.5rem 2rem; border-radius: 0 1rem 1rem 0;
      margin: 2rem 0 0; font-size: 1.15rem; color: white; font-weight: 600; font-style: italic;
      font-family: 'Playfair Display', serif; line-height: 1.5;
      box-shadow: 0 8px 32px rgba(0,18,51,0.15);
    }
    .brand-text { color: #4B5563; font-size: 1rem; line-height: 1.7; margin-bottom: 0.75rem; }
    .brand-text strong { color: #003DA5; }

    /* ==================== Emotional Connection ==================== */
    .emotion-list {
      list-style: none; padding: 0; max-width: 700px; margin: 1.5rem auto;
    }
    .emotion-list li {
      padding: 0.6rem 0; color: #4B5563; font-size: 1.05rem;
      display: flex; align-items: flex-start; gap: 0.5rem;
    }
    .emotion-list li::before { content: ''; display: none; }
    .emotion-check { color: #C9A84C; font-weight: 700; font-size: 1.1rem; flex-shrink: 0; }
    .emotion-combo {
      display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin: 1rem 0;
    }
    .emotion-combo-item {
      background: linear-gradient(145deg, #001845, #003DA5); color: white;
      padding: 0.85rem 2rem; border-radius: 2rem; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,24,69,0.2); font-size: 0.95rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .emotion-mini { text-align: center; color: #003DA5; font-weight: 600; font-size: 1.1rem; margin-top: 1.5rem; }
    .emotion-badge {
      font-size: 0.8rem; font-weight: 600; letter-spacing: 0.03em;
      color: #003DA5; padding: 0.4rem 1rem; border-radius: 2rem;
      background: linear-gradient(135deg, rgba(0,61,165,0.08), rgba(201,168,76,0.08));
      border: 1px solid rgba(0,61,165,0.15);
      box-shadow: 0 2px 8px rgba(0,61,165,0.06);
      transition: all 0.3s ease;
    }
    .emotion-badge:hover {
      background: linear-gradient(135deg, rgba(0,61,165,0.14), rgba(201,168,76,0.14));
      border-color: rgba(201,168,76,0.4);
      box-shadow: 0 4px 12px rgba(201,168,76,0.15);
      transform: translateY(-1px);
    }
    .emotion-cta-wrapper { text-align: center; margin-top: 2rem; }
    .emotion-cta {
      display: inline-block; background: linear-gradient(135deg, #003DA5, #0052D4);
      color: white; padding: 1.1rem 2.5rem; border-radius: 1rem;
      font-size: 1.2rem; font-weight: 700;
      box-shadow: 0 8px 24px rgba(0,61,165,0.25);
      animation: ctaPulse 2.5s ease-in-out infinite;
      position: relative; overflow: hidden;
    }
    .emotion-cta::before {
      content: ''; position: absolute; top: -50%; left: -50%;
      width: 200%; height: 200%;
      background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
      animation: ctaShine 3s ease-in-out infinite;
    }
    @keyframes ctaPulse {
      0%, 100% { box-shadow: 0 8px 24px rgba(0,61,165,0.25); transform: scale(1); }
      50% { box-shadow: 0 12px 36px rgba(0,61,165,0.4), 0 0 20px rgba(0,82,212,0.2); transform: scale(1.02); }
    }
    @keyframes ctaShine {
      0% { transform: translateX(-100%) rotate(25deg); }
      60%, 100% { transform: translateX(100%) rotate(25deg); }
    }

    /* ==================== Problem Cards ==================== */
    .landing-problems-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem; }
    .landing-problem-card {
      background: white; border: none; border-radius: 1.25rem;
      padding: 2.5rem 2rem; position: relative; overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,18,51,0.06);
      opacity: 0; transform: translateY(28px); filter: blur(3px);
      transition: opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.5s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 400ms ease;
    }
    .landing-problem-card.revealed { opacity: 1; transform: translateY(0); filter: blur(0); }
    .landing-problem-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, #D4AF37, #C9A84C, #B99830); transform: scaleX(0);
      transform-origin: left; transition: transform 400ms cubic-bezier(0.4,0,0.2,1);
    }
    .landing-problem-card:hover::before { transform: scaleX(1); }
    .landing-problem-card:hover { box-shadow: 0 20px 40px rgba(0,18,51,0.12); }
    .problem-number {
      position: absolute; top: 0.5rem; right: 1rem; font-size: 6rem; font-weight: 900;
      background: linear-gradient(180deg, #D4AF37, rgba(212,175,55,0.15));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text; font-family: 'Playfair Display', serif; line-height: 1;
      transition: all 500ms ease; filter: drop-shadow(0 2px 4px rgba(212,175,55,0.2));
    }
    .landing-problem-card:hover .problem-number {
      background: linear-gradient(180deg, #D4AF37, rgba(212,175,55,0.3));
      -webkit-background-clip: text; background-clip: text;
      transform: scale(1.08); filter: drop-shadow(0 4px 8px rgba(212,175,55,0.3));
    }
    .landing-problem-icon {
      width: 60px; height: 60px; background: linear-gradient(145deg, #001845, #003DA5);
      border-radius: 1rem; display: flex; align-items: center; justify-content: center;
      margin-bottom: 1.25rem; color: white;
      box-shadow: 0 8px 20px rgba(0,61,165,0.2);
    }
    .landing-problem-card h3 { color: #001233; margin-bottom: 0.75rem; font-size: 1.2rem; font-weight: 700; font-family: 'Playfair Display', serif; }
    .landing-problem-card p { color: #5A6577; line-height: 1.7; margin: 0; font-size: 1rem; }

    /* ==================== Solution Cards ==================== */
    .landing-services-grid {
      max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem;
      position: relative;
    }
    .landing-services-grid::before {
      content: ''; position: absolute; top: 50%; left: 10%; right: 10%; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0,61,165,0.15), rgba(212,175,55,0.3), rgba(0,61,165,0.15), transparent);
      z-index: 0;
    }
    .landing-service-card {
      background: white; border-radius: 1.5rem; padding: 2.5rem 2rem;
      border: 1px solid rgba(0,18,51,0.06); position: relative; overflow: visible;
      box-shadow: 0 4px 20px rgba(0,18,51,0.06);
      opacity: 0; transform: translateY(28px) scale(0.97); filter: blur(3px);
      transition: opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.5s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 400ms ease, border-color 400ms ease;
      z-index: 1;
    }
    .landing-service-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 1.5rem 1.5rem 0 0;
      background: linear-gradient(90deg, #001845, #003DA5, #D4AF37); transform: scaleX(0);
      transform-origin: left; transition: transform 500ms cubic-bezier(0.34,1.56,0.64,1);
    }
    .landing-service-card::after {
      content: ''; position: absolute; inset: 0; border-radius: 1.5rem;
      background: linear-gradient(135deg, rgba(0,61,165,0.03), rgba(212,175,55,0.03));
      opacity: 0; transition: opacity 400ms ease; z-index: -1;
    }
    .landing-service-card:hover { box-shadow: 0 24px 48px rgba(0,18,51,0.14); transform: translateY(-8px) scale(1.02); border-color: rgba(0,61,165,0.15); }
    .landing-service-card:hover::before { transform: scaleX(1); }
    .landing-service-card:hover::after { opacity: 1; }
    .landing-service-card.revealed { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) !important; }
    .landing-service-card.revealed:hover { transform: translateY(-8px) scale(1.02); }

    .service-step-number {
      position: absolute; top: -18px; right: 24px;
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #001845, #003DA5);
      color: white; font-weight: 800; font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(0,61,165,0.3);
      transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1), background 400ms ease;
    }
    .landing-service-card:hover .service-step-number {
      transform: scale(1.2) rotate(10deg);
      background: linear-gradient(135deg, #D4AF37, #B99830);
    }

    .landing-service-icon {
      margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: center;
      width: 64px; height: 64px; border-radius: 1rem;
      background: linear-gradient(135deg, rgba(0,61,165,0.08), rgba(0,61,165,0.04));
      transition: transform 500ms cubic-bezier(0.34,1.56,0.64,1), background 400ms ease, box-shadow 400ms ease;
    }
    .landing-service-card:hover .landing-service-icon {
      transform: scale(1.1) rotate(-5deg);
      background: linear-gradient(135deg, rgba(0,61,165,0.15), rgba(212,175,55,0.1));
      box-shadow: 0 8px 20px rgba(0,61,165,0.15);
    }

    .landing-service-card h3 { color: #001233; margin-bottom: 0.75rem; font-size: 1.2rem; font-weight: 700; font-family: 'Playfair Display', serif; }
    .landing-service-card p { color: #5A6577; line-height: 1.8; font-size: 0.95rem; }

    .service-tag {
      display: inline-block; margin-top: 1.25rem; padding: 0.35rem 1rem; border-radius: 2rem;
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      background: rgba(0,61,165,0.06); color: #003DA5;
      transition: background 300ms, color 300ms;
    }
    .landing-service-card:hover .service-tag {
      background: linear-gradient(135deg, #001845, #003DA5); color: white;
    }

    /* ==================== Video/Concept Block ==================== */
    .video-concept-block {
      max-width: 800px; margin: 0 auto; text-align: center;
    }
    .video-concept-block p { color: rgba(255,255,255,0.9); font-size: 1.05rem; line-height: 1.8; margin-bottom: 2rem; }

    /* ==================== Tax Calculator ==================== */
    .tax-calc-container {
      max-width: 1100px; margin: 0 auto; background: white;
      border: none; border-radius: 1.25rem;
      padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,18,51,0.08);
      position: relative; overflow: hidden;
      opacity: 0; transform: translateY(28px) scale(0.98); filter: blur(3px);
      transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94);
    }
    .tax-calc-container.revealed { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    .tax-calc-container::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px;
      background: linear-gradient(90deg, #D4AF37, #003DA5, #001845);
      border-radius: 1rem 1rem 0 0;
    }
    .tax-calc-support { text-align: center; color: #5A6577; font-size: 0.9rem; margin-bottom: 1rem; font-style: italic; }
    .tax-calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: stretch; }
    .tax-calc-inputs { display: flex; flex-direction: column; gap: 0.5rem; }
    .tax-input-group { display: flex; flex-direction: column; gap: 0.2rem; }
    .tax-input-group label { font-weight: 600; color: #2D3436; font-size: 0.8rem; }
    .tax-input-group input, .tax-input-group select {
      padding: 0.45rem 0.75rem; border: 1.5px solid #E5E7EB; border-radius: 0.5rem;
      font-size: 0.85rem; transition: all 300ms; font-family: 'Inter', sans-serif;
    }
    .tax-input-group input:focus, .tax-input-group select:focus {
      outline: none; border-color: #003DA5; box-shadow: 0 0 0 3px rgba(0,61,165,0.1);
    }
    .tax-toggle-advanced {
      background: none; border: none; color: #003DA5; font-weight: 600;
      cursor: pointer; font-size: 0.9rem; padding: 0.5rem 0; text-align: left;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .tax-toggle-advanced:hover { color: #0067C5; }
    .tax-results {
      background: linear-gradient(160deg, #060a14 0%, #0a1225 40%, #0e1a33 100%);
      border-radius: 1.25rem; padding: 1.25rem; border: none;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4), 0 0 80px rgba(212,175,55,0.04);
      display: flex; flex-direction: column; justify-content: space-between;
      position: relative; overflow: hidden;
    }
    /* Animated border gradient */
    .tax-results::before {
      content: ''; position: absolute; inset: -1px; border-radius: 1.25rem; padding: 1px; z-index: 0;
      background: linear-gradient(var(--border-angle, 0deg), rgba(212,175,55,0.4), rgba(0,61,165,0.2), rgba(212,175,55,0.1), rgba(52,211,153,0.2), rgba(212,175,55,0.4));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      animation: borderSpin 6s linear infinite;
    }
    @keyframes borderSpin { to { --border-angle: 360deg; } }
    @property --border-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
    /* Floating particles */
    .tax-results::after {
      content: ''; position: absolute; inset: 0; z-index: 0;
      background:
        radial-gradient(1.5px 1.5px at 15% 25%, rgba(212,175,55,0.3) 50%, transparent 50%),
        radial-gradient(1px 1px at 75% 15%, rgba(255,255,255,0.15) 50%, transparent 50%),
        radial-gradient(1.5px 1.5px at 85% 70%, rgba(212,175,55,0.2) 50%, transparent 50%),
        radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.1) 50%, transparent 50%),
        radial-gradient(1px 1px at 55% 45%, rgba(52,211,153,0.15) 50%, transparent 50%);
      animation: particleFloat 6s ease-in-out infinite alternate;
    }
    @keyframes particleFloat { 0% { transform: translateY(0); } 100% { transform: translateY(-6px); } }
    .tax-results > * { position: relative; z-index: 1; }
    .tax-results h3 {
      color: transparent; font-size: 1rem; margin-bottom: 0.5rem; text-align: center;
      font-family: 'Playfair Display', serif; letter-spacing: 0.03em;
      background: linear-gradient(135deg, #D4AF37 0%, #F0D78C 50%, #D4AF37 100%);
      background-size: 200% 100%; -webkit-background-clip: text; background-clip: text;
      animation: goldShift 4s ease-in-out infinite;
    }
    @keyframes goldShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    /* Stat cards with glass morphism */
    .tax-stat-card {
      text-align: center; padding: 0.65rem; border-radius: 0.65rem;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
      backdrop-filter: blur(12px); transition: all 400ms cubic-bezier(0.34,1.56,0.64,1);
      animation: statReveal 600ms ease-out backwards;
    }
    .tax-stat-card:first-child { animation-delay: 100ms; }
    .tax-stat-card:last-child { animation-delay: 250ms; }
    @keyframes statReveal { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .tax-stat-card:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); transform: translateY(-3px) scale(1.02); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
    .tax-stat-card .stat-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.15rem; }
    .tax-stat-card .stat-value { font-size: 1.5rem; font-weight: 800; font-family: 'Montserrat', sans-serif; }
    .tax-stat-card .stat-sub { font-size: 0.55rem; color: rgba(255,255,255,0.35); margin-top: 0.05rem; }
    /* Hero card with pulse glow */
    .tax-hero-card {
      text-align: center; padding: 0.85rem; border-radius: 0.75rem;
      background: linear-gradient(135deg, rgba(52,211,153,0.05), rgba(52,211,153,0.01));
      border: 1px solid rgba(52,211,153,0.12);
      position: relative; overflow: hidden;
      animation: statReveal 600ms ease-out 400ms backwards;
      box-shadow: 0 0 30px rgba(52,211,153,0.05);
    }
    .tax-hero-card::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(52,211,153,0.06) 50%, transparent 100%);
      animation: heroShimmer 4s ease-in-out infinite;
    }
    @keyframes heroShimmer { 0%,100% { opacity: 0; transform: translateX(-100%); } 50% { opacity: 1; transform: translateX(100%); } }
    .tax-hero-card:hover { box-shadow: 0 0 40px rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.25); }
    .tax-hero-card > * { position: relative; z-index: 1; }
    /* Result rows */
    .tax-result-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.4rem 0; border-bottom: 1px solid rgba(255,255,255,0.04);
      animation: statReveal 500ms ease-out backwards;
    }
    .tax-result-row:nth-child(1) { animation-delay: 550ms; }
    .tax-result-row:nth-child(2) { animation-delay: 650ms; }
    .tax-result-row:nth-child(3) { animation-delay: 750ms; }
    .tax-result-row:last-child { border-bottom: none; }
    .tax-result-label { color: rgba(255,255,255,0.45); font-size: 0.75rem; font-weight: 500; }
    .tax-result-value { color: rgba(255,255,255,0.95); font-size: 1.05rem; font-weight: 700; font-family: 'Montserrat', sans-serif; }
    .tax-result-highlight {
      background: linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05));
      border: 1px solid rgba(212,175,55,0.3); border-radius: 0.75rem; padding: 1rem;
      margin-top: 0.75rem; text-align: center;
    }
    .tax-result-highlight .tax-result-value { color: #D4AF37; font-size: 1.75rem; font-family: 'Playfair Display', serif; }
    .tax-result-highlight .tax-result-label { color: rgba(255,255,255,0.8); font-weight: 600; font-size: 0.85rem; }
    .tax-scenarios {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1.5rem;
    }
    .tax-scenario {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem; padding: 0.75rem; text-align: center;
    }
    .tax-scenario-label { font-size: 0.7rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .tax-scenario-value { font-size: 0.95rem; font-weight: 700; color: #FFFFFF; }

    /* ==================== Para Quien Block ==================== */
    /* ==================== Para Quién + Trust Combined ==================== */
    .landing-trust-bar { background: linear-gradient(160deg, #001233, #001845); }
    .paraquien-grid {
      display: grid; grid-template-columns: 1.1fr 1fr; gap: 3rem; align-items: start;
    }
    .paraquien-cards-col { display: flex; flex-direction: column; gap: 0.65rem; }
    .pq-card {
      display: flex; align-items: center; gap: 0.85rem;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 0.85rem; padding: 0.85rem 1.25rem;
      color: white; font-size: 0.95rem; font-style: italic;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      opacity: 0; transform: translateX(-24px); filter: blur(3px);
      transition: opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.5s cubic-bezier(0.25,0.46,0.45,0.94), background 300ms ease, border-color 300ms ease;
    }
    .pq-card.revealed { opacity: 1; transform: translateX(0); filter: blur(0); }
    .pq-card:hover { background: rgba(255,255,255,0.2); border-color: rgba(212,175,55,0.5); }
    .pq-icon { flex-shrink: 0; color: #D4AF37; display: flex; align-items: center; }
    .pq-text { line-height: 1.5; }
    .pq-cta-text { color: #D4AF37; font-weight: 600; font-size: 0.95rem; margin-top: 0.75rem; font-style: italic; }

    .paraquien-stats-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    .trust-stat-card {
      position: relative; overflow: hidden;
      background: linear-gradient(145deg, #003DA5, #0052D4);
      border: none; border-radius: 1rem;
      padding: 1.5rem 1.25rem; text-align: center;
      box-shadow: 0 8px 24px rgba(0,61,165,0.35);
      transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 400ms ease;
    }
    .trust-stat-card:hover { transform: translateY(-6px); box-shadow: 0 16px 36px rgba(0,61,165,0.45); }
    .trust-stat-number {
      color: #FFFFFF; font-size: 2.25rem; font-weight: 800; font-family: 'Playfair Display', serif;
      line-height: 1; margin-bottom: 0.4rem;
    }
    .trust-stat-label { color: rgba(255,255,255,0.9); font-size: 0.82rem; line-height: 1.3; font-weight: 500; }
    .trust-stat-bg-icon {
      position: absolute; top: 10px; right: 10px; color: rgba(212,175,55,0.5);
    }

    /* ==================== Live Banner ==================== */
    .live-banner-wrapper { text-align: center; margin-top: 2rem; }
    .live-banner {
      display: inline-flex; align-items: center; gap: 0.75rem;
      background: linear-gradient(135deg, #8B6914 0%, #A67C1A 30%, #C9A84C 60%, #A67C1A 100%);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 3rem; padding: 0.9rem 2.2rem;
      box-shadow: 0 6px 24px rgba(201,168,76,0.35), 0 0 0 3px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.3);
      animation: liveBannerPulse 3s ease-in-out infinite;
      position: relative; overflow: hidden;
    }
    .live-banner::before {
      content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      animation: liveBannerShine 3s ease-in-out infinite;
    }
    .live-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #003DA5; flex-shrink: 0;
      box-shadow: 0 0 6px rgba(0,61,165,0.8), 0 0 12px rgba(0,61,165,0.4);
      animation: liveDotPulse 1.5s ease-in-out infinite;
    }
    .live-text {
      color: #ffffff; font-weight: 600; font-size: 0.95rem;
      letter-spacing: 0.01em; text-shadow: 0 1px 2px rgba(0,0,0,0.15);
    }
    .live-count {
      color: #003DA5; font-weight: 800; font-size: 1.1rem;
      text-shadow: none;
    }
    @keyframes liveDotPulse {
      0%, 100% { box-shadow: 0 0 4px rgba(0,61,165,0.5); transform: scale(1); }
      50% { box-shadow: 0 0 12px rgba(0,61,165,0.9), 0 0 20px rgba(0,61,165,0.4); transform: scale(1.2); }
    }
    @keyframes liveBannerPulse {
      0%, 100% { box-shadow: 0 6px 24px rgba(201,168,76,0.35), 0 0 0 3px rgba(212,175,55,0.15); transform: scale(1); }
      50% { box-shadow: 0 10px 36px rgba(201,168,76,0.5), 0 0 0 5px rgba(212,175,55,0.25); transform: scale(1.02); }
    }
    @keyframes liveBannerShine {
      0% { left: -100%; }
      50%, 100% { left: 200%; }
    }

    /* ==================== About Block ==================== */
    .about-block { max-width: 1200px; margin: 0 auto; }
    .about-top { text-align: center; margin-bottom: 3rem; }
    .about-top p { color: #4B5563; font-size: 1.15rem; line-height: 1.8; max-width: 700px; margin: 0 auto; }
    .about-grid {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5rem; margin-bottom: 3rem;
    }
    .about-card {
      background: white; border-radius: 1.25rem; padding: 2rem 1.5rem; text-align: center;
      box-shadow: 0 4px 24px rgba(0,18,51,0.06); transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      position: relative; overflow: hidden; border: 1px solid rgba(0,18,51,0.04);
    }
    .about-card::before {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, #003DA5, #D4AF37); transform: scaleX(0);
      transform-origin: center; transition: transform 400ms;
    }
    .about-card:hover::before { transform: scaleX(1); }
    .about-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,18,51,0.12); }
    .about-card-icon {
      width: 64px; height: 64px; border-radius: 1rem; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1rem; font-size: 1.75rem;
      background: linear-gradient(145deg, #001845, #003DA5); color: white;
      box-shadow: 0 8px 20px rgba(0,61,165,0.2);
    }
    .about-card h4 {
      color: #001233; font-size: 1rem; font-weight: 700; margin: 0;
      font-family: 'Playfair Display', serif; text-transform: capitalize;
    }
    .about-highlight {
      background: linear-gradient(160deg, #001233, #001845, #002B75);
      border-radius: 1.5rem; padding: 3rem 2.5rem; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 20px 50px rgba(0,18,51,0.25);
    }
    .about-highlight::before {
      content: ''; position: absolute; top: -50%; right: -20%; width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 60%); border-radius: 50%;
    }
    .about-highlight::after {
      content: ''; position: absolute; bottom: -30%; left: -10%; width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(0,103,197,0.08) 0%, transparent 60%); border-radius: 50%;
    }
    .about-highlight p {
      color: white; font-weight: 600; font-size: 1.35rem; line-height: 1.6;
      position: relative; z-index: 1; margin: 0;
      font-family: 'Playfair Display', serif;
    }
    .about-highlight p span { color: #D4AF37; }

    /* ==================== About Full ==================== */
    .about-full { max-width: 1200px; margin: 0 auto; }
    .about-pillars {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 2rem;
    }
    .about-pillar-card {
      position: relative; text-align: center; padding: 2rem 1.25rem 1.75rem; border-radius: 1.25rem;
      background: linear-gradient(160deg, #ffffff 0%, #f8faff 100%);
      border: 1px solid transparent;
      background-clip: padding-box;
      box-shadow: 0 4px 20px rgba(0,18,51,0.06);
      transition: all 500ms cubic-bezier(0.34,1.56,0.64,1);
      overflow: hidden;
    }
    .about-pillar-card::before {
      content: ''; position: absolute; inset: 0; border-radius: 1.25rem; padding: 1px;
      background: linear-gradient(135deg, rgba(0,61,165,0.15), rgba(212,175,55,0.3), rgba(0,61,165,0.1));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      transition: all 400ms ease;
    }
    .about-pillar-card::after {
      content: ''; position: absolute; top: -50%; right: -50%; width: 100%; height: 100%;
      background: radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%);
      transition: all 600ms ease; pointer-events: none;
    }
    .about-pillar-card:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 20px 50px rgba(0,61,165,0.15), 0 0 30px rgba(212,175,55,0.08);
    }
    .about-pillar-card:hover::before {
      background: linear-gradient(135deg, rgba(0,61,165,0.3), rgba(212,175,55,0.5), rgba(0,61,165,0.2));
    }
    .about-pillar-card:hover::after { top: -30%; right: -30%; }
    .about-pillar-icon {
      width: 60px; height: 60px; border-radius: 1rem; margin: 0 auto 1rem;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #001845, #003DA5);
      color: white; position: relative; z-index: 1;
      box-shadow: 0 6px 20px rgba(0,61,165,0.25);
      transition: all 400ms cubic-bezier(0.34,1.56,0.64,1);
    }
    .about-pillar-card:hover .about-pillar-icon {
      transform: scale(1.1) rotate(-5deg);
      background: linear-gradient(135deg, #D4AF37, #C9A84C);
      box-shadow: 0 8px 25px rgba(212,175,55,0.35);
    }
    .about-pillar-card h4 { color: #001233; font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; font-family: 'Playfair Display', serif; position: relative; z-index: 1; }
    .about-pillar-card p { color: #5A6577; font-size: 0.85rem; line-height: 1.6; margin: 0; position: relative; z-index: 1; }
    .about-highlight-bar {
      background: linear-gradient(135deg, #001233, #001845); border-radius: 1rem;
      padding: 1.5rem 2.5rem; text-align: center;
      box-shadow: 0 8px 30px rgba(0,18,51,0.2);
    }
    .about-highlight-bar p {
      color: white; font-weight: 600; font-size: 1.2rem; margin: 0;
      font-family: 'Playfair Display', serif;
    }
    .about-highlight-bar p span { color: #D4AF37; }

    /* ==================== Responsive Grids ==================== */
    .emotion-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;
      align-items: center; max-width: 1000px; margin: 0 auto;
    }
    .sat-grid {
      display: grid; grid-template-columns: 1fr 1.2fr; gap: 2rem; align-items: center;
    }
    .sat-video-col { position: relative; }
    .sat-video-wrapper {
      border-radius: 1.25rem; overflow: hidden; aspect-ratio: 3/4; max-height: 400px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      border: 2px solid rgba(212,175,55,0.2);
    }
    .sat-text-col {}
    .sat-badge-row { display: flex; align-items: center; gap: 0.75rem; }
    .sat-ppr-badge {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08));
      border: 1px solid rgba(212,175,55,0.3); border-radius: 2rem;
      padding: 0.5rem 1.25rem; color: #D4AF37; font-weight: 700; font-size: 0.85rem;
    }

    /* ==================== Contact Form ==================== */
    .landing-contact-form-container {
      max-width: 650px; margin: 0 auto; background: white; padding: 2rem;
      border-radius: 1.25rem; box-shadow: 0 20px 50px rgba(0,18,51,0.12);
      border: none; position: relative; overflow: hidden;
      opacity: 0; transform: translateY(28px) scale(0.98); filter: blur(3px);
      transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.55s cubic-bezier(0.25,0.46,0.45,0.94);
    }
    .landing-contact-form-container.revealed { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    .landing-contact-form-container::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
      background: linear-gradient(90deg, #001845, #003DA5, #D4AF37);
    }
    .landing-contact-form-container h2 { text-align: center; color: #001233; margin-bottom: 1rem; font-size: clamp(1.75rem, 3vw, 2.25rem); font-family: 'Playfair Display', serif; }
    .form-subcopy { text-align: center; color: #4B5563; font-size: 0.9rem; margin-bottom: 1rem; }
    .landing-form-group { display: flex; flex-direction: column; margin-bottom: 0.75rem; }
    .landing-form-group label { font-weight: 600; color: #2D3436; margin-bottom: 0.25rem; font-size: 0.85rem; }
    .landing-form-group input, .landing-form-group select, .landing-form-group textarea {
      padding: 0.6rem 0.85rem; border: 1.5px solid #E5E7EB; border-radius: 0.6rem;
      font-size: 0.9rem; font-family: 'Inter', sans-serif; transition: all 300ms;
    }
    .landing-form-group input:focus, .landing-form-group select:focus, .landing-form-group textarea:focus {
      outline: none; border-color: #003DA5; box-shadow: 0 0 0 3px rgba(0,61,165,0.1);
    }
    .landing-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .landing-form-submit {
      width: 100%; padding: 1.1rem 2rem; background: linear-gradient(145deg, #001845, #003DA5);
      color: white; border: none; border-radius: 2rem; font-weight: 700; font-size: 1.05rem;
      cursor: pointer; transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 10px 30px rgba(0,24,69,0.25); letter-spacing: 0.01em;
    }
    .landing-form-submit:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(0,24,69,0.3); }
    .landing-form-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .landing-form-success-message { background: #D1FAE5; border: 1.5px solid #10B981; color: #047857; padding: 1.25rem; border-radius: 0.75rem; margin-bottom: 1.5rem; text-align: center; font-weight: 500; }
    .landing-form-error-message { background: #FEE2E2; border: 1.5px solid #EF4444; color: #DC2626; padding: 1.25rem; border-radius: 0.75rem; margin-bottom: 1.5rem; text-align: center; font-weight: 500; }

    /* ==================== Closing / CTA ==================== */
    .landing-cta-section {
      max-width: 1200px; margin: 0 auto;
      background: linear-gradient(160deg, #001233, #001845, #002B75, #003DA5); background-size: 400% 400%;
      animation: gradientShift 10s ease infinite;
      color: white; text-align: center; padding: 5rem 3rem; border-radius: 2rem;
      position: relative; overflow: hidden;
      box-shadow: 0 30px 60px rgba(0,18,51,0.5);
    }
    .landing-cta-section::before {
      content: ''; position: absolute; top: -40%; right: -10%; width: 600px; height: 600px;
      background: radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 55%); border-radius: 50%;
      animation: ctaOrbit1 12s ease-in-out infinite;
    }
    .landing-cta-section::after {
      content: ''; position: absolute; bottom: -30%; left: -10%; width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(0,103,197,0.2) 0%, transparent 55%); border-radius: 50%;
      animation: ctaOrbit2 15s ease-in-out infinite;
    }
    @keyframes ctaOrbit1 { 0% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-40px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.95); } 100% { transform: translate(0,0) scale(1); } }
    @keyframes ctaOrbit2 { 0% { transform: translate(0,0) scale(1); } 33% { transform: translate(-25px,30px) scale(1.05); } 66% { transform: translate(30px,-15px) scale(0.9); } 100% { transform: translate(0,0) scale(1); } }

    /* Floating particles */
    .cta-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
    .cta-particle {
      position: absolute; width: 3px; height: 3px; background: rgba(212,175,55,0.5);
      border-radius: 50%; animation: particleRise linear infinite;
    }
    @keyframes particleRise {
      0% { transform: translateY(100%) scale(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(-100vh) scale(1.5); opacity: 0; }
    }

    .landing-cta-content { position: relative; z-index: 1; }

    /* Header = "Imagina un retiro..." (the blue subtext becomes the big header) */
    .cta-main-headline {
      font-size: clamp(2rem, 5vw, 3.25rem); font-weight: 700;
      font-family: 'Playfair Display', serif; color: white;
      margin-bottom: 1rem; line-height: 1.15;
      animation: ctaHeadlineIn 1s ease-out both;
    }
    @keyframes ctaHeadlineIn { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

    /* Subheader = "Retírate joven..." (gold shimmer) */
    .cta-sub-headline {
      font-size: clamp(1.1rem, 2.5vw, 1.6rem); font-weight: 600;
      margin-bottom: 2rem;
      background: linear-gradient(90deg, #D4AF37, #F0D060, #E8C84A, #D4AF37); background-size: 300%;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      animation: shimmer 4s ease infinite, ctaSubIn 1s 0.3s ease-out both;
      letter-spacing: 0.02em;
    }
    @keyframes ctaSubIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .cta-body-text {
      color: rgba(255,255,255,0.9); font-size: 1.05rem; margin-bottom: 1.5rem;
      max-width: 620px; margin-left: auto; margin-right: auto; line-height: 1.7;
      animation: ctaBodyIn 1s 0.5s ease-out both;
    }
    @keyframes ctaBodyIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

    /* Divider line */
    .cta-divider {
      width: 80px; height: 3px; margin: 0 auto 2rem;
      background: linear-gradient(90deg, transparent, #D4AF37, transparent);
      animation: ctaDividerIn 1s 0.6s ease-out both;
    }
    @keyframes ctaDividerIn { from { width: 0; opacity: 0; } to { width: 80px; opacity: 1; } }

    .brand-tagline {
      text-align: center; margin-top: 1.5rem; margin-bottom: 1.5rem;
      animation: ctaBrandIn 1s 0.7s ease-out both;
    }
    @keyframes ctaBrandIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    .brand-tagline p { color: rgba(255,255,255,0.6); font-size: 0.9rem; }
    .brand-tagline strong { color: white; font-size: 1.3rem; display: block; margin-bottom: 0.25rem; }

    /* CTA button */
    .cta-btn-pulse {
      animation: ctaPulse 3s ease-in-out infinite, ctaBtnIn 1s 0.9s ease-out both;
      position: relative; overflow: hidden;
    }
    .cta-btn-pulse::before {
      content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: btnSweep 3s ease-in-out infinite;
    }
    .cta-btn-pulse::after {
      content: ''; position: absolute; inset: -6px; border-radius: inherit;
      background: linear-gradient(135deg, rgba(212,175,55,0.5), transparent, rgba(212,175,55,0.5));
      z-index: -1; filter: blur(12px); opacity: 0; animation: ctaGlow 3s ease-in-out infinite;
    }
    @keyframes ctaPulse { 0%,100% { transform: scale(1); box-shadow: 0 8px 24px rgba(212,175,55,0.3); } 50% { transform: scale(1.05); box-shadow: 0 16px 40px rgba(212,175,55,0.5); } }
    @keyframes ctaGlow { 0%,100% { opacity: 0; } 50% { opacity: 1; } }
    @keyframes ctaBtnIn { from { opacity: 0; transform: translateY(20px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes btnSweep { 0% { left: -100%; } 50%,100% { left: 200%; } }

    /* ==================== FAQ ==================== */
    .landing-faq-container { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 0.75rem; }
    .landing-faq-item {
      border: none; border-radius: 1rem; overflow: hidden;
      background: white; box-shadow: 0 2px 12px rgba(0,18,51,0.04);
      border-left: 4px solid transparent;
      transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      opacity: 0; transform: translateY(20px);
      animation: faqReveal 500ms ease forwards;
    }
    .landing-faq-item:nth-child(1) { animation-delay: 0ms; }
    .landing-faq-item:nth-child(2) { animation-delay: 80ms; }
    .landing-faq-item:nth-child(3) { animation-delay: 160ms; }
    .landing-faq-item:nth-child(4) { animation-delay: 240ms; }
    .landing-faq-item:nth-child(5) { animation-delay: 320ms; }
    .landing-faq-item:nth-child(6) { animation-delay: 400ms; }
    @keyframes faqReveal { to { opacity: 1; transform: translateY(0); } }
    .landing-faq-item:hover { box-shadow: 0 8px 28px rgba(0,18,51,0.1); transform: translateY(-2px); }
    .landing-faq-item.open { border-left-color: #003DA5; box-shadow: 0 12px 32px rgba(0,18,51,0.1); }
    .landing-faq-question {
      padding: 1.1rem 1.5rem; background: white; cursor: pointer;
      display: flex; justify-content: space-between; align-items: center;
      font-weight: 600; color: #001233; font-size: 0.95rem; user-select: none;
      gap: 1rem; transition: background 200ms;
    }
    .landing-faq-question:hover { background: rgba(0,61,165,0.03); }
    .landing-faq-toggle {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,61,165,0.08); color: #003DA5; font-size: 0.75rem;
      transition: all 400ms cubic-bezier(0.34,1.56,0.64,1);
    }
    .landing-faq-item.open .landing-faq-toggle {
      transform: rotate(180deg); background: linear-gradient(135deg, #003DA5, #0052D4); color: white;
    }
    .landing-faq-answer {
      padding: 0 1.5rem; background: white; color: #4B5563; line-height: 1.8;
      max-height: 0; overflow: hidden; transition: max-height 400ms cubic-bezier(0.4,0,0.2,1), padding 400ms; font-size: 0.95rem;
    }
    .landing-faq-item.open .landing-faq-answer { max-height: 500px; padding: 0 1.5rem 1.25rem; }

    /* ==================== Footer ==================== */
    .landing-footer { background: linear-gradient(180deg, #001233, #000D1F); color: white; padding: 3rem 1.5rem 1.5rem; }
    .landing-footer-content { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin-bottom: 1.5rem; }
    .landing-footer-column h3 { color: white; margin-bottom: 1.5rem; font-size: 1rem; font-weight: 700; }
    .landing-footer-column p { color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6; font-size: 0.95rem; }
    .landing-footer-column a { color: rgba(255,255,255,0.8); text-decoration: none; display: block; margin-bottom: 1rem; transition: color 300ms; font-size: 0.95rem; }
    .landing-footer-column a:hover { color: #C9A84C; }
    .landing-social-links { display: flex; gap: 1rem; margin-top: 1rem; }
    .landing-social-links a {
      width: 40px; height: 40px; border-radius: 50%; background: rgba(201,168,76,0.15);
      display: flex; align-items: center; justify-content: center; color: #C9A84C;
      transition: all 300ms; margin-bottom: 0;
    }
    .landing-social-links a:hover { background: #C9A84C; color: #003DA5; transform: translateY(-3px); }
    .landing-footer-bottom { text-align: center; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); font-size: 0.9rem; }

    /* ==================== WhatsApp ==================== */
    .landing-whatsapp-button {
      position: fixed; bottom: 30px; right: 30px; width: 64px; height: 64px;
      background: linear-gradient(145deg, #25D366, #20BD5A); border-radius: 50%; display: flex; align-items: center;
      justify-content: center; box-shadow: 0 8px 32px rgba(37,211,102,0.35);
      cursor: pointer; transition: all 400ms cubic-bezier(0.4,0,0.2,1); z-index: 1030; color: white;
      font-size: 1.5rem; text-decoration: none;
    }
    .landing-whatsapp-button:hover { transform: scale(1.12) translateY(-4px); box-shadow: 0 16px 40px rgba(37,211,102,0.5); }

    .landing-sound-toggle {
      position: fixed; bottom: 30px; left: 30px; width: 48px; height: 48px;
      background: rgba(0,18,51,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 1030; color: white; transition: all 300ms ease;
    }
    .landing-sound-toggle:hover { background: rgba(0,61,165,0.9); transform: scale(1.1); }

    /* ==================== Animations ==================== */
    @keyframes slideInUp { from { opacity: 0; transform: translate3d(0,24px,0); filter: blur(2px); } to { opacity: 1; transform: translate3d(0,0,0); filter: blur(0); } }
    .slide-up { animation: slideInUp 0.5s cubic-bezier(0.25,0.46,0.45,0.94); }

    /* ==================== Responsive ==================== */
    @media (max-width: 768px) {
      .landing-navbar-menu {
        display: none; position: absolute; top: 56px; left: 0; right: 0;
        flex-direction: column; gap: 0; background: rgba(255,255,255,0.98);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        padding: 1.5rem; box-shadow: 0 16px 32px rgba(0,18,51,0.12);
      }
      .landing-navbar-menu.active { display: flex; }
      .landing-navbar-menu li { border-bottom: 1px solid rgba(0,18,51,0.06); padding: 1rem 0; }
      .landing-navbar-menu li:last-child { border-bottom: none; }
      .landing-hamburger { display: flex; }
      .landing-navbar-cta { display: none; }
      .landing-hero-content { grid-template-columns: 1fr; gap: 1.5rem; }
      .landing-hero { padding-top: 56px; min-height: 100vh; }
      .landing-problems-grid, .landing-services-grid { grid-template-columns: 1fr; }
      .tax-calc-grid { grid-template-columns: 1fr; }
      .landing-trust-content { grid-template-columns: repeat(2, 1fr); }
      .landing-footer-content { grid-template-columns: 1fr; }
      .landing-section-padding { padding: 2rem 1rem; min-height: auto; }
      .landing-form-row { grid-template-columns: 1fr; }
      .tax-scenarios { grid-template-columns: 1fr; }
      .about-grid { grid-template-columns: repeat(3, 1fr); }
      .about-highlight p { font-size: 1.1rem; }
      .brand-grid { grid-template-columns: 1fr; }
      .emotion-grid { grid-template-columns: 1fr; gap: 2rem; }
      .sat-grid { grid-template-columns: 1fr; gap: 2rem; }
      .paraquien-grid { grid-template-columns: 1fr; gap: 2rem; }
      .paraquien-stats-col { grid-template-columns: repeat(2, 1fr); }
      .about-pillars { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      .about-pillar-card { padding: 1.5rem 1rem; }
      .about-highlight-bar { padding: 1.25rem 1.5rem; }
      .about-highlight-bar p { font-size: 1rem; }
      .hero-carousel { min-height: 300px; }
      .landing-whatsapp-button { bottom: 20px; right: 20px; width: 55px; height: 55px; }
    }
    @media (max-width: 480px) {
      .landing-trust-content { grid-template-columns: 1fr; }
      .hero-carousel { min-height: 220px; }
      .about-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;

  return (
    <>
      <style>{styles}</style>

      {/* ==================== 0. NAVBAR ==================== */}
      <nav className={`landing-navbar ${isNavScrolled ? 'scrolled' : ''}`}>
        <div className="landing-navbar-content">
          <a href="#" className="landing-navbar-logo"><Logo height={38} variant="dark" /></a>
          <button
            className={`landing-hamburger ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span><span></span><span></span>
          </button>
          <ul className={`landing-navbar-menu ${isMobileMenuOpen ? 'active' : ''}`}>
            <li><a href="#problema" onClick={() => scrollToSection('problema')}>Problema</a></li>
            <li><a href="#solucion" onClick={() => scrollToSection('solucion')}>Solución</a></li>
            <li><a href="#simulador" onClick={() => scrollToSection('simulador')}>Simulador</a></li>
            <li><a href="#faq" onClick={() => scrollToSection('faq')}>FAQ</a></li>
            <li><a href="#contacto" onClick={() => scrollToSection('contacto')}>Contacto</a></li>
          </ul>
          <div className="landing-navbar-cta">
            <button className="landing-btn landing-btn-primary" onClick={() => scrollToSection('simulador')}>
              Haz tu simulación
            </button>
          </div>
        </div>
      </nav>

      {/* ==================== 1. HERO PRINCIPAL ==================== */}
      <section className="landing-hero" ref={heroSectionRef}>
        <div className="landing-hero-content">
          <div className="landing-hero-text">
            <h1>Tu dinero, tu retiro y tus impuestos <span className="gold">pueden sentirse menos complicados</span></h1>
            <p style={{ textAlign: 'justify' }}>
              En <span style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 0.2rem' }}><Logo height={28} variant="light" layout="inline" animated /></span> hacemos algo muy simple: convertimos lo que antes sonaba pesado
              —números, SAT, ahorro, retiro y estrategia fiscal— en algo fácil de entender,
              útil y hasta emocionante de usar a tu favor.
            </p>
            <div className="landing-hero-cta">
              <button className="landing-btn landing-btn-gold" onClick={() => scrollToSection('simulador')}>
                Quiero ver cuánto puedo aprovechar
              </button>
              <button className="landing-btn landing-btn-outline-hero" onClick={() => scrollToSection('simulador')} style={{ padding: '0.85rem 2rem', fontSize: '1rem', minHeight: '48px' }}>
                Ver simulador <ChevronDown size={18} style={{ marginLeft: '8px' }} />
              </button>
            </div>
          </div>
          <div className="hero-carousel">
            {heroSlides.map((slide, idx) => (
              <video key={idx} ref={(el) => (heroVideoRefs.current[idx] = el)} className={`hero-carousel-video ${heroSlide === idx ? 'active' : ''}`} autoPlay loop globalMuted={isMuted} playsInline>
                <source src={slide.video} type="video/mp4" />
              </video>
            ))}
            <div className="hero-carousel-overlay" />
            {heroSlides.map((slide, idx) => (
              <div key={idx} className={`hero-slide-content ${heroSlide === idx ? 'active' : ''}`}>
                <div className="hero-slide-title">{slide.title}</div>
                <div className="hero-slide-subtitle">{slide.subtitle}</div>
                <div className="hero-slide-stat">
                  <div className="hero-slide-stat-value">{slide.stat}</div>
                  <div className="hero-slide-stat-label">{slide.statLabel}</div>
                </div>
              </div>
            ))}
            <div className="hero-dots">
              {heroSlides.map((_, idx) => (
                <button key={idx} className={`hero-dot ${heroSlide === idx ? 'active' : ''}`} onClick={() => setHeroSlide(idx)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 2. IDENTIDAD DE MARCA ==================== */}
      <section className="landing-section landing-section-light landing-section-padding">
        <div className="brand-block" ref={(el) => (observerRefs.current[0] = el)} data-section="brand">
          <div className={`landing-section-header ${visibleSections.brand ? 'revealed' : ''}`}>
            <span className="landing-section-subtitle">Nuestra Historia</span>
            <h2>¿Por qué <span style={{ color: '#003DA5' }}>Finance</span> S C<span className="oo-infinity">oo</span>l?</h2>
          </div>
          <div className={`brand-grid ${visibleSections.brand ? 'revealed' : ''}`}>
            <div className="brand-left">
              <div className="brand-video-wrapper">
                <img src="/assets/ppr-hero.png" alt="Plan Personal de Retiro - Ahorra e Invierte a Largo Plazo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              </div>
            </div>
            <div className="brand-right">
              <p className="brand-text" style={{ textAlign: 'justify' }}>
                Mucha gente escucha nuestro nombre y cree que decimos <strong>Finance School</strong>,
                como si fuéramos una escuela de finanzas. Y sí... suena parecido. Pero hay un juego de palabras que nos define:
              </p>
              <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
                <Logo height={50} variant="dark" layout="inline" animated />
              </div>
              <p className="brand-text" style={{ textAlign: 'justify' }}>
                Porque las finanzas, los impuestos, el ahorro y el retiro <strong>sí pueden
                entenderse fácil, verse bien y sentirse c<span className="oo-infinity">oo</span>l.</strong>
              </p>
              <p className="brand-text" style={{ textAlign: 'justify' }}>
                Nosotros lo hacemos distinto.
                <strong> Te lo explicamos claro. Te lo aterrizamos a tu vida.</strong> Y te ayudamos a tomar decisiones inteligentes sin hablarte "en chino".
              </p>
              <div className="brand-quote">
                Lo que antes daba flojera aprender, hoy por fin alguien te lo explica padrísimo.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 3. CONEXION EMOCIONAL ==================== */}
      <section className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} ref={(el) => (observerRefs.current[1] = el)} data-section="emotion">
          <div className={`landing-section-header ${visibleSections.emotion ? 'revealed' : ''}`}>
            <h2>Si el SAT, el retiro o los números te dan dolor de cabeza... <span style={{ color: '#003DA5' }}>no eres tú.</span></h2>
            <p>Es como te lo habían contado. La mayoría de las personas nunca recibió una guía real para entender:</p>
          </div>
          <div className={`emotion-grid ${visibleSections.emotion ? 'revealed' : ''}`}>
            <div>
              <ul className="emotion-list">
                <li className={`reveal-left stagger-1 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo los impuestos juegan a tu favor</li>
                <li className={`reveal-left stagger-2 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo construir patrimonio</li>
                <li className={`reveal-left stagger-3 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo preparar su retiro</li>
                <li className={`reveal-left stagger-4 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo escoger la herramienta financiera ideal</li>
              </ul>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1.2rem' }}>
                <span className="emotion-badge">ingresos pasivos</span>
                <span className="emotion-badge">deducción fiscal</span>
                <span className="emotion-badge">retiro</span>
              </div>
            </div>
            <LazyVideo src="/assets/man-points.mp4" className="brand-video-wrapper" globalMuted={isMuted} />
          </div>
          <div className="emotion-cta-wrapper">
            <p className="emotion-cta">Menos confusión. Más claridad. Más control sobre tu futuro.</p>
          </div>
        </div>
      </section>

      {/* ==================== 4. EL PROBLEMA ==================== */}
      <section id="problema" className="landing-section landing-section-light landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} data-section="problema" ref={(el) => (sectionRefs.current.problema = el)}>
          <div className={`landing-section-header ${visibleSections.problema ? 'revealed' : ''}`}>
            <span className="landing-section-subtitle">El Problema</span>
            <h2>¿Por qué <span style={{ color: '#D4AF37' }}>sí urge</span> actuar?</h2>
            <p>Porque hay tres cosas que casi siempre pasan al mismo tiempo... y juntas pegan más de lo que parece.</p>
          </div>
          <div className="landing-problems-grid">
            <div className={`landing-problem-card stagger-1 ${visibleSections.problema ? 'revealed' : ''}`}>
              <span className="problem-number">01</span>
              <div className="landing-problem-icon"><BarChart3 size={24} strokeWidth={2} /></div>
              <h3>Tu AFORE NUNCA va a ser suficiente</h3>
              <p>
                Aunque si cuenta, para muchas personas no alcanza por sí sola para sostener el estilo
                de vida que quisieran en retiro. Esperar a que "eso se resuelva solo" normalmente sale caro.
              </p>
            </div>
            <div className={`landing-problem-card stagger-2 ${visibleSections.problema ? 'revealed' : ''}`}>
              <span className="problem-number">02</span>
              <div className="landing-problem-icon"><Wallet size={24} strokeWidth={2} /></div>
              <h3>Pagas impuestos... pero no los estás usando a tu favor</h3>
              <p>
                Muchas personas hacen sus deducciones normales, pero no aprovechan herramientas orientadas
                al retiro que podrían ayudarles a ordenar mejor su estrategia fiscal.
              </p>
            </div>
            <div className={`landing-problem-card stagger-3 ${visibleSections.problema ? 'revealed' : ''}`}>
              <span className="problem-number">03</span>
              <div className="landing-problem-icon"><Clock size={24} strokeWidth={2} /></div>
              <h3>El tiempo cuenta para construir patrimonio... y mucho.</h3>
              <p>
                Cada año que pasa sin planear retiro pesa. Porque después necesitas ahorrar más,
                más rápido y con más presión para llegar al mismo objetivo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 5. SOLUCION ==================== */}
      <section id="solucion" className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} data-section="solucion" ref={(el) => (sectionRefs.current.solucion = el)}>
          <div className={`landing-section-header ${visibleSections.solucion ? 'revealed' : ''}`}>
            <span className="landing-section-subtitle">La Solución</span>
            <h2>Aquí no solo hablas de retiro. Aquí armas una <span style={{ color: '#D4AF37' }}>estrategia inteligente.</span></h2>
            <p>Tres piezas que juntas te ayudan a ver mejor tu dinero hoy y construir mejor tu futuro mañana.</p>
          </div>
          <div className="landing-services-grid">
            <div className={`landing-service-card stagger-1 ${visibleSections.solucion ? 'revealed' : ''}`}>
              <span className="service-step-number">1</span>
              <div className="landing-service-icon"><Landmark size={30} strokeWidth={1.5} color="#003DA5" /></div>
              <h3>Plan Personal de Retiro (PPR)</h3>
              <p>Un vehículo pensado para ayudarte a construir retiro con visión de largo plazo.</p>
              <span className="service-tag">Inversión</span>
            </div>
            <div className={`landing-service-card stagger-2 ${visibleSections.solucion ? 'revealed' : ''}`}>
              <span className="service-step-number">2</span>
              <div className="landing-service-icon"><TrendingUp size={30} strokeWidth={1.5} color="#003DA5" /></div>
              <h3>Estrategia Fiscal C<span className="oo-infinity">oo</span>l</h3>
              <p>Te ayudamos a entender cómo conectar ahorro, retiro y deducción de una forma clara, ordenada y aterrizada a tu caso.</p>
              <span className="service-tag">Optimización</span>
            </div>
            <div className={`landing-service-card stagger-3 ${visibleSections.solucion ? 'revealed' : ''}`}>
              <span className="service-step-number">3</span>
              <div className="landing-service-icon"><GraduationCap size={30} strokeWidth={1.5} color="#003DA5" /></div>
              <h3>Educación Financiera sin r<span className="oo-infinity">o</span>ll<span className="oo-infinity">o</span></h3>
              <p>Porque antes de decidir, necesitas entender. Y entender bien cambia por completo la forma en la que usas tu dinero.</p>
              <span className="service-tag">Educación</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 6. CONCEPTO VIRAL ==================== */}
      <section className="landing-section landing-section-blue landing-section-padding" data-section="viral" ref={(el) => (sectionRefs.current.viral = el)}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className={`landing-section-header ${visibleSections.viral ? 'revealed' : ''}`} style={{ marginBottom: '1.5rem' }}>
            <span className="landing-section-subtitle" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>SAT vs Tu Estrategia</span>
            <h2 style={{ color: 'white' }}>Sí, el SAT puede sentirse como el villano... <span style={{ color: '#D4AF37' }}>pero no tienes que jugar sin estrategia</span></h2>
          </div>
          <div className="sat-grid">
            <div className="sat-video-col">
              <LazyVideo src="/assets/hero-shield.mp4" className="sat-video-wrapper" globalMuted={isMuted} />
            </div>
            <div className="sat-text-col">
              <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '1.25rem' }}>
                La idea no es "pelearte" con el SAT. La idea es dejar de improvisar.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem', lineHeight: '1.8', marginBottom: '2rem' }}>
                Si ya generas ingresos, si ya pagas impuestos y si además quieres construir algo para ti,
                vale la pena revisar si estás usando bien las herramientas que existen.
              </p>
              <div className="sat-badge-row">
                <div className="sat-ppr-badge">
                  <Shield size={18} strokeWidth={2} />
                  <span>Respaldado por tu PPR</span>
                </div>
              </div>
              <button className="landing-btn landing-btn-gold" onClick={() => scrollToSection('simulador')} style={{ marginTop: '1.5rem' }}>
                Quiero revisar mi caso
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 7. CALCULADORA ISR 2026 ==================== */}
      <section id="simulador" className="landing-section landing-section-light" style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', padding: '2rem 1.5rem' }} data-section="simulador" ref={(el) => (sectionRefs.current.simulador = el)}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <span className="landing-section-subtitle" style={{ marginBottom: '0.25rem' }}>Simulador Fiscal 2026</span>
            <h2 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', color: '#001233', fontFamily: "'Playfair Display', serif", fontWeight: 700, margin: 0 }}>¿Cuánto pagas de impuestos? Ponlo en números.</h2>
          </div>
          <div className={`tax-calc-container ${visibleSections.simulador ? 'revealed' : ''}`}>
            <div className="tax-calc-grid">
              {/* LEFT: Input + Deducciones fijas */}
              <div className="tax-calc-inputs">
                <div className="tax-input-group">
                  <label>Ingreso Anual Bruto</label>
                  <input
                    type="number" placeholder="Ej: 1,200,000"
                    value={taxCalc.ingresoAnual || ''}
                    onChange={(e) => setTaxCalc({ ...taxCalc, ingresoAnual: Number(e.target.value) })}
                  />
                </div>
                <div className="tax-input-group">
                  <label>Otros Ingresos Anuales</label>
                  <input
                    type="number" placeholder="Ej: 0"
                    value={taxCalc.otrosIngresos || ''}
                    onChange={(e) => setTaxCalc({ ...taxCalc, otrosIngresos: Number(e.target.value) })}
                  />
                </div>

                {/* Deducciones personales - INFO FIJA */}
                <div style={{ background: '#F7F8FC', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginTop: '0.15rem', border: '1px solid rgba(0,61,165,0.08)' }}>
                  <h4 style={{ color: '#003DA5', fontSize: '0.8rem', marginBottom: '0.3rem', fontWeight: 700 }}>Deducciones personales autorizadas</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {[
                      { name: 'Honorarios médicos y dentales', limit: 'Hasta 15% ingreso' },
                      { name: 'Gastos funerarios', limit: 'Hasta $42,795' },
                      { name: 'Donativos', limit: 'Hasta 7% ingreso' },
                      { name: 'Intereses créditos hipotecarios', limit: 'Hasta 750k UDIs' },
                      { name: 'Seguro de GMM', limit: 'Sin tope' },
                      { name: 'Transporte escolar', limit: 'Sin tope' },
                    ].map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0', borderBottom: i < 5 ? '1px solid rgba(0,61,165,0.06)' : 'none' }}>
                        <span style={{ fontSize: '0.75rem', color: '#2D3436', fontWeight: 500 }}>{d.name}</span>
                        <span style={{ fontSize: '0.7rem', color: '#003DA5', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{d.limit}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.3rem', background: 'linear-gradient(135deg, rgba(0,61,165,0.06), rgba(0,61,165,0.02))', borderRadius: '0.4rem', padding: '0.4rem 0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#003DA5', fontWeight: 700 }}>Tope máximo deducible</span>
                    <span style={{ fontSize: '0.9rem', color: '#003DA5', fontWeight: 700 }}>{formatMXN(taxResults.maxDeduciblePersonal)}</span>
                  </div>
                </div>

                {/* PPR - APARTE de deducciones personales - INFO FIJA */}
                <div style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02))', borderRadius: '0.75rem', padding: '0.75rem 1rem', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <h4 style={{ color: '#003DA5', fontSize: '0.8rem', margin: '0 0 0.2rem', fontWeight: 700 }}>Plan Personal de Retiro (PPR)</h4>
                  <p style={{ fontSize: '0.7rem', color: '#4B5563', margin: '0 0 0.15rem', lineHeight: 1.4 }}>Una deducción adicional e independiente a las personales. Tú decides cuánto aportar cada año.</p>
                  <p style={{ fontSize: '0.65rem', color: '#9CA3AF', margin: 0, lineHeight: 1.4 }}>Incluye aportaciones a PPR y primas de seguros de retiro (Art. 185 LISR).</p>
                </div>
              </div>

              {/* RIGHT: Resultados Premium */}
              <div className="tax-results">
                <h3>Tu escenario fiscal 2026</h3>

                {/* Top stats */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div className="tax-stat-card" style={{ flex: 1 }}>
                    <div className="stat-label" style={{ color: '#E05252' }}>Pagas de impuestos</div>
                    <div className="stat-value" style={{ color: '#E05252' }}>{formatMXN(taxResults.isrSinDed)}</div>
                    <div className="stat-sub">sin deducciones</div>
                  </div>
                  <div className="tax-stat-card" style={{ flex: 1 }}>
                    <div className="stat-label" style={{ color: '#E8A030' }}>Pierdes en deducciones</div>
                    <div className="stat-value" style={{ color: '#E8A030' }}>{formatMXN(taxResults.deduciblesNoUsados)}</div>
                    <div className="stat-sub">en ahorro fiscal</div>
                  </div>
                </div>

                {/* Hero result */}
                <div className="tax-hero-card" style={{ marginBottom: '0.6rem' }}>
                  <div style={{ fontSize: '0.6rem', color: '#34D399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>Con estrategia fiscal pagarías</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34D399', fontFamily: "'Montserrat', sans-serif", lineHeight: 1.1 }}>{formatMXN(taxResults.isrConDedConRetiro)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>
                    Ahorras <span style={{ color: '#34D399', fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>{formatMXN(taxResults.devolucion)}</span> al año
                  </div>
                </div>

                {/* Detail rows */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <div className="tax-result-row">
                    <span className="tax-result-label">Ingreso real (después de ISR)</span>
                    <span className="tax-result-value">{formatMXN(taxResults.ingresoReal)}</span>
                  </div>
                  <div className="tax-result-row">
                    <span className="tax-result-label">Promedio mensual</span>
                    <span className="tax-result-value">{formatMXN(taxResults.mensual)}</span>
                  </div>
                  <div className="tax-result-row">
                    <span className="tax-result-label">Tasa marginal</span>
                    <span className="tax-result-value">{taxResults.pctRecup.toFixed(0)}%</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button className="landing-btn landing-btn-gold" onClick={() => scrollToSection('contacto')} style={{ fontSize: '0.8rem', padding: '0.65rem 1.5rem' }}>
                    Quiero mi estrategia fiscal personalizada
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 8. PARA QUIEN + CONFIANZA ==================== */}
      <section className="landing-section landing-trust-bar landing-section-padding" data-section="paraquien" ref={(el) => (sectionRefs.current.paraquien = el)}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className={`landing-section-header ${visibleSections.paraquien ? 'revealed' : ''}`} style={{ marginBottom: '2rem' }}>
            <span className="landing-section-subtitle" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>Te Identificas</span>
            <h2 style={{ color: 'white', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>Esto hace sentido si tú piensas algo así...</h2>
          </div>

          <div className="paraquien-grid">
            <div className="paraquien-cards-col">
              {[
                { icon: <Briefcase size={20} strokeWidth={2} />, text: '"Mi dinero no está construyendo futuro."' },
                { icon: <FileText size={20} strokeWidth={2} />, text: '"Pago impuestos y no sé si lo hago de la mejor forma."' },
                { icon: <Target size={20} strokeWidth={2} />, text: '"Quiero ahorrar con estrategia, no a ciegas."' },
                { icon: <Clock size={20} strokeWidth={2} />, text: '"No quiero llegar a los 60 y empezar a preocuparme."' },
                { icon: <Lightbulb size={20} strokeWidth={2} />, text: '"Que alguien me explique esto fácil."' },
              ].map((item, i) => (
                <div key={i} className={`pq-card reveal-left stagger-${i + 1} ${visibleSections.paraquien ? 'revealed' : ''}`}>
                  <span className="pq-icon">{item.icon}</span>
                  <span className="pq-text">{item.text}</span>
                </div>
              ))}
              <p className="pq-cta-text">Si te sonó una sola, ya vale la pena revisarlo.</p>
            </div>

            <div className="paraquien-stats-col">
              <div className="trust-stat-card" ref={trustRef1}>
                <div className="trust-stat-number">{trustCount1}+</div>
                <div className="trust-stat-label">Clientes asesorados</div>
                <Users size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
              <div className="trust-stat-card" ref={trustRef2}>
                <div className="trust-stat-number">{trustCount2}%</div>
                <div className="trust-stat-label">Enfoque regulado</div>
                <CheckCircle size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
              <div className="trust-stat-card" ref={trustRef3}>
                <div className="trust-stat-number">{trustCount3}+</div>
                <div className="trust-stat-label">Años de experiencia fiscal</div>
                <Brain size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
              <div className="trust-stat-card">
                <div className="trust-stat-number">AAA</div>
                <div className="trust-stat-label">Respaldo institucional</div>
                <Shield size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
            </div>
          </div>
          <div className="live-banner-wrapper">
            <div className="live-banner">
              <span className="live-dot"></span>
              <span className="live-text">En este momento <strong className="live-count">{liveUsers} personas</strong> están solicitando la consultoría</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 10. QUIENES SOMOS ==================== */}
      <section className="landing-section landing-section-light" style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', padding: '2rem 1.5rem' }} data-section="about" ref={(el) => (sectionRefs.current.about = el)}>
        <div className="about-full" ref={(el) => (observerRefs.current[9] = el)}>
          <div className={`landing-section-header ${visibleSections.about ? 'revealed' : ''}`} style={{ marginBottom: '1.5rem' }}>
            <span className="landing-section-subtitle">Quiénes Somos</span>
            <h2>No somos la típica firma que te habla complicado <span style={{ color: '#D4AF37' }}>para sonar inteligente</span></h2>
            <p>En Finance S C<span className="oo-infinity">oo</span>l creemos que la verdadera inteligencia está en hacer entendible lo importante. Por eso acompañamos a personas y familias a tomar mejores decisiones sobre:</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#003DA5', margin: 0 }}>Prioridades financieras</h3>
          </div>
          <div className="about-pillars">
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Shield size={28} strokeWidth={1.5} /></div>
              <h4>Reservas para contingencias</h4>
              <p>Protege lo que ya tienes ante lo inesperado.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Wallet size={28} strokeWidth={1.5} /></div>
              <h4>Respaldo de gasto fijo</h4>
              <p>Asegura que tu estilo de vida no dependa de un solo ingreso.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><TrendingUp size={28} strokeWidth={1.5} /></div>
              <h4>Construcción de Ingresos Pasivos</h4>
              <p>Haz que tu dinero trabaje por ti, no al revés.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><HandCoins size={28} strokeWidth={1.5} /></div>
              <h4>Incentivos Fiscales para personas físicas</h4>
              <p>Aprovecha las herramientas legales que el SAT pone a tu disposición.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Heart size={28} strokeWidth={1.5} /></div>
              <h4>Apoyar el sueño de alguien más</h4>
              <p>Construye un legado que trascienda más allá de ti.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Landmark size={28} strokeWidth={1.5} /></div>
              <h4>Jubilación / Retiro</h4>
              <p>Planea hoy para que mañana tú pongas las reglas.</p>
            </div>
          </div>

          <div className="about-highlight-bar">
            <p>Si lo entiendes, lo puedes <span>decidir mejor.</span> Y si lo decides mejor, tu dinero <span>trabaja distinto.</span></p>
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section id="faq" className="landing-section landing-section-gray landing-section-padding" data-section="faq" ref={(el) => (sectionRefs.current.faq = el)}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className={`landing-section-header ${visibleSections.faq ? 'revealed' : ''}`}>
            <span className="landing-section-subtitle">Dudas Comunes</span>
            <h2>Preguntas Frecuentes</h2>
          </div>
          <div className="landing-faq-container">
            {faqItems.map((item, idx) => (
              <div key={idx} className={`landing-faq-item ${openFaqIndex === idx ? 'open' : ''}`}>
                <div className="landing-faq-question" onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}>
                  <span>{item.question}</span>
                  <span className="landing-faq-toggle">&#9660;</span>
                </div>
                <div className="landing-faq-answer">{item.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 11. FORMULARIO DE CONVERSION ==================== */}
      <section id="contacto" className="landing-section landing-section-light landing-section-padding" data-section="contacto" ref={(el) => (sectionRefs.current.contacto = el)}>
        <div className={`landing-contact-form-container ${visibleSections.contacto ? 'revealed' : ''}`}>
          <h2>Descubre si hoy puedes hacer más con tu dinero</h2>
          <p className="form-subcopy">
            Déjanos tus datos y uno de nuestros consultores te ayuda a revisar si esta estrategia hace sentido para ti.
          </p>
          {formStatus === 'success' && <div className="landing-form-success-message">¡Gracias! Nos pondremos en contacto pronto.</div>}
          {formStatus === 'error' && <div className="landing-form-error-message">Hubo un error. Intenta nuevamente.</div>}
          <form onSubmit={handleFormSubmit}>
            <div className="landing-form-group">
              <label>Nombre</label>
              <input type="text" placeholder="Tu nombre completo" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="landing-form-row">
              <div className="landing-form-group">
                <label>Teléfono</label>
                <input type="tel" placeholder="+52 55 1234 5678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
              </div>
              <div className="landing-form-group">
                <label>Correo</label>
                <input type="email" placeholder="tu@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
            </div>
            <div className="landing-form-row">
              <div className="landing-form-group">
                <label>Tipo de ingreso</label>
                <select value={formData.incomeType} onChange={(e) => setFormData({ ...formData, incomeType: e.target.value })} required>
                  <option value="">Selecciona...</option>
                  <option value="empleado">Empleado</option>
                  <option value="freelancer">Freelancer / Independiente</option>
                  <option value="empresario">Empresario</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
              <div className="landing-form-group">
                <label>Ingreso aproximado mensual</label>
                <select value={formData.approxIncome} onChange={(e) => setFormData({ ...formData, approxIncome: e.target.value })} required>
                  <option value="">Selecciona...</option>
                  <option value="20k-50k">$20,000 - $50,000</option>
                  <option value="50k-100k">$50,000 - $100,000</option>
                  <option value="100k-200k">$100,000 - $200,000</option>
                  <option value="200k+">$200,000+</option>
                </select>
              </div>
            </div>
            <div className="landing-form-row">
              <div className="landing-form-group">
                <label>¿Haces declaración anual?</label>
                <select value={formData.declaracion} onChange={(e) => setFormData({ ...formData, declaracion: e.target.value })}>
                  <option value="">Selecciona...</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                  <option value="no_se">No estoy seguro</option>
                </select>
              </div>
              <div className="landing-form-group">
                <label>¿Ya tienes algo para tu retiro?</label>
                <select value={formData.retiroPlan} onChange={(e) => setFormData({ ...formData, retiroPlan: e.target.value })}>
                  <option value="">Selecciona...</option>
                  <option value="si_ppr">Sí, tengo PPR</option>
                  <option value="si_otro">Sí, otro instrumento</option>
                  <option value="no">No, nada aún</option>
                  <option value="no_se">No sé</option>
                </select>
              </div>
            </div>
            <button type="submit" className="landing-form-submit" disabled={formStatus === 'loading'}>
              {formStatus === 'loading' ? 'Enviando...' : 'Quiero mi diagnóstico personalizado'}
            </button>
          </form>
        </div>
      </section>

      {/* ==================== 12. CIERRE FINAL ==================== */}
      <section className="landing-section landing-section-light landing-section-padding">
        <div className="landing-cta-section">
          {/* Floating particles */}
          <div className="cta-particles">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="cta-particle" style={{
                left: `${8 + (i * 7.5)}%`,
                animationDuration: `${4 + Math.random() * 6}s`,
                animationDelay: `${Math.random() * 5}s`,
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                background: i % 3 === 0 ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.15)',
              }} />
            ))}
          </div>

          <div className="landing-cta-content">
            <h2 className="cta-main-headline">
              Imagina un retiro donde tú pongas las reglas.
            </h2>
            <p className="cta-sub-headline">
              Retírate joven, comienza ahora.
            </p>
            <div className="cta-divider"></div>
            <p className="cta-body-text">
              Cuando entiendes cómo conectar estrategia fiscal, ahorro y retiro, las decisiones cambian.
              Y cuando alguien por fin te lo explica fácil, también cambia tu forma de verlo.
            </p>
            <div className="brand-tagline" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <Logo height={40} variant="light" layout="inline" animated />
              <p>Porque las finanzas también se pueden entender c<span className="oo-infinity">oo</span>l.</p>
            </div>
            <button className="landing-btn landing-btn-gold cta-btn-pulse" onClick={() => scrollToSection('contacto')} style={{ marginTop: '0.5rem', fontSize: '1.15rem', padding: '1.15rem 3rem', letterSpacing: '0.03em' }}>
              Agenda tu consultoría fiscal y financiera AHORA
            </button>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-column">
            <Logo height={55} variant="light" />
            <p style={{ marginTop: '12px' }}>
              Porque las finanzas también se pueden entender cool.
              Estrategia fiscal + PPR + Educación financiera.
            </p>
          </div>
          <div className="landing-footer-column">
            <h3>Links</h3>
            <a href="#problema">Problema</a>
            <a href="#solucion">Solución</a>
            <a href="#simulador">Simulador</a>
            <a href="#faq">FAQ</a>
            <a href="#contacto">Contacto</a>
          </div>
          <div className="landing-footer-column">
            <h3>Síguenos</h3>
            <div className="landing-social-links">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Camera size={18} /></a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><Linkedin size={18} /></a>
              <a href="https://wa.me/5215551234567" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; 2026 Finance SCool. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* WhatsApp Button */}
      <button className="landing-sound-toggle" onClick={() => setIsMuted(!isMuted)} aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}>
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      <a
        href="https://wa.me/5215551234567?text=Hola%20Finance%20SCool%2C%20quiero%20agendar%20una%20consulta"
        target="_blank" rel="noopener noreferrer"
        className="landing-whatsapp-button" aria-label="WhatsApp"
      >
        <MessageCircle size={28} />
      </a>
    </>
  );
}
