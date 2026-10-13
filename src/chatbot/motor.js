// Motor del chatbot: compara la pregunta del alumno con las preguntas que
// enseñó a su robot y elige la más parecida. Es deliberadamente simple para
// que los alumnos puedan entender (y ver) cómo "piensa" el robot.

const PALABRAS_VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del',
  'de', 'a', 'en', 'y', 'o', 'u', 'e', 'que', 'es', 'son', 'se', 'por', 'para',
  'con', 'sin', 'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'me', 'te', 'le', 'les',
  'nos', 'muy', 'mas', 'pero', 'como', 'esta', 'este', 'esto', 'estos', 'estas',
  'eso', 'esa', 'ese', 'hay', 'ser', 'fue', 'era', 'ya', 'si', 'no', 'yo', 'tambien',
  'puedes', 'puede', 'decir', 'dime', 'sabes', 'saber', 'quiero', 'oye', 'porfa',
  'favor', 'por favor'
]);

const SALUDOS = ['hola', 'buenas', 'buenos', 'hey', 'saludos', 'holi'];
const DESPEDIDAS = ['adios', 'chao', 'chau', 'bye', 'hasta'];
const AGRADECIMIENTOS = ['gracias', 'grax', 'genial'];
const AYUDA = ['ayuda', 'ayudame', 'sabes', 'temas', 'preguntar'];

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Raíz muy sencilla: quita plurales para que "planetas" y "planeta" coincidan.
function raiz(palabra) {
  if (palabra.length > 4 && palabra.endsWith('es')) return palabra.slice(0, -2);
  if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1);
  return palabra;
}

function palabrasClave(texto) {
  return [...new Set(
    normalizar(texto)
      .split(' ')
      .filter((p) => p.length > 1 && !PALABRAS_VACIAS.has(p))
      .map(raiz)
  )];
}

function seParecen(a, b) {
  if (a === b) return true;
  // "dinosaurio" y "dinosaurios", "volcan" y "volcanes"…
  const n = Math.min(a.length, b.length);
  return n >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

// Devuelve un número entre 0 (nada parecido) y 1 (idéntico).
function similitud(textoA, textoB) {
  if (normalizar(textoA) === normalizar(textoB)) return 1;
  const a = palabrasClave(textoA);
  const b = palabrasClave(textoB);
  if (!a.length || !b.length) return 0;
  const comunes = a.filter((p) => b.some((q) => seParecen(p, q)));
  return comunes.length / Math.sqrt(a.length * b.length);
}

function contieneAlguna(palabras, lista) {
  return palabras.some((p) => lista.includes(p));
}

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

/**
 * Busca la mejor respuesta del robot para un mensaje.
 * @returns {{ respuesta: string, tipo: string, encontrada: boolean,
 *             preguntaParecida?: string, puntaje: number, palabrasClave: string[] }}
 */
function responder(robot, mensaje, umbral = 0.4) {
  const preguntas = robot.preguntas || [];
  const claves = palabrasClave(mensaje);
  const palabras = normalizar(mensaje).split(' ');

  let mejor = null;
  let mejorPuntaje = 0;
  for (const qa of preguntas) {
    const puntaje = similitud(mensaje, qa.pregunta);
    if (puntaje > mejorPuntaje) {
      mejor = qa;
      mejorPuntaje = puntaje;
    }
  }

  const base = { palabrasClave: claves, puntaje: Number(mejorPuntaje.toFixed(2)) };

  if (mejor && mejorPuntaje >= umbral) {
    return {
      ...base,
      tipo: 'aprendida',
      encontrada: true,
      respuesta: mejor.respuesta,
      preguntaParecida: mejor.pregunta
    };
  }

  // Respuestas de cortesía que todos los robots saben.
  if (contieneAlguna(palabras, SALUDOS)) {
    return {
      ...base,
      tipo: 'saludo',
      encontrada: true,
      respuesta: `¡Hola! Soy ${robot.nombre} 🤖 y sé muchas cosas sobre ${robot.tema}. ¡Pregúntame algo!`
    };
  }
  if (contieneAlguna(palabras, DESPEDIDAS)) {
    return { ...base, tipo: 'despedida', encontrada: true, respuesta: '¡Adiós! Vuelve pronto a preguntarme más cosas. 👋' };
  }
  if (contieneAlguna(palabras, AGRADECIMIENTOS)) {
    return { ...base, tipo: 'agradecimiento', encontrada: true, respuesta: '¡De nada! Me encanta ayudar. 😊' };
  }
  if (contieneAlguna(palabras, AYUDA) && preguntas.length) {
    const ejemplos = [...preguntas].sort(() => Math.random() - 0.5).slice(0, 3);
    return {
      ...base,
      tipo: 'ayuda',
      encontrada: true,
      respuesta: `Sé sobre ${robot.tema}. Puedes preguntarme, por ejemplo:\n• ${ejemplos.map((q) => q.pregunta).join('\n• ')}`
    };
  }

  return {
    ...base,
    tipo: 'desconocida',
    encontrada: false,
    preguntaParecida: mejor ? mejor.pregunta : undefined,
    respuesta: elegirAlAzar([
      '¡Uy! Todavía no sé responder eso. 🤔 ¿Me lo enseñas?',
      'Mmm… esa pregunta no la conozco. ¡Mi creador puede enseñármela!',
      'No tengo esa respuesta en mi memoria. Prueba con otra pregunta sobre ' + robot.tema + '.'
    ])
  };
}

module.exports = { normalizar, palabrasClave, similitud, responder };
