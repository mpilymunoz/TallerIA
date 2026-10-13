// Base de datos MongoDB (local o en la nube con MongoDB Atlas).
// Requiere el paquete "mongodb": npm install mongodb
const { randomUUID } = require('node:crypto');

async function crearAlmacenMongo(uri, nombreDb) {
  let MongoClient;
  try {
    ({ MongoClient } = require('mongodb'));
  } catch {
    throw new Error('Para usar MongoDB instala el paquete con: npm install mongodb');
  }
  const cliente = new MongoClient(uri);
  await cliente.connect();
  const robots = cliente.db(nombreDb).collection('robots');
  await robots.createIndex({ id: 1 }, { unique: true });

  const sinId = { projection: { _id: 0 } };

  return {
    tipo: 'mongodb',
    async listarRobots() {
      return robots.find({}, sinId).sort({ creado: 1 }).toArray();
    },
    async obtenerRobot(id) {
      return robots.findOne({ id }, sinId);
    },
    async crearRobot(info) {
      const robot = { id: randomUUID(), ...info, preguntas: [], sinRespuesta: [], creado: new Date().toISOString() };
      await robots.insertOne({ ...robot });
      return robot;
    },
    async actualizarRobot(id, cambios) {
      return robots.findOneAndUpdate({ id }, { $set: cambios }, { ...sinId, returnDocument: 'after' });
    },
    async borrarRobot(id) {
      return (await robots.deleteOne({ id })).deletedCount > 0;
    },
    async agregarPregunta(robotId, { pregunta, respuesta }) {
      const qa = { id: randomUUID(), pregunta, respuesta };
      const r = await robots.updateOne({ id: robotId }, { $push: { preguntas: qa } });
      return r.matchedCount ? qa : null;
    },
    async actualizarPregunta(robotId, qaId, { pregunta, respuesta }) {
      const r = await robots.updateOne(
        { id: robotId, 'preguntas.id': qaId },
        { $set: { 'preguntas.$.pregunta': pregunta, 'preguntas.$.respuesta': respuesta } }
      );
      return r.matchedCount ? { id: qaId, pregunta, respuesta } : null;
    },
    async borrarPregunta(robotId, qaId) {
      const r = await robots.updateOne({ id: robotId }, { $pull: { preguntas: { id: qaId } } });
      return r.modifiedCount > 0;
    },
    async registrarSinRespuesta(robotId, texto) {
      await robots.updateOne(
        { id: robotId, 'sinRespuesta.texto': { $ne: texto } },
        { $push: { sinRespuesta: { $each: [{ id: randomUUID(), texto, fecha: new Date().toISOString() }], $slice: -50 } } }
      );
    },
    async borrarSinRespuesta(robotId, id) {
      const r = await robots.updateOne({ id: robotId }, { $pull: { sinRespuesta: { id } } });
      return r.modifiedCount > 0;
    },
    async cerrar() {
      await cliente.close();
    }
  };
}

module.exports = { crearAlmacenMongo };
