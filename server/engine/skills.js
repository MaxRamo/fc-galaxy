'use strict';

/* Árboles de habilidades por posición. Cada jugador gana puntos de habilidad
   entrenando y jugando, y el mánager los invierte en nodos del árbol de su
   posición. Los efectos se aplican directamente a los atributos, así que el
   radar del perfil refleja el progreso sin capas intermedias. */

const { clamp, overallOf, computeValue, ATTR_KEYS, GK_KEYS } = require('./player');

/* Cada nodo: id, nombre, descripción, tier (1-3), coste en puntos,
   efectos sobre atributos y requisitos (ids de nodos previos). */
const TREES = {
  GK: [
    { id: 'reflejos', name: 'Reflejos felinos', desc: 'Reacción instantánea ante disparos cercanos', tier: 1, cost: 1, attrs: { reflexes: 3 }, requires: [] },
    { id: 'manos', name: 'Manos seguras', desc: 'Sujeta el balón con más firmeza', tier: 1, cost: 1, attrs: { handling: 3 }, requires: [] },
    { id: 'salidas', name: 'Dominio aéreo', desc: 'Mejor colocación en centros y salidas', tier: 1, cost: 1, attrs: { positioning: 3 }, requires: [] },
    { id: 'penaltis', name: 'Especialista en penaltis', desc: 'Lee la intención del lanzador', tier: 2, cost: 2, attrs: { reflexes: 3, handling: 2 }, requires: ['reflejos'] },
    { id: 'juegopie', name: 'Juego con los pies', desc: 'Inicia el ataque desde atrás con precisión', tier: 2, cost: 2, attrs: { kicking: 4 }, requires: ['salidas'] },
    { id: 'muralla', name: 'Muralla', desc: 'Presencia intimidante bajo palos', tier: 3, cost: 3, attrs: { reflexes: 3, positioning: 3, handling: 2 }, requires: ['penaltis', 'juegopie'] }
  ],
  CB: [
    { id: 'marcaje', name: 'Marcaje férreo', desc: 'Pega al delantero durante todo el partido', tier: 1, cost: 1, attrs: { defending: 3 }, requires: [] },
    { id: 'cuerpazo', name: 'Cuerpazo', desc: 'Gana los duelos físicos en el área', tier: 1, cost: 1, attrs: { physical: 3 }, requires: [] },
    { id: 'cobertura', name: 'Cobertura', desc: 'Recupera posiciones defensivas más rápido', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'entrada', name: 'Entrada limpia', desc: 'Roba el balón sin cometer falta', tier: 2, cost: 2, attrs: { defending: 4 }, requires: ['marcaje'] },
    { id: 'jerek', name: 'Jefe de la defensa', desc: 'Ordena la línea y gana todo aéreo', tier: 2, cost: 2, attrs: { physical: 3, defending: 2 }, requires: ['cuerpazo'] },
    { id: 'barrido', name: 'Barrido imposible', desc: 'Llegada salvadora al último recurso', tier: 3, cost: 3, attrs: { defending: 3, pace: 3, physical: 2 }, requires: ['entrada', 'jerek'] }
  ],
  FULLBACK: [
    { id: 'velocidad', name: 'Carriler eléctrico', desc: 'Sube y baja la banda sin parar', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'defensa', name: 'Cobertura defensiva', desc: 'Cierra la espalda del central', tier: 1, cost: 1, attrs: { defending: 3 }, requires: [] },
    { id: 'centro', name: 'Centro al área', desc: 'Pone balones peligrosos al área', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'subida', name: 'Progresión vertiginosa', desc: 'Conduce pegado a la línea de cal', tier: 2, cost: 2, attrs: { pace: 3, dribbling: 2 }, requires: ['velocidad'] },
    { id: 'anticipo', name: 'Anticipación', desc: 'Corta las jugadas antes de que nacieran', tier: 2, cost: 2, attrs: { defending: 3, physical: 2 }, requires: ['defensa'] },
    { id: 'todocampo', name: 'Lateral de élite', desc: 'Dueño absoluto de su banda', tier: 3, cost: 3, attrs: { pace: 3, defending: 3, passing: 2 }, requires: ['subida', 'anticipo'] }
  ],
  DM: [
    { id: 'posicion', name: 'Ancla posicional', desc: 'Siempre cubre la zona del mediocentro', tier: 1, cost: 1, attrs: { defending: 3 }, requires: [] },
    { id: 'pase', name: 'Primer pase', desc: 'Saca el balón limpio desde atrás', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'fisico', name: 'Pulmón', desc: 'Recorre más metros que nadie', tier: 1, cost: 1, attrs: { physical: 3 }, requires: [] },
    { id: 'robo', name: 'Pivote robón', desc: 'Lectura para cortar el contraataque', tier: 2, cost: 2, attrs: { defending: 4 }, requires: ['posicion'] },
    { id: 'distribucion', name: 'Distribución de juego', desc: 'Cambia de orientación con precisión', tier: 2, cost: 2, attrs: { passing: 4 }, requires: ['pase'] },
    { id: 'muro', name: 'Muro del mediocampo', desc: 'Nadie pasa por su zona', tier: 3, cost: 3, attrs: { defending: 3, physical: 3, passing: 2 }, requires: ['robo', 'distribucion'] }
  ],
  CM: [
    { id: 'vision', name: 'Visión de juego', desc: 'Ve el pase que nadie ve', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'conduccion', name: 'Conducción serena', desc: 'Sale de la presión sin perder el balón', tier: 1, cost: 1, attrs: { dribbling: 3 }, requires: [] },
    { id: 'ritmo', name: 'Llegada desde atrás', desc: 'Se incorpora al ataque por sorpresa', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'pasefiltrado', name: 'Pase filtrado', desc: 'Habilita a los delanteros entre líneas', tier: 2, cost: 2, attrs: { passing: 4 }, requires: ['vision'] },
    { id: 'duelo', name: 'Duelo en mediocampo', desc: 'Gana las segundas pelotas', tier: 2, cost: 2, attrs: { physical: 3, defending: 2 }, requires: ['ritmo'] },
    { id: 'motor', name: 'Motor del equipo', desc: 'Box-to-box de élite', tier: 3, cost: 3, attrs: { passing: 3, physical: 3, dribbling: 2 }, requires: ['pasefiltrado', 'duelo'] }
  ],
  AM: [
    { id: 'asistencia', name: 'Ojo de águila', desc: 'Asistencia milimétrica', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'regate', name: 'Regate en tres toques', desc: 'Se gira en espacios diminutos', tier: 1, cost: 1, attrs: { dribbling: 3 }, requires: [] },
    { id: 'media', name: 'Media distancia', desc: 'Prueba desde fuera del área', tier: 1, cost: 1, attrs: { shooting: 3 }, requires: [] },
    { id: 'paseoro', name: 'Pase de oro', desc: 'Asistencias que rompen partidos', tier: 2, cost: 2, attrs: { passing: 4, dribbling: 2 }, requires: ['asistencia'] },
    { id: 'gancho', name: 'Gancho en la frontal', desc: 'Remate colocado desde la frontal', tier: 2, cost: 2, attrs: { shooting: 4 }, requires: ['media'] },
    { id: 'magia', name: 'Diez mágico', desc: 'El equipo juega a su ritmo', tier: 3, cost: 3, attrs: { passing: 3, dribbling: 3, shooting: 2 }, requires: ['paseoro', 'gancho'] }
  ],
  WINGER: [
    { id: 'explosividad', name: 'Explosividad', desc: 'Aceleración brutal en los primeros metros', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'amagofinta', name: 'Amago y finta', desc: 'Deja al lateral sentado', tier: 1, cost: 1, attrs: { dribbling: 3 }, requires: [] },
    { id: 'centro', name: 'Centro raso', desc: 'Asistencias al segundo palo', tier: 1, cost: 1, attrs: { passing: 3 }, requires: [] },
    { id: 'banda', name: 'Dueño de la banda', desc: 'Encara y supera una y otra vez', tier: 2, cost: 2, attrs: { dribbling: 4, pace: 2 }, requires: ['amagofinta'] },
    { id: 'cortado', name: 'Disparo cortado', desc: 'Define al segundo palo tras cortarse', tier: 2, cost: 2, attrs: { shooting: 4 }, requires: ['centro'] },
    { id: 'extremo', name: 'Extremo de élite', desc: 'Desequilibrio constante', tier: 3, cost: 3, attrs: { pace: 3, dribbling: 3, shooting: 2 }, requires: ['banda', 'cortado'] }
  ],
  ST: [
    { id: 'definicion', name: 'Definición', desc: 'Friaza ante el portero', tier: 1, cost: 1, attrs: { shooting: 3 }, requires: [] },
    { id: 'desmarque', name: 'Desmarque', desc: 'Se escapa de la marca en el momento justo', tier: 1, cost: 1, attrs: { pace: 3 }, requires: [] },
    { id: 'potencia', name: 'Potencia de disparo', desc: 'Remate seco desde cualquier ángulo', tier: 1, cost: 1, attrs: { shooting: 2, physical: 2 }, requires: [] },
    { id: 'disparocertero', name: 'Disparo certero', desc: 'Ajusta el disparo al palo largo', tier: 2, cost: 2, attrs: { shooting: 4 }, requires: ['definicion'] },
    { id: 'cabezazo', name: 'Cabezazo salvador', desc: 'Gana los centros con autoridad', tier: 2, cost: 2, attrs: { shooting: 3, physical: 2 }, requires: ['potencia'] },
    { id: 'letal', name: 'Delantero letal', desc: 'Convierte media ocasión en gol', tier: 3, cost: 3, attrs: { shooting: 3, dribbling: 2, pace: 2 }, requires: ['disparocertero', 'cabezazo'] }
  ]
};

const TREE_FOR_POS = {
  GK: 'GK', CB: 'CB', LB: 'FULLBACK', RB: 'FULLBACK',
  DM: 'DM', CM: 'CM', AM: 'AM', LW: 'WINGER', RW: 'WINGER', ST: 'ST'
};

function treeFor(pos) {
  return TREES[TREE_FOR_POS[pos] || 'CM'] || [];
}

function skillById(pos, skillId) {
  return treeFor(pos).find(s => s.id === skillId) || null;
}

function attrsKeysFor(pos) {
  return pos === 'GK' ? GK_KEYS : ATTR_KEYS;
}

function skillState(player, skill) {
  if (player.skills && player.skills.includes(skill.id)) return 'unlocked';
  const missing = (skill.requires || []).filter(r => !(player.skills || []).includes(r));
  if (missing.length) return 'locked';
  if ((player.skillPoints || 0) < skill.cost) return 'no-points';
  return 'available';
}

function canUnlock(player, skillId) {
  const skill = skillById(player.pos, skillId);
  if (!skill) return { ok: false, reason: 'Habilidad no válida para la posición ' + player.pos };
  const state = skillState(player, skill);
  if (state === 'unlocked') return { ok: false, reason: player.name + ' ya tiene esa habilidad' };
  if (state === 'locked') return { ok: false, reason: 'Faltan requisitos previos para ' + skill.name };
  if (state === 'no-points') return { ok: false, reason: 'Puntos de habilidad insuficientes (coste: ' + skill.cost + ')' };
  return { ok: true, skill };
}

function unlockSkill(player, skillId) {
  const check = canUnlock(player, skillId);
  if (!check.ok) return check;
  const skill = check.skill;
  player.skillPoints = (player.skillPoints || 0) - skill.cost;
  player.skills = (player.skills || []).concat(skill.id);
  for (const [key, bonus] of Object.entries(skill.attrs)) {
    if (player.attrs[key] != null) player.attrs[key] = clamp(player.attrs[key] + bonus, 20, 99);
  }
  player.overall = overallOf(player);
  player.value = computeValue(player);
  return { ok: true, skill, player };
}

function grantPoints(player, n) {
  if (n > 0) player.skillPoints = (player.skillPoints || 0) + n;
  return player;
}

function pointsSummary(player) {
  const tree = treeFor(player.pos);
  const spent = tree.filter(s => (player.skills || []).includes(s.id)).reduce((a, s) => a + s.cost, 0);
  return { total: spent + (player.skillPoints || 0), spent, available: player.skillPoints || 0 };
}

function treesByPosition() {
  const out = {};
  for (const pos of Object.keys(TREE_FOR_POS)) out[pos] = TREES[TREE_FOR_POS[pos]];
  return out;
}

module.exports = { TREES, TREE_FOR_POS, treeFor, skillById, skillState, canUnlock, unlockSkill, grantPoints, pointsSummary, attrsKeysFor, treesByPosition };
