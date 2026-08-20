/**
 * Motor del Tablero de Ingresos (PIR Prudential).
 *
 * Reglas (validadas contra el Business Review xlsb, caso C17036 2Q-2026):
 *  - Índice de conservación = base conservada / base a conservar.
 *    La base viene del detalle por póliza (crm_pru_polizas_indice); la ventana
 *    (alta del agente → hoy-15 meses) ya viene resuelta en ese detalle.
 *  - Agente con < 15 meses: sin índice propio, bonifica como si estuviera en 0.90.
 *  - Índice < 0.86: cero bonos aunque se alcance la prima.
 *  - Bono mensual: rango por prima ubicación DEL MES → % × prima pagada inicial del mes.
 *  - Bono trimestral: rango por prima ubicación DEL TRIMESTRE → % × prima pagada
 *    inicial del trimestre; se paga como ajuste (menos los mensuales ya generados).
 *  - Bono conservación: rango por prima ubicación del trimestre → % × prima pagada
 *    de RENOVACIÓN del trimestre.
 */
const PIR_DEFAULT = require('../data/pir2026.json');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const cuadernoKey = (c) => String(c || 'NOVEL').toUpperCase().replace(/\s+/g, '_');

/* Umbral de índice aplicable: '0.94' | '0.90' | '0.86' | null (sin bono) */
function umbralDe(indice, esNuevo) {
  const idx = esNuevo ? 0.90 : indice;
  if (idx >= 0.94) return '0.94';
  if (idx >= 0.90) return '0.90';
  if (idx >= 0.86) return '0.86';
  return null;
}

/* Mejor rango alcanzado con una prima dada (rangos ordenados de mayor a menor) */
function rangoAlcanzado(tabla, prima) {
  if (!tabla || !Array.isArray(tabla.rangos)) return null;
  for (const r of tabla.rangos) if (prima >= r.prima_min) return r;
  return null;
}

function calcularBonoPir(tabla, primaUbicacion, aplicaSobre, umbral) {
  const r = rangoAlcanzado(tabla, primaUbicacion);
  if (!r || !umbral) return { rango: null, pct: 0, monto: 0 };
  const pct = r.pct[umbral] || 0;
  return { rango: r.rango, pct, monto: round2(aplicaSobre * pct) };
}

/* "Bonos en juego": qué falta de prima para cada rango y cuánto pagaría cada umbral */
function bonosEnJuego(tabla, primaUbicacion, aplicaSobre) {
  if (!tabla || !Array.isArray(tabla.rangos)) return [];
  return tabla.rangos.map(r => ({
    rango: r.rango,
    prima_min: r.prima_min,
    faltante: Math.max(0, round2(r.prima_min - primaUbicacion)),
    alcanzado: primaUbicacion >= r.prima_min,
    bonos: { '0.86': round2(aplicaSobre * r.pct['0.86']), '0.90': round2(aplicaSobre * r.pct['0.90']), '0.94': round2(aplicaSobre * r.pct['0.94']) },
  }));
}

function mesesDesde(fechaISO, hoy = new Date()) {
  if (!fechaISO) return null;
  const f = new Date(fechaISO);
  return (hoy.getFullYear() - f.getFullYear()) * 12 + (hoy.getMonth() - f.getMonth());
}

/* Índice de conservación desde el detalle de pólizas */
function computeIndice(polizas) {
  let base = 0, conservada = 0, pendiente = 0;
  for (const p of polizas) {
    base += Number(p.base_a_conservar_mxn) || 0;
    if (p.estatus_conservacion === 'CONSERVADA') conservada += Number(p.base_conservada_mxn) || 0;
    else if (p.estatus_conservacion === 'PENDIENTE DE PAGO') pendiente += Number(p.base_a_conservar_mxn) || 0;
  }
  return {
    baseAConservar: round2(base),
    baseConservada: round2(conservada),
    basePendiente: round2(pendiente),
    actual: base > 0 ? conservada / base : 1,
    conPendiente: base > 0 ? (conservada + pendiente) / base : 1,
  };
}

/* Estatus de conservación derivado a una fecha. Regla del Business Review
   (verificada contra las 782 pólizas del corte T2-2026, 0 excepciones):
   Cancelada → NO CONSERVADA; Vigente pagada más allá de la fecha → CONSERVADA;
   Vigente con pago vencido → PENDIENTE DE PAGO. Evaluar con hoy da el índice
   en vivo entre cortes: cambia solo al vencer pagos o al registrarse cobros. */
function derivarEstatus(p, fecha = new Date()) {
  if (String(p.estatus_calculo || '').toUpperCase() !== 'VIGENTE') return 'NO CONSERVADA';
  if (p.pagado_hasta && new Date(p.pagado_hasta) > fecha) return 'CONSERVADA';
  return 'PENDIENTE DE PAGO';
}

/* Meses que cubre un pago según la frecuencia (para avanzar pagado_hasta) */
const MESES_FRECUENCIA = { ANUAL: 12, SEMESTRAL: 6, TRIMESTRAL: 3, MENSUAL: 1 };

const finTrimestre = (f) => new Date(f.getFullYear(), Math.floor(f.getMonth() / 3) * 3 + 3, 0);
const isoLocal = (f) => new Date(f.getTime() - f.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/* ── Rehabilitación de pólizas canceladas ─────────────────────────────────
   Etapas por días desde la última cancelación (regla Prudential / promotoría):
     0-30   → AUTOMATICA: rehabilitación automática, sin trámite del cliente.
     30-90  → CORREO:     renovación/rehabilitación automática con correo de petición.
     90-180 → FIRMA:      requiere firma autógrafa del cliente.
     +180   → VENCIDA:    ya no es rehabilitable.
   Producto PERSONALIZA: ventana ÚNICA de 30 días; pasados 30 días no se puede
   rehabilitar (nunca entra a las etapas de correo/firma). La lista de planes
   PERSONALIZA es configurable (crm_config.personaliza_planes); mientras esté
   vacía, ninguna póliza se trata como PERSONALIZA. */
const REHAB_ETAPAS = {
  AUTOMATICA: { label: 'Rehabilitación automática', metodo: 'Automática — sin trámite del cliente', hasta: 30 },
  CORREO: { label: 'Rehabilitación con correo', metodo: 'Renovación automática con correo de petición', hasta: 90 },
  FIRMA: { label: 'Rehabilitación con firma', metodo: 'Requiere firma autógrafa del cliente', hasta: 180 },
  VENCIDA: { label: 'Fuera de plazo', metodo: 'Ya no es rehabilitable', hasta: null },
};
const URGENCIA_RANK = { EXTREMA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

function diasDesde(fechaISO, hoy = new Date()) {
  if (!fechaISO) return null;
  const d = new Date(fechaISO);
  if (isNaN(d.getTime())) return null;
  return Math.floor((hoy - d) / 86400000);
}

/* Clasifica una póliza cancelada. Devuelve null si no aplica (sin fecha de
   cancelación o cancelación en el futuro). personalizaSet = Set de plan_id
   en MAYÚSCULAS que son PERSONALIZA. */
function clasificarRehabilitacion(p, hoy = new Date(), personalizaSet = null) {
  const dias = diasDesde(p.fecha_ultima_cancelacion, hoy);
  if (dias === null || dias < 0) return null;
  const esPersonaliza = !!personalizaSet && personalizaSet.has(String(p.plan_id || '').toUpperCase());

  let etapa, finEtapa, siguienteEsPerdida;
  if (esPersonaliza) {
    if (dias <= 30) { etapa = 'AUTOMATICA'; finEtapa = 30; siguienteEsPerdida = true; }
    else { etapa = 'VENCIDA'; finEtapa = null; siguienteEsPerdida = false; }
  } else if (dias <= 30) { etapa = 'AUTOMATICA'; finEtapa = 30; siguienteEsPerdida = false; }
  else if (dias <= 90) { etapa = 'CORREO'; finEtapa = 90; siguienteEsPerdida = false; }
  else if (dias <= 180) { etapa = 'FIRMA'; finEtapa = 180; siguienteEsPerdida = true; }
  else { etapa = 'VENCIDA'; finEtapa = null; siguienteEsPerdida = false; }

  const rehabilitable = etapa !== 'VENCIDA';
  const diasParaVencerEtapa = finEtapa != null ? Math.max(0, finEtapa - dias) : 0;
  let urgencia = 'BAJA';
  if (rehabilitable) {
    if (siguienteEsPerdida) {
      // al vencer la etapa la póliza se pierde para siempre → máxima prioridad
      urgencia = diasParaVencerEtapa <= 7 ? 'EXTREMA' : diasParaVencerEtapa <= 20 ? 'ALTA' : 'MEDIA';
    } else {
      // al vencer solo se endurece el trámite (auto→correo→firma)
      urgencia = diasParaVencerEtapa <= 5 ? 'ALTA' : diasParaVencerEtapa <= 15 ? 'MEDIA' : 'BAJA';
    }
  }
  const info = REHAB_ETAPAS[etapa];
  const limite = finEtapa != null
    ? isoLocal(new Date(new Date(p.fecha_ultima_cancelacion).getTime() + finEtapa * 86400000))
    : null;
  return {
    dias_desde_cancelacion: dias,
    es_personaliza: esPersonaliza,
    etapa, etapa_label: info.label, metodo: info.metodo,
    fin_etapa_dias: finEtapa, dias_para_vencer_etapa: diasParaVencerEtapa,
    fecha_limite_etapa: limite,
    rehabilitable, automatizable: etapa === 'AUTOMATICA', urgencia,
  };
}

/* Ordena rehabilitables: primero por urgencia, luego por monto en riesgo */
function ordenRehab(a, b) {
  const u = (URGENCIA_RANK[a.urgencia] ?? 9) - (URGENCIA_RANK[b.urgencia] ?? 9);
  return u !== 0 ? u : (b.monto || 0) - (a.monto || 0);
}

/**
 * Trayectoria del índice a N meses. La ventana del índice solo crece (alta del
 * agente → hoy−15 meses) y las canceladas nunca salen de ella, así que el
 * índice solo se recupera con negocio que va entrando conservado a la ventana.
 * Supuesto del modelo: el agente vende `ventaMensual` de prima cada mes (y lo
 * venía haciendo los últimos 15 meses, que es el negocio que irá madurando a
 * la ventana), del cual se conserva `tasaConservacion`.
 */
function proyectarTrayectoria({ polizas, ventaMensual = 0, tasaConservacion = 0.9, cobrarPendientes = false, meses = 15, hoy = new Date() }) {
  let base = 0, conservada = 0;
  for (const p of polizas) {
    const st = derivarEstatus(p, hoy);
    base += Number(p.base_a_conservar_mxn) || 0;
    if (st === 'CONSERVADA' || (cobrarPendientes && st === 'PENDIENTE DE PAGO'))
      conservada += Number(p.base_a_conservar_mxn) || 0;
  }
  const serie = [];
  const cruces = { '0.86': null, '0.90': null, '0.94': null };
  for (let m = 0; m <= meses; m++) {
    const b = base + m * ventaMensual;
    const c = conservada + m * ventaMensual * tasaConservacion;
    const indice = b > 0 ? Math.round((c / b) * 10000) / 10000 : 1;
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + m, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const u of Object.keys(cruces)) if (!cruces[u] && indice >= Number(u)) cruces[u] = mes;
    serie.push({ mes, indice });
  }
  return { serie, cruces, supuestos: { ventaMensual: round2(ventaMensual), tasaConservacion, cobrarPendientes, meses } };
}

/**
 * Cálculo completo de ingresos PIR de un agente.
 * overrides (simulador): { ventaAdicional, cobrarPolizas: [ids], rehabilitarPolizas: [ids] }
 */
function computeIngresos({ agente, primas, polizas, pir, personalizaPlanes }, overrides = {}) {
  const personalizaSet = new Set((personalizaPlanes || []).map(s => String(s).toUpperCase()));
  const tablas = ((pir || PIR_DEFAULT).cuadernos || {})[cuadernoKey(agente.cuaderno)] ||
    (pir || PIR_DEFAULT).cuadernos.NOVEL;

  const ventaAdicional = Number(overrides.ventaAdicional) || 0;
  const cobrar = new Set(overrides.cobrarPolizas || []);
  const rehabilitar = new Set(overrides.rehabilitarPolizas || []);

  /* Índice (con simulación de cobros/rehabilitaciones) */
  const indiceInfo = computeIndice(polizas);

  /* Índice "hoy": mismo cálculo pero con el estatus derivado a la fecha actual
     en lugar del congelado del corte. La base conservada de una póliza al
     corriente es su base a conservar completa. */
  const hoyRef = new Date();
  const polizasHoy = polizas.map(p => ({
    ...p,
    estatus_conservacion: derivarEstatus(p, hoyRef),
    base_conservada_mxn: p.base_a_conservar_mxn,
  }));
  const indiceHoyInfo = computeIndice(polizasHoy);

  /* Proyección al cierre del trimestre calendario: la misma regla evaluada a
     esa fecha = índice si no se cobra nada de aquí al cierre */
  const cierreQ = finTrimestre(hoyRef);
  const indiceCierre = computeIndice(polizas.map(p => ({
    ...p,
    estatus_conservacion: derivarEstatus(p, cierreQ),
    base_conservada_mxn: p.base_a_conservar_mxn,
  })));
  const vencenAntesDelCierre = polizasHoy
    .filter(p => p.estatus_conservacion === 'CONSERVADA' && derivarEstatus(p, cierreQ) !== 'CONSERVADA')
    .map(p => ({ id: p.id, poliza: p.poliza, plan_id: p.plan_id, frecuencia_pago: p.frecuencia_pago, pagado_hasta: p.pagado_hasta, monto: round2(p.base_a_conservar_mxn), impacto_indice: indiceInfo.baseAConservar > 0 ? (Number(p.base_a_conservar_mxn) || 0) / indiceInfo.baseAConservar : 0 }))
    .sort((a, b) => b.monto - a.monto);
  /* extraConservada sube el índice simulado (que parte de la base conservada
     del corte). Para el operativo lo PENDIENTE DE PAGO ya está contado dentro
     de basePendiente: volver a sumar los pendientes seleccionados duplicaba la
     base y el simulador podía pasar de 100% — solo las rehabilitaciones (no
     conservadas) agregan base nueva al operativo. */
  let extraConservada = 0, extraOperativo = 0;
  for (const p of polizas) {
    const sel = cobrar.has(p.id) || rehabilitar.has(p.id);
    if (!sel || p.estatus_conservacion === 'CONSERVADA') continue;
    const monto = Number(p.base_a_conservar_mxn) || 0;
    extraConservada += monto;
    if (p.estatus_conservacion !== 'PENDIENTE DE PAGO') extraOperativo += monto;
  }
  const conservadaSim = indiceInfo.baseConservada + extraConservada;
  const indiceSim = indiceInfo.baseAConservar > 0
    ? Math.min(1, conservadaSim / indiceInfo.baseAConservar) : 1;

  const meses = mesesDesde(agente.fecha_inicio_calculos);
  const esNuevo = meses !== null && meses < 15;
  /* Índice operativo para bandas: el preliminar del trimestre considera lo
     pendiente de pago (así lo maneja el Business Review) + lo simulado */
  const indiceOperativo = indiceInfo.baseAConservar > 0
    ? Math.min(1, (indiceInfo.baseConservada + indiceInfo.basePendiente + extraOperativo) / indiceInfo.baseAConservar)
    : 1;
  const umbral = umbralDe(indiceOperativo, esNuevo);

  /* Primas del trimestre en curso (última anio/trimestre con datos) */
  const ordenadas = [...primas].sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes));
  const last = ordenadas[ordenadas.length - 1] || { anio: new Date().getFullYear(), trimestre: Math.floor(new Date().getMonth() / 3) + 1 };
  const delQ = ordenadas.filter(p => p.anio === last.anio && p.trimestre === last.trimestre);

  let ubicacionQ = 0, pagadaInicialQ = 0, renovacionQ = 0;
  const mesesQ = delQ.map((p, i) => {
    const ubic = Number(p.prima_ubicacion) || 0;
    const pag = Number(p.prima_pagada_inicial) || 0;
    ubicacionQ += ubic; pagadaInicialQ += pag; renovacionQ += Number(p.prima_pagada_renovacion) || 0;
    /* La venta adicional del simulador se asume en el último mes del Q */
    const esUltimo = i === delQ.length - 1;
    const ubicSim = ubic + (esUltimo ? ventaAdicional : 0);
    const pagSim = pag + (esUltimo ? ventaAdicional : 0);
    const bono = calcularBonoPir(tablas.bono_inicial_mensual, ubicSim, pagSim, umbral);
    return {
      anio: p.anio, mes: p.mes,
      prima_ubicacion: round2(ubicSim), prima_pagada_inicial: round2(pagSim),
      prima_pagada_renovacion: round2(Number(p.prima_pagada_renovacion) || 0),
      bono_mensual: bono,
    };
  });
  ubicacionQ = round2(ubicacionQ + ventaAdicional);
  pagadaInicialQ = round2(pagadaInicialQ + ventaAdicional);
  renovacionQ = round2(renovacionQ);

  const sumaMensuales = round2(mesesQ.reduce((s, m) => s + m.bono_mensual.monto, 0));
  const bonoTrim = calcularBonoPir(tablas.bono_inicial_trimestral, ubicacionQ, pagadaInicialQ, umbral);
  const ajusteTrim = round2(Math.max(0, bonoTrim.monto - sumaMensuales));
  const bonoCons = calcularBonoPir(tablas.bono_conservacion, ubicacionQ, renovacionQ, umbral);

  /* Accionables */
  const hoy = new Date();
  const impacto = (monto) => indiceInfo.baseAConservar > 0 ? monto / indiceInfo.baseAConservar : 0;

  /* Accionables sobre el estatus derivado a hoy, no el del corte: una póliza
     cuyo pago venció después del corte también aparece por cobrar */
  const pendientesPago = polizasHoy
    .filter(p => p.estatus_conservacion === 'PENDIENTE DE PAGO')
    .map(p => ({ id: p.id, poliza: p.poliza, plan_id: p.plan_id, forma_pago: p.forma_pago, frecuencia_pago: p.frecuencia_pago, pagado_hasta: p.pagado_hasta, monto: round2(p.base_a_conservar_mxn), impacto_indice: impacto(Number(p.base_a_conservar_mxn) || 0) }))
    .sort((a, b) => b.monto - a.monto);

  /* Rehabilitables: canceladas clasificadas por etapa (auto/correo/firma) y
     urgencia. Se excluyen las VENCIDAS (+180 días, o PERSONALIZA +30). */
  const rehabilitables = polizasHoy
    .filter(p => p.estatus_conservacion === 'NO CONSERVADA' && p.fecha_ultima_cancelacion)
    .map(p => {
      const c = clasificarRehabilitacion(p, hoy, personalizaSet);
      if (!c) return null;
      return { id: p.id, poliza: p.poliza, plan_id: p.plan_id, forma_pago: p.forma_pago, frecuencia_pago: p.frecuencia_pago, fecha_ultima_cancelacion: p.fecha_ultima_cancelacion, monto: round2(p.base_a_conservar_mxn), impacto_indice: impacto(Number(p.base_a_conservar_mxn) || 0), ...c };
    })
    .filter(r => r && r.rehabilitable)
    .sort(ordenRehab);

  /* Resumen por etapa/urgencia para tableros y alertas */
  const rehabResumen = { total: rehabilitables.length, monto: round2(rehabilitables.reduce((s, r) => s + r.monto, 0)),
    por_etapa: { AUTOMATICA: 0, CORREO: 0, FIRMA: 0 }, por_urgencia: { EXTREMA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 },
    automatizables: rehabilitables.filter(r => r.automatizable).length };
  for (const r of rehabilitables) { rehabResumen.por_etapa[r.etapa]++; rehabResumen.por_urgencia[r.urgencia]++; }

  return {
    agente: {
      clave: agente.clave, nombre: agente.nombre, cuaderno: agente.cuaderno,
      cuaderno_detalle: agente.cuaderno_detalle || null, estatus: agente.estatus,
      fecha_inicio_calculos: agente.fecha_inicio_calculos, mes_agente: agente.mes_agente || meses,
      es_nuevo: esNuevo,
    },
    periodo: { anio: last.anio, trimestre: last.trimestre },
    indice: {
      ...indiceInfo,
      actual: round2(indiceInfo.actual * 10000) / 10000,
      conPendiente: round2(indiceInfo.conPendiente * 10000) / 10000,
      simulado: round2(indiceSim * 10000) / 10000,
      operativo: round2(indiceOperativo * 10000) / 10000,
      umbral, esNuevo,
      minimoBono: 0.86,
      hoy: {
        fecha: isoLocal(hoyRef),
        actual: round2(indiceHoyInfo.actual * 10000) / 10000,
        conPendiente: round2(indiceHoyInfo.conPendiente * 10000) / 10000,
        baseConservada: indiceHoyInfo.baseConservada,
        basePendiente: indiceHoyInfo.basePendiente,
      },
    },
    proyeccion: {
      cierreQ: {
        fecha: isoLocal(cierreQ),
        actual: round2(indiceCierre.actual * 10000) / 10000,
        conPendiente: round2(indiceCierre.conPendiente * 10000) / 10000,
        vencenAntes: vencenAntesDelCierre,
      },
    },
    primas: { ubicacionQ, pagadaInicialQ, renovacionQ },
    bonos: {
      mensuales: mesesQ,
      total_mensuales: sumaMensuales,
      trimestral: { ...bonoTrim, ajuste: ajusteTrim },
      conservacion: bonoCons,
      total_trimestre: round2(sumaMensuales + ajusteTrim + bonoCons.monto),
    },
    enJuego: {
      trimestral: bonosEnJuego(tablas.bono_inicial_trimestral, ubicacionQ, pagadaInicialQ),
      conservacion: bonosEnJuego(tablas.bono_conservacion, ubicacionQ, renovacionQ),
    },
    accionables: { pendientesPago, rehabilitables, rehabResumen },
  };
}

module.exports = { computeIngresos, computeIndice, derivarEstatus, proyectarTrayectoria, clasificarRehabilitacion, ordenRehab, REHAB_ETAPAS, URGENCIA_RANK, umbralDe, cuadernoKey, MESES_FRECUENCIA, PIR_DEFAULT };
