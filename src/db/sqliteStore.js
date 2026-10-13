// Base de datos SQLite usando el módulo incluido en Node.js 22.13 o superior.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function crearAlmacenSqlite(archivo) {
  const { DatabaseSync } = require('node:sqlite');
  const ruta = path.resolve(archivo);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);

  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS robots (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      tema TEXT NOT NULL,
      autor TEXT,
      color TEXT,
      emoji TEXT,
      imagen TEXT,
      creado TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preguntas (
      id TEXT PRIMARY KEY,
      robot_id TEXT NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
      pregunta TEXT NOT NULL,
      respuesta TEXT NOT NULL,
      orden INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sin_respuesta (
      id TEXT PRIMARY KEY,
      robot_id TEXT NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      fecha TEXT NOT NULL
    );
  `);

  const CAMPOS = ['nombre', 'tema', 'autor', 'color', 'emoji', 'imagen'];

  function armarRobot(fila) {
    if (!fila) return null;
    const preguntas = db
      .prepare('SELECT id, pregunta, respuesta FROM preguntas WHERE robot_id = ? ORDER BY orden')
      .all(fila.id)
      .map((f) => ({ ...f }));
    const sinRespuesta = db
      .prepare('SELECT id, texto, fecha FROM sin_respuesta WHERE robot_id = ? ORDER BY fecha')
      .all(fila.id)
      .map((f) => ({ ...f }));
    return { ...fila, preguntas, sinRespuesta };
  }

  return {
    tipo: 'sqlite',
    async listarRobots() {
      return db.prepare('SELECT * FROM robots ORDER BY creado').all().map(armarRobot);
    },
    async obtenerRobot(id) {
      return armarRobot(db.prepare('SELECT * FROM robots WHERE id = ?').get(id));
    },
    async crearRobot(info) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO robots (id, nombre, tema, autor, color, emoji, imagen, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, ...CAMPOS.map((c) => info[c] ?? null), new Date().toISOString());
      return this.obtenerRobot(id);
    },
    async actualizarRobot(id, cambios) {
      const campos = CAMPOS.filter((c) => c in cambios);
      if (campos.length) {
        db.prepare(`UPDATE robots SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
          .run(...campos.map((c) => cambios[c] ?? null), id);
      }
      return this.obtenerRobot(id);
    },
    async borrarRobot(id) {
      return db.prepare('DELETE FROM robots WHERE id = ?').run(id).changes > 0;
    },
    async agregarPregunta(robotId, { pregunta, respuesta }) {
      if (!db.prepare('SELECT 1 FROM robots WHERE id = ?').get(robotId)) return null;
      const id = randomUUID();
      const { siguiente } = db
        .prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM preguntas WHERE robot_id = ?')
        .get(robotId);
      db.prepare('INSERT INTO preguntas (id, robot_id, pregunta, respuesta, orden) VALUES (?, ?, ?, ?, ?)')
        .run(id, robotId, pregunta, respuesta, siguiente);
      return { id, pregunta, respuesta };
    },
    async actualizarPregunta(robotId, qaId, { pregunta, respuesta }) {
      const r = db.prepare('UPDATE preguntas SET pregunta = ?, respuesta = ? WHERE id = ? AND robot_id = ?')
        .run(pregunta, respuesta, qaId, robotId);
      return r.changes > 0 ? { id: qaId, pregunta, respuesta } : null;
    },
    async borrarPregunta(robotId, qaId) {
      return db.prepare('DELETE FROM preguntas WHERE id = ? AND robot_id = ?').run(qaId, robotId).changes > 0;
    },
    async registrarSinRespuesta(robotId, texto) {
      if (!db.prepare('SELECT 1 FROM robots WHERE id = ?').get(robotId)) return;
      if (db.prepare('SELECT 1 FROM sin_respuesta WHERE robot_id = ? AND texto = ?').get(robotId, texto)) return;
      db.prepare('INSERT INTO sin_respuesta (id, robot_id, texto, fecha) VALUES (?, ?, ?, ?)')
        .run(randomUUID(), robotId, texto, new Date().toISOString());
    },
    async borrarSinRespuesta(robotId, id) {
      return db.prepare('DELETE FROM sin_respuesta WHERE id = ? AND robot_id = ?').run(id, robotId).changes > 0;
    },
    async cerrar() {
      db.close();
    }
  };
}

module.exports = { crearAlmacenSqlite };
