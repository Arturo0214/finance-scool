/**
 * Finance SCool — Tracking utilities
 * Meta Pixel events + UTM attribution + Lead source detection
 *
 * Replicado del sistema de Tesipedia (tracking.js + index.html)
 *
 * SETUP: Asegúrate de que el Meta Pixel esté instalado en index.html
 *        con tu Pixel ID de Finance SCool.
 */

// ==================== UTM / Atribución ====================

/**
 * Obtener UTMs guardados del sessionStorage
 * Se capturan automáticamente al cargar la página (ver index.html)
 */
export function getUTMParams() {
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'referrer'];
  const params = {};
  keys.forEach(key => {
    const val = sessionStorage.getItem(key);
    if (val) params[key] = val;
  });
  return params;
}

/**
 * Detectar fuente del lead basado en UTMs y referrer
 * Retorna un string identificador como: "meta_campana_ppr", "google_ads", "instagram_organic", "direct"
 */
export function detectLeadSource() {
  const utms = getUTMParams();

  // Facebook / Meta Ads
  if (utms.fbclid || utms.utm_source?.includes('facebook') || utms.utm_source?.includes('meta') || utms.utm_source?.includes('ig')) {
    return `meta_${utms.utm_campaign || 'direct'}`;
  }

  // Google Ads
  if (utms.gclid || utms.utm_source?.includes('google')) {
    return `google_${utms.utm_campaign || 'ads'}`;
  }

  // Otro UTM source
  if (utms.utm_source) return utms.utm_source;

  // Referrer (tráfico orgánico)
  if (utms.referrer) {
    if (utms.referrer.includes('instagram')) return 'instagram_organic';
    if (utms.referrer.includes('facebook')) return 'facebook_organic';
    if (utms.referrer.includes('tiktok')) return 'tiktok_organic';
    if (utms.referrer.includes('google')) return 'google_organic';
    if (utms.referrer.includes('linkedin')) return 'linkedin_organic';
    return 'referral';
  }

  return 'direct';
}

/**
 * Generar URL de WhatsApp con tracking embebido
 * Al hacer clic en "Agendar asesoría" desde la landing, el mensaje
 * incluye la fuente para que el bot/n8n pueda rastrear de dónde viene
 */
export function getWhatsAppURL(phone = '5215583352096') {
  const source = detectLeadSource();
  const utms = getUTMParams();
  const campaign = utms.utm_campaign || 'web';
  const medium = utms.utm_medium || 'organic';

  // Codificar fuente en el mensaje inicial
  const message = encodeURIComponent(
    `Hola, vi su página y me interesa una asesoría fiscal. [src:${source}|cmp:${campaign}|med:${medium}]`
  );

  return `https://wa.me/${phone}?text=${message}`;
}


// ==================== Meta Pixel Events ====================

/**
 * Track Lead — Cuando alguien solicita asesoría o usa la calculadora
 */
export function trackMetaLead(data = {}) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', {
      content_name: data.tipo || 'Asesoría Fiscal',
      content_category: data.categoria || 'PPR',
      value: data.valor_estimado || 0,
      currency: 'MXN',
      // Datos custom para análisis
      lead_source: detectLeadSource(),
      ingreso_mensual: data.ingreso || null,
    });
  }
}

/**
 * Track Schedule — Cuando alguien agenda una cita desde la web
 */
export function trackMetaSchedule(data = {}) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Schedule', {
      content_name: 'Asesoría Fiscal FSC',
      value: data.valor || 0,
      currency: 'MXN',
    });
  }
}

/**
 * Track CompleteRegistration — Cuando completa el flujo del bot y agenda
 * (se dispara desde el backend/n8n vía Conversions API)
 */
export function trackMetaCompleteRegistration(data = {}) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'CompleteRegistration', {
      content_name: data.tipo_cita || 'Asesoría 30min',
      value: data.valor || 0,
      currency: 'MXN',
    });
  }
}

/**
 * Track ViewContent — Cuando ve secciones clave de la landing
 */
export function trackMetaViewContent(data = {}) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', {
      content_name: data.seccion || 'Landing',
      content_category: 'Finance SCool',
    });
  }
}

/**
 * Track InitiateCheckout — Cuando inicia la calculadora ISR
 */
export function trackMetaInitiateCheckout(data = {}) {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', {
      value: data.ahorro_estimado || 0,
      currency: 'MXN',
      content_name: 'Calculadora ISR 2026',
      num_items: 1,
    });
  }
}

/**
 * Track evento custom — Para eventos específicos de FSC
 */
export function trackMetaCustom(eventName, data = {}) {
  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, {
      ...data,
      lead_source: detectLeadSource(),
    });
  }
}


// ==================== Eventos específicos de Finance SCool ====================

/**
 * Track cuando alguien usa la calculadora ISR y ve resultado
 */
export function trackCalculadoraISR(ingresoMensual, ahorroEstimado) {
  trackMetaCustom('CalculadoraISR', {
    ingreso_mensual: ingresoMensual,
    ahorro_estimado: ahorroEstimado,
    rango_ingreso: ingresoMensual >= 70000 ? 'alto' : ingresoMensual >= 30000 ? 'medio' : 'bajo',
  });

  // Si el ingreso es +$35K, es un lead de alto valor — disparar Lead event
  if (ingresoMensual >= 35000) {
    trackMetaLead({
      tipo: 'Calculadora ISR - Lead Calificado',
      categoria: 'PPR',
      valor_estimado: ahorroEstimado,
      ingreso: ingresoMensual,
    });
  }
}

/**
 * Track clic en botón de WhatsApp (CTA principal)
 */
export function trackWhatsAppClick(ubicacion = 'hero') {
  trackMetaCustom('WhatsAppClick', {
    ubicacion,  // 'hero', 'calculadora', 'footer', 'sticky'
  });

  // También disparar Lead estándar
  trackMetaLead({
    tipo: `Click WhatsApp - ${ubicacion}`,
    categoria: 'Asesoría Fiscal',
  });
}

/**
 * Track scroll depth (para medir engagement con la landing)
 */
export function initScrollTracking() {
  const thresholds = [25, 50, 75, 100];
  const fired = new Set();

  window.addEventListener('scroll', () => {
    const scrollPct = Math.round(
      (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
    );

    for (const t of thresholds) {
      if (scrollPct >= t && !fired.has(t)) {
        fired.add(t);
        trackMetaCustom('ScrollDepth', { percent: t });
      }
    }
  }, { passive: true });
}
