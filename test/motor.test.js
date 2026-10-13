const test = require('node:test');
const assert = require('node:assert');
const { responder, similitud, palabrasClave } = require('../src/chatbot/motor');

const robot = {
  nombre: 'Dino-Bot',
  tema: 'los dinosaurios',
  preguntas: [
    { id: '1', pregunta: '¿Qué comían los dinosaurios?', respuesta: 'Plantas y carne.' },
    { id: '2', pregunta: '¿Cuál era el dinosaurio más grande?', respuesta: 'El Argentinosaurus.' },
    { id: '3', pregunta: '¿Por qué se extinguieron?', respuesta: 'Por un meteorito.' }
  ]
};

test('quita tildes, signos y palabras vacías', () => {
  assert.deepStrictEqual(palabrasClave('¿Qué COMÍAN los dinosaurios?'), ['comian', 'dinosaurio']);
});

test('una pregunta idéntica tiene similitud 1', () => {
  assert.strictEqual(similitud('¿Qué comían los dinosaurios?', 'que comian los dinosaurios'), 1);
});

test('encuentra preguntas escritas de otra forma', () => {
  const r = responder(robot, 'que comia un dinosaurio');
  assert.strictEqual(r.encontrada, true);
  assert.strictEqual(r.respuesta, 'Plantas y carne.');

  assert.strictEqual(responder(robot, 'dinosaurio mas grande').respuesta, 'El Argentinosaurus.');
});

test('saluda aunque no se le haya enseñado', () => {
  const r = responder(robot, '¡Hola!');
  assert.strictEqual(r.tipo, 'saludo');
  assert.match(r.respuesta, /Dino-Bot/);
});

test('admite cuando no sabe la respuesta', () => {
  const r = responder(robot, '¿Cuántas lunas tiene Júpiter?');
  assert.strictEqual(r.encontrada, false);
  assert.strictEqual(r.tipo, 'desconocida');
});
