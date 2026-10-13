// Elige la base de datos según la variable DB_TYPE del archivo .env.
// Todas las bases de datos ofrecen las mismas funciones:
//   listarRobots, obtenerRobot, crearRobot, actualizarRobot, borrarRobot,
//   agregarPregunta, actualizarPregunta, borrarPregunta,
//   registrarSinRespuesta, borrarSinRespuesta, cerrar
// Para agregar otra base de datos (MySQL, PostgreSQL, Firebase…) basta con
// crear un archivo nuevo que implemente estas funciones.

async function conectarBaseDeDatos(config = process.env) {
  const tipo = (config.DB_TYPE || 'json').toLowerCase();
  switch (tipo) {
    case 'json': {
      const { crearAlmacenJson } = require('./jsonStore');
      return crearAlmacenJson(config.DB_FILE || './data/robots.json');
    }
    case 'sqlite': {
      const { crearAlmacenSqlite } = require('./sqliteStore');
      return crearAlmacenSqlite(config.DB_FILE || './data/robots.sqlite');
    }
    case 'mongodb':
    case 'mongo': {
      const { crearAlmacenMongo } = require('./mongoStore');
      return crearAlmacenMongo(config.MONGODB_URI || 'mongodb://localhost:27017', config.MONGODB_DB || 'taller_ia');
    }
    default:
      throw new Error(`DB_TYPE desconocido: "${tipo}". Usa json, sqlite o mongodb.`);
  }
}

module.exports = { conectarBaseDeDatos };
