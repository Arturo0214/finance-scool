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

/**
 * Cálculo completo de ingresos PIR de un agente.
 * overrides (simulador): { ventaAdicional, cobrarPolizas: [ids], rehabilitarPolizas: [ids] }
 */
function computeIngresos({ agente, primas, polizas, pir }, overrides = {}) {
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
  let extraConservada = 0;
  for (const p of polizas) {
    const sel = cobrar.has(p.id) || rehabilitar.has(p.id);
    if (sel && p.estatus_conservacion !== 'CONSERVADA') extraConservada += Number(p.base_a_conservar_mxn) || 0;
  }
  const conservadaSim = indiceInfo.baseConservada + extraConservada;
  const indiceSim = indiceInfo.baseAConservar > 0 ? conservadaSim / indiceInfo.baseAConservar : 1;

  const meses = mesesDesde(agente.fecha_inicio_calculos);
  const esNuevo = meses !== null && meses < 15;
  /* Índice operativo para bandas: el preliminar del trimestre considera lo
     pendiente de pago (así lo maneja el Business Review) + lo simulado */
  const indiceOperativo = indiceInfo.baseAConservar > 0
    ? (indiceInfo.baseConservada + indiceInfo.basePendiente + extraConservada) / indiceInfo.baseAConservar
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
  const seisMesesAtras = new Date(hoy); seisMesesAtras.setMonth(hoy.getMonth() - 6);
  const impacto = (monto) => indiceInfo.baseAConservar > 0 ? monto / indiceInfo.baseAConservar : 0;

  /* Accionables sobre el estatus derivado a hoy, no el del corte: una póliza
     cuyo pago venció después del corte también aparece por cobrar */
  const pendientesPago = polizasHoy
    .filter(p => p.estatus_conservacion === 'PENDIENTE DE PAGO')
    .map(p => ({ id: p.id, poliza: p.poliza, plan_id: p.plan_id, forma_pago: p.forma_pago, frecuencia_pago: p.frecuencia_pago, pagado_hasta: p.pagado_hasta, monto: round2(p.base_a_conservar_mxn), impacto_indice: impacto(Number(p.base_a_conservar_mxn) || 0) }))
    .sort((a, b) => b.monto - a.monto);

  const rehabilitables = polizasHoy
    .filter(p => p.estatus_conservacion === 'NO CONSERVADA' && p.fecha_ultima_cancelacion && new Date(p.fecha_ultima_cancelacion) >= seisMesesAtras)
    .map(p => ({ id: p.id, poliza: p.poliza, plan_id: p.plan_id, forma_pago: p.forma_pago, frecuencia_pago: p.frecuencia_pago, fecha_ultima_cancelacion: p.fecha_ultima_cancelacion, monto: round2(p.base_a_conservar_mxn), impacto_indice: impacto(Number(p.base_a_conservar_mxn) || 0) }))
    .sort((a, b) => b.monto - a.monto);

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
        fecha: new Date(hoyRef.getTime() - hoyRef.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
        actual: round2(indiceHoyInfo.actual * 10000) / 10000,
        conPendiente: round2(indiceHoyInfo.conPendiente * 10000) / 10000,
        baseConservada: indiceHoyInfo.baseConservada,
        basePendiente: indiceHoyInfo.basePendiente,
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
    accionables: { pendientesPago, rehabilitables },
  };
}

module.exports = { computeIngresos, computeIndice, derivarEstatus, umbralDe, cuadernoKey, MESES_FRECUENCIA, PIR_DEFAULT };
