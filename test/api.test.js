const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { crearApp } = require('../src/server');
const { conectarBaseDeDatos } = require('../src/db');

for (const tipo of ['json', 'sqlite']) {
  test(`flujo completo con base de datos ${tipo}`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taller-'));
    const db = await conectarBaseDeDatos({ DB_TYPE: tipo, DB_FILE: path.join(dir, 'db.' + tipo) });
    const servidor = crearApp(db, { pinDocente: '9999' }).listen(0);
    const base = `http://localhost:${servidor.address().port}/api`;
    const pedir = async (ruta, metodo = 'GET', body, headers = {}) => {
      const r = await fetch(base + ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body && JSON.stringify(body)
      });
      return { status: r.status, datos: r.status === 204 ? null : await r.json() };
    };

    try {
      assert.strictEqual((await pedir('/robots', 'POST', { tema: 'x' })).status, 400);

      const { datos: robot } = await pedir('/robots', 'POST', { nombre: 'Astro', tema: 'el espacio', autor: 'Equipo 3' });
      assert.ok(robot.id);

      await pedir(`/robots/${robot.id}/preguntas`, 'POST', { pregunta: '¿Cuántos planetas hay?', respuesta: 'Ocho.' });
      const imp = await pedir(`/robots/${robot.id}/preguntas/importar`, 'POST', {
        preguntas: [{ pregunta: '¿Qué es el Sol?', respuesta: 'Una estrella.' }, { pregunta: '', respuesta: '' }]
      });
      assert.strictEqual(imp.datos.agregadas, 1);

      const chat = await pedir(`/robots/${robot.id}/chat`, 'POST', { mensaje: 'cuantos planetas existen' });
      assert.strictEqual(chat.datos.respuesta, 'Ocho.');

      await pedir(`/robots/${robot.id}/chat`, 'POST', { mensaje: '¿Qué es un agujero negro?' });
      const { datos: completo } = await pedir(`/robots/${robot.id}`);
      assert.strictEqual(completo.preguntas.length, 2);
      assert.strictEqual(completo.sinRespuesta.length, 1);

      const { datos: lista } = await pedir('/robots');
      assert.strictEqual(lista[0].totalPreguntas, 2);

      assert.strictEqual((await pedir(`/robots/${robot.id}`, 'DELETE')).status, 403);
      assert.strictEqual((await pedir(`/robots/${robot.id}`, 'DELETE', null, { 'x-docente-pin': '9999' })).status, 204);
      assert.strictEqual((await pedir(`/robots/${robot.id}`)).status, 404);
    } finally {
      servidor.close();
      await db.cerrar();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
