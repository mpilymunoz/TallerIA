require('dotenv').config();
const path = require('node:path');
const express = require('express');
const { conectarBaseDeDatos } = require('./db');
const { responder } = require('./chatbot/motor');

const LIMITES = { nombre: 40, tema: 60, autor: 60, pregunta: 200, respuesta: 600, mensaje: 300 };
const IMAGEN_MAX = 400 * 1024; // las imágenes se reducen en el navegador antes de subir
const COLOR = /^#[0-9a-f]{6}$/i;
const IMAGEN = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i;

function texto(valor, max) {
  return String(valor ?? '').trim().slice(0, max);
}

function datosRobot(body, parcial = false) {
  const datos = {};
  for (const campo of ['nombre', 'tema', 'autor']) {
    if (!parcial || campo in body) datos[campo] = texto(body[campo], LIMITES[campo]);
  }
  if (!parcial || 'color' in body) datos.color = COLOR.test(body.color || '') ? body.color : '#4f9dde';
  if (!parcial || 'emoji' in body) datos.emoji = texto(body.emoji, 8) || '🤖';
  if (!parcial || 'imagen' in body) {
    const img = body.imagen || null;
    if (img && (!IMAGEN.test(img) || img.length > IMAGEN_MAX)) {
      throw new ErrorUsuario('La imagen no es válida o es demasiado grande.');
    }
    datos.imagen = img;
  }
  if ((!parcial || 'nombre' in body) && !datos.nombre) throw new ErrorUsuario('Tu robot necesita un nombre.');
  if ((!parcial || 'tema' in body) && !datos.tema) throw new ErrorUsuario('Elige un tema para tu robot.');
  return datos;
}

function datosPregunta(body) {
  const pregunta = texto(body.pregunta, LIMITES.pregunta);
  const respuesta = texto(body.respuesta, LIMITES.respuesta);
  if (!pregunta || !respuesta) throw new ErrorUsuario('Escribe la pregunta y la respuesta.');
  return { pregunta, respuesta };
}

class ErrorUsuario extends Error {}

function crearApp(db, opciones = {}) {
  const umbral = Number(opciones.umbral ?? process.env.UMBRAL_COINCIDENCIA ?? 0.4);
  const pinDocente = String(opciones.pinDocente ?? process.env.DOCENTE_PIN ?? '1234');

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Envuelve rutas async para enviar errores al manejador central.
  const r = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const soloDocente = (req, res, next) => {
    if (req.get('x-docente-pin') !== pinDocente) {
      return res.status(403).json({ error: 'Necesitas la clave del docente.' });
    }
    next();
  };

  app.get('/api/estado', (req, res) => res.json({ baseDeDatos: db.tipo, umbral }));

  app.get('/api/robots', r(async (req, res) => {
    const robots = await db.listarRobots();
    res.json(robots.map(({ sinRespuesta, preguntas, ...robot }) => ({
      ...robot,
      totalPreguntas: preguntas.length
    })));
  }));

  app.post('/api/robots', r(async (req, res) => {
    res.status(201).json(await db.crearRobot(datosRobot(req.body)));
  }));

  app.get('/api/robots/:id', r(async (req, res) => {
    const robot = await db.obtenerRobot(req.params.id);
    if (!robot) return res.status(404).json({ error: 'No encontré ese robot.' });
    res.json(robot);
  }));

  app.put('/api/robots/:id', r(async (req, res) => {
    const robot = await db.actualizarRobot(req.params.id, datosRobot(req.body, true));
    if (!robot) return res.status(404).json({ error: 'No encontré ese robot.' });
    res.json(robot);
  }));

  app.delete('/api/robots/:id', soloDocente, r(async (req, res) => {
    const borrado = await db.borrarRobot(req.params.id);
    res.status(borrado ? 204 : 404).end();
  }));

  app.post('/api/robots/:id/preguntas', r(async (req, res) => {
    const qa = await db.agregarPregunta(req.params.id, datosPregunta(req.body));
    if (!qa) return res.status(404).json({ error: 'No encontré ese robot.' });
    res.status(201).json(qa);
  }));

  // Subir muchas preguntas de una vez (por ejemplo, desde un archivo CSV).
  app.post('/api/robots/:id/preguntas/importar', r(async (req, res) => {
    const lista = Array.isArray(req.body.preguntas) ? req.body.preguntas.slice(0, 200) : [];
    if (!(await db.obtenerRobot(req.params.id))) return res.status(404).json({ error: 'No encontré ese robot.' });
    const agregadas = [];
    for (const item of lista) {
      try {
        agregadas.push(await db.agregarPregunta(req.params.id, datosPregunta(item)));
      } catch (err) {
        if (!(err instanceof ErrorUsuario)) throw err; // se saltan filas vacías
      }
    }
    res.status(201).json({ agregadas: agregadas.length });
  }));

  app.put('/api/robots/:id/preguntas/:qaId', r(async (req, res) => {
    const qa = await db.actualizarPregunta(req.params.id, req.params.qaId, datosPregunta(req.body));
    if (!qa) return res.status(404).json({ error: 'No encontré esa pregunta.' });
    res.json(qa);
  }));

  app.delete('/api/robots/:id/preguntas/:qaId', r(async (req, res) => {
    const borrada = await db.borrarPregunta(req.params.id, req.params.qaId);
    res.status(borrada ? 204 : 404).end();
  }));

  app.delete('/api/robots/:id/sin-respuesta/:sinId', r(async (req, res) => {
    await db.borrarSinRespuesta(req.params.id, req.params.sinId);
    res.status(204).end();
  }));

  app.post('/api/robots/:id/chat', r(async (req, res) => {
    const robot = await db.obtenerRobot(req.params.id);
    if (!robot) return res.status(404).json({ error: 'No encontré ese robot.' });
    const mensaje = texto(req.body.mensaje, LIMITES.mensaje);
    if (!mensaje) return res.status(400).json({ error: 'Escribe un mensaje.' });
    const resultado = responder(robot, mensaje, umbral);
    if (!resultado.encontrada) await db.registrarSinRespuesta(robot.id, mensaje);
    res.json(resultado);
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

  app.use((err, req, res, next) => {
    if (err instanceof ErrorUsuario) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El archivo es demasiado grande.' });
    console.error(err);
    res.status(500).json({ error: 'Algo salió mal en el servidor.' });
  });

  return app;
}

async function iniciar() {
  const db = await conectarBaseDeDatos();
  const puerto = Number(process.env.PORT || 3000);
  const servidor = crearApp(db).listen(puerto, () => {
    console.log(`🤖 Chatbot del Taller de IA listo en http://localhost:${puerto}`);
    console.log(`   Base de datos: ${db.tipo}`);
  });
  const apagar = async () => {
    servidor.close();
    await db.cerrar();
    process.exit(0);
  };
  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);
}

if (require.main === module) {
  iniciar().catch((err) => {
    console.error('No se pudo iniciar el chatbot:', err.message);
    process.exit(1);
  });
}

module.exports = { crearApp };
