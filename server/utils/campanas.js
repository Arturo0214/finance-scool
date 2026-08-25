/**
 * Motor de Campañas de incentivos (p.ej. "Rumbo a la Grandeza" de Prudential).
 * Estas campañas se suben varias veces al año; cada una define su tabla de puntos
 * por prima mensual, ponderaciones por producto, categorías/premios y requisitos.
 * El motor calcula, por agente, su Prima de Campaña, puntos, categoría actual y
 * qué le falta para la siguiente — leído de la base de primas de FSC.
 *
 * CAPA 1 (activa): usa prima_pagada_inicial por mes (1er año) desde crm_pru_primas.
 * CAPA 2 (pendiente de feed): ponderación por producto (Riders 300%, Retiro Plus
 * 200%, etc.). Requiere un feed de producción por producto en la ventana; mientras
 * no exista, `ponderado=false` y la prima cuenta 1:1. El mapeo plan_id→producto
 * vive en definicion.producto_map (borrador, a confirmar por Flavio).
 */
const MES_NUM = { jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* Producto de campaña para un plan_id, según el mapeo (prefijo más largo gana). */
function productoDePlan(planId, mapa) {
  if (!mapa || !Array.isArray(mapa.prefijos)) return mapa?._default || 'Resto de Productos';
  const p = String(planId || '').toUpperCase();
  const hit = [...mapa.prefijos]
    .sort((a, b) => (b.p || '').length - (a.p || '').length)
    .find(x => x.p && p.startsWith(String(x.p).toUpperCase()));
  return hit ? hit.producto : (mapa._default || 'Resto de Productos');
}

/**
 * @param def          definicion de la campaña (jsonb de crm_campanas)
 * @param primas        filas crm_pru_primas del agente (con anio, mes, prima_pagada_inicial)
 * @param opts.anio     año de la campaña (default 2026)
 * @param opts.indiceConservacion  índice operativo/realista del agente (0-1) para el requisito 86%
 */
function computeCampana(def, primas, { anio = 2026, indiceConservacion = null } = {}) {
  const meses = def.meses || ['jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const tiers = [...(def.tabla_puntos || [])].sort((a, b) => b.prima_min - a.prima_min);

  let totalPuntos = 0, mesesMeta = 0, primaTotal = 0;
  const porMes = meses.map((m) => {
    const mesNum = MES_NUM[m];
    const row = (primas || []).find(p => Number(p.anio) === anio && Number(p.mes) === mesNum);
    const conData = !!row;
    const prima = conData ? Number(row.prima_pagada_inicial) || 0 : 0;
    const factor = m === 'jul' ? (def.julio_factor_prima || 1) : 1; // julio: umbrales al 50%
    let pts = 0, tier = null;
    for (const t of tiers) {
      if (prima >= t.prima_min * factor) { pts = t[m] || 0; tier = t.prima_min; break; }
    }
    if (conData) primaTotal += prima;
    if (pts > 0) mesesMeta++;
    totalPuntos += pts;
    return { mes: m, prima: round2(prima), puntos: pts, tier, con_data: conData };
  });

  const ex = def.extras_constancia || {};
  const extras = mesesMeta >= 6 ? (ex['6_meses'] || 0) : mesesMeta >= 5 ? (ex['5_meses'] || 0) : 0;
  const puntos = totalPuntos + extras;

  const cats = [...(def.categorias || [])].sort((a, b) => a.puntos_min - b.puntos_min);
  let categoria = null;
  for (const c of cats) if (puntos >= c.puntos_min) categoria = c;
  const siguiente = cats.find(c => c.puntos_min > puntos) || null;

  const rq = def.requisitos || {};
  const requisitos = {
    conservacion: indiceConservacion != null
      ? { valor: round2(indiceConservacion), min: rq.conservacion_min ?? 0.86, ok: indiceConservacion >= (rq.conservacion_min ?? 0.86) }
      : null,
    // El 5% de Riders y el "sin decremento" requieren prima por producto / histórico → capa 2
    riders: { ok: null, min: rq.riders_min_pct ?? 0.05, nota: 'Requiere prima por producto (feed pendiente)' },
  };

  return {
    prima_campana: round2(primaTotal), puntos_base: totalPuntos, extras, puntos,
    meses_meta: mesesMeta, por_mes: porMes,
    categoria, siguiente, faltan_siguiente: siguiente ? Math.max(0, siguiente.puntos_min - puntos) : 0,
    requisitos, ponderado: false,
  };
}

module.exports = { computeCampana, productoDePlan, MES_NUM };
