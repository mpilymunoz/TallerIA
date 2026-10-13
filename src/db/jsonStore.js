// Base de datos en un archivo JSON. No necesita instalar nada.
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function crearAlmacenJson(archivo) {
  const ruta = path.resolve(archivo);
  await fs.mkdir(path.dirname(ruta), { recursive: true });

  let datos = { robots: [] };
  try {
    datos = JSON.parse(await fs.readFile(ruta, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Las escrituras se hacen en fila para no pisarse entre sí.
  let cola = Promise.resolve();
  function guardar() {
    cola = cola.then(async () => {
      const temporal = ruta + '.tmp';
      await fs.writeFile(temporal, JSON.stringify(datos, null, 2));
      await fs.rename(temporal, ruta);
    });
    return cola;
  }

  const buscar = (id) => datos.robots.find((r) => r.id === id) || null;
  const copia = (obj) => (obj ? structuredClone(obj) : null);

  return {
    tipo: 'json',
    async listarRobots() {
      return datos.robots.map(copia);
    },
    async obtenerRobot(id) {
      return copia(buscar(id));
    },
    async crearRobot(info) {
      const robot = { id: randomUUID(), ...info, preguntas: [], sinRespuesta: [], creado: new Date().toISOString() };
      datos.robots.push(robot);
      await guardar();
      return copia(robot);
    },
    async actualizarRobot(id, cambios) {
      const robot = buscar(id);
      if (!robot) return null;
      Object.assign(robot, cambios);
      await guardar();
      return copia(robot);
    },
    async borrarRobot(id) {
      const antes = datos.robots.length;
      datos.robots = datos.robots.filter((r) => r.id !== id);
      await guardar();
      return datos.robots.length < antes;
    },
    async agregarPregunta(robotId, { pregunta, respuesta }) {
      const robot = buscar(robotId);
      if (!robot) return null;
      const qa = { id: randomUUID(), pregunta, respuesta };
      robot.preguntas.push(qa);
      await guardar();
      return copia(qa);
    },
    async actualizarPregunta(robotId, qaId, cambios) {
      const qa = buscar(robotId)?.preguntas.find((q) => q.id === qaId);
      if (!qa) return null;
      Object.assign(qa, cambios);
      await guardar();
      return copia(qa);
    },
    async borrarPregunta(robotId, qaId) {
      const robot = buscar(robotId);
      if (!robot) return false;
      const antes = robot.preguntas.length;
      robot.preguntas = robot.preguntas.filter((q) => q.id !== qaId);
      await guardar();
      return robot.preguntas.length < antes;
    },
    async registrarSinRespuesta(robotId, texto) {
      const robot = buscar(robotId);
      if (!robot) return;
      robot.sinRespuesta = robot.sinRespuesta || [];
      if (robot.sinRespuesta.some((s) => s.texto === texto)) return;
      robot.sinRespuesta.push({ id: randomUUID(), texto, fecha: new Date().toISOString() });
      robot.sinRespuesta = robot.sinRespuesta.slice(-50);
      await guardar();
    },
    async borrarSinRespuesta(robotId, id) {
      const robot = buscar(robotId);
      if (!robot) return false;
      robot.sinRespuesta = (robot.sinRespuesta || []).filter((s) => s.id !== id);
      await guardar();
      return true;
    },
    async cerrar() {
      await cola;
    }
  };
}

module.exports = { crearAlmacenJson };
