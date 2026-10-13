// Interfaz del chatbot del Taller de IA (JavaScript sin frameworks).

const EMOJIS = ['🤖', '👾', '🦾', '🐱', '🐶', '🦖', '🦄', '🐙', '🚀', '🌍', '🌋', '🧪', '📚', '⚽', '🎨', '🎵'];
const COLORES = ['#4f9dde', '#e5534b', '#f2a33a', '#3fb27f', '#9b6ade', '#e86fb0', '#2bb3c0', '#8a9199'];
const vista = document.getElementById('vista');

// ---------- utilidades ----------

function el(etiqueta, attrs = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(attrs)) {
    if (valor == null || valor === false) continue;
    if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else if (clave === 'class') nodo.className = valor;
    else if (clave === 'style') nodo.style.cssText = valor;
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

async function api(ruta, opciones = {}) {
  const resp = await fetch('/api' + ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined
  });
  if (resp.status === 204) return null;
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(datos.error || 'Algo salió mal.');
  return datos;
}

let temporizadorAviso;
function avisar(mensaje) {
  const aviso = document.getElementById('aviso');
  aviso.textContent = mensaje;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (aviso.hidden = true), 3000);
}

function avatar(robot, chico = false) {
  return el('div', { class: 'avatar' + (chico ? ' avatar-chico' : ''), style: `--color-robot:${robot.color || '#4f9dde'}` },
    robot.imagen ? el('img', { src: robot.imagen, alt: 'Dibujo de ' + robot.nombre }) : (robot.emoji || '🤖'));
}

function mostrar(...nodos) {
  vista.replaceChildren(...nodos);
  window.scrollTo(0, 0);
}

// Reduce la foto o dibujo del robot a 256 px para que pese poco.
function reducirImagen(archivo, tamano = 256) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = reject;
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No pude leer esa imagen.'));
      img.onload = () => {
        const escala = Math.min(1, tamano / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolve(lienzo.toDataURL('image/jpeg', 0.85));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// Lee un CSV con columnas "pregunta" y "respuesta" (separadas por ; o ,).
function leerCsv(texto) {
  texto = texto.replace(/^﻿/, '');
  const primeraLinea = texto.split(/\r?\n/)[0] || '';
  const sep = primeraLinea.includes(';') ? ';' : primeraLinea.includes('\t') ? '\t' : ',';
  const filas = [];
  let fila = [], celda = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }

  const resultado = filas
    .filter((f) => f.length >= 2 && f[0].trim() && f[1].trim())
    .map((f) => ({ pregunta: f[0].trim(), respuesta: f[1].trim() }));
  if (resultado[0] && /^pregunta/i.test(resultado[0].pregunta)) resultado.shift();
  return resultado;
}

function descargarCsv(robot) {
  const celda = (t) => `"${String(t).replace(/"/g, '""')}"`;
  const lineas = ['pregunta;respuesta', ...robot.preguntas.map((q) => `${celda(q.pregunta)};${celda(q.respuesta)}`)];
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const enlace = el('a', { href: URL.createObjectURL(blob), download: `${robot.nombre}.csv` });
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// ---------- vistas ----------

async function vistaInicio() {
  const robots = await api('/robots');
  const titulo = el('h1', {}, 'Los robots de la clase');
  if (!robots.length) {
    return mostrar(titulo, el('div', { class: 'tarjeta vacio' },
      el('div', { class: 'grande' }, '🤖'),
      el('p', {}, 'Todavía no hay robots. ¡Crea el primero y enséñale todo lo que sabes!'),
      el('a', { href: '#/nuevo', class: 'boton' }, '+ Crear mi robot')));
  }
  mostrar(titulo, el('div', { class: 'galeria' }, robots.map((robot) =>
    el('article', { class: 'tarjeta robot-tarjeta', style: `--color-robot:${robot.color}` },
      avatar(robot),
      el('h3', {}, robot.nombre),
      el('p', {}, `Sabe de: ${robot.tema}`),
      robot.autor && el('p', {}, `Creado por ${robot.autor}`),
      el('p', {}, `${robot.totalPreguntas} pregunta${robot.totalPreguntas === 1 ? '' : 's'}`),
      el('div', { class: 'acciones' },
        el('a', { href: `#/robot/${robot.id}/chat`, class: 'boton boton-mini' }, '💬 Conversar'),
        el('a', { href: `#/robot/${robot.id}/editar`, class: 'boton boton-claro boton-mini' }, '✏️ Enseñar'))))));
}

function formularioRobot(robot, alGuardar) {
  const datos = { nombre: '', tema: '', autor: '', emoji: '🤖', color: COLORES[0], imagen: null, ...robot };
  const previa = el('div', { class: 'vista-previa' });
  const pintarPrevia = () => previa.replaceChildren(avatar(datos), el('strong', {}, datos.nombre || 'Mi robot'));

  const campoTexto = (nombre, etiqueta, ayuda, max) => el('div', { class: 'campo' },
    el('label', { for: 'c-' + nombre }, etiqueta),
    el('input', {
      id: 'c-' + nombre, type: 'text', maxlength: max, value: datos[nombre] || '',
      oninput: (e) => { datos[nombre] = e.target.value; pintarPrevia(); }
    }),
    ayuda && el('p', { class: 'ayuda' }, ayuda));

  const botonesEmoji = EMOJIS.map((emoji) => el('button', {
    type: 'button', 'aria-pressed': String(emoji === datos.emoji), 'aria-label': emoji,
    onclick: () => {
      datos.emoji = emoji;
      datos.imagen = null;
      botonesEmoji.forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === emoji)));
      pintarPrevia();
    }
  }, emoji));

  const botonesColor = COLORES.map((color) => el('button', {
    type: 'button', style: `background:${color}`, 'aria-label': 'Color ' + color, 'aria-pressed': String(color === datos.color),
    onclick: () => {
      datos.color = color;
      botonesColor.forEach((b, i) => b.setAttribute('aria-pressed', String(COLORES[i] === color)));
      pintarPrevia();
    }
  }));

  const quitarFoto = el('button', {
    type: 'button', class: 'boton boton-claro boton-mini',
    onclick: () => { datos.imagen = null; pintarPrevia(); }
  }, 'Quitar dibujo');

  pintarPrevia();
  return el('form', {
    class: 'tarjeta',
    onsubmit: async (e) => {
      e.preventDefault();
      const boton = e.submitter;
      boton.disabled = true;
      try {
        const { nombre, tema, autor, emoji, color, imagen } = datos;
        await alGuardar({ nombre, tema, autor, emoji, color, imagen });
      } catch (err) {
        avisar(err.message);
      } finally {
        boton.disabled = false;
      }
    }
  },
  previa,
  el('div', { class: 'fila' },
    campoTexto('nombre', 'Nombre del robot', 'Ej.: Robotina, Dino-Bot', 40),
    campoTexto('tema', '¿De qué tema sabe?', 'Ej.: los dinosaurios, el sistema solar', 60)),
  campoTexto('autor', 'Creado por', 'Tu nombre o el de tu equipo', 60),
  el('div', { class: 'campo' }, el('label', {}, 'Elige su cara'), el('div', { class: 'emojis' }, botonesEmoji)),
  el('div', { class: 'campo' }, el('label', {}, 'Elige su color'), el('div', { class: 'colores' }, botonesColor)),
  el('div', { class: 'campo' },
    el('label', { for: 'c-imagen' }, 'O sube un dibujo o foto de tu robot'),
    el('input', {
      id: 'c-imagen', type: 'file', accept: 'image/*',
      onchange: async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        try {
          datos.imagen = await reducirImagen(archivo);
          pintarPrevia();
        } catch (err) {
          avisar(err.message);
        }
      }
    }),
    ' ', quitarFoto),
  el('button', { type: 'submit', class: 'boton boton-exito' }, robot ? '💾 Guardar cambios' : '✨ Crear mi robot'));
}

function vistaNuevo() {
  mostrar(el('h1', {}, 'Crea tu robot'), formularioRobot(null, async (datos) => {
    const robot = await api('/robots', { method: 'POST', body: datos });
    avisar(`¡${robot.nombre} ha nacido! Ahora enséñale preguntas.`);
    location.hash = `#/robot/${robot.id}/editar`;
  }));
}

async function vistaEditar(id) {
  const robot = await api('/robots/' + id);

  const inputPregunta = el('input', { id: 'nueva-p', type: 'text', maxlength: 200, required: true, placeholder: '¿Qué comían los dinosaurios?' });
  const inputRespuesta = el('textarea', { id: 'nueva-r', maxlength: 600, required: true, placeholder: 'Algunos comían plantas y otros comían carne.' });

  const formQA = el('form', {
    class: 'tarjeta',
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        await api(`/robots/${id}/preguntas`, { method: 'POST', body: { pregunta: inputPregunta.value, respuesta: inputRespuesta.value } });
        avisar('¡Pregunta aprendida! 🧠');
        await vistaEditar(id);
        document.getElementById('nueva-p').focus();
      } catch (err) {
        avisar(err.message);
      }
    }
  },
  el('div', { class: 'campo' }, el('label', { for: 'nueva-p' }, 'Pregunta'), inputPregunta,
    el('p', { class: 'ayuda' }, 'Consejo: escribe la misma pregunta de varias formas para que tu robot la entienda mejor.')),
  el('div', { class: 'campo' }, el('label', { for: 'nueva-r' }, 'Respuesta'), inputRespuesta),
  el('button', { type: 'submit', class: 'boton boton-exito' }, '+ Enseñar esta pregunta'));

  const editarQA = (qa, li) => {
    const p = el('input', { type: 'text', value: qa.pregunta, maxlength: 200, 'aria-label': 'Pregunta' });
    const r = el('textarea', { maxlength: 600, 'aria-label': 'Respuesta' }, qa.respuesta);
    li.replaceChildren(el('div', {}, p, r), el('div', { class: 'acciones' },
      el('button', {
        class: 'boton boton-mini boton-exito',
        onclick: async () => {
          try {
            await api(`/robots/${id}/preguntas/${qa.id}`, { method: 'PUT', body: { pregunta: p.value, respuesta: r.value } });
            await vistaEditar(id);
          } catch (err) { avisar(err.message); }
        }
      }, 'Guardar'),
      el('button', { class: 'boton boton-mini boton-claro', onclick: () => vistaEditar(id) }, 'Cancelar')));
  };

  const listaQA = robot.preguntas.length
    ? el('ul', { class: 'lista-qa' }, robot.preguntas.map((qa) => {
      const li = el('li', { class: 'qa' });
      li.append(
        el('div', {}, el('div', { class: 'p' }, '❓ ' + qa.pregunta), el('div', { class: 'r' }, '💬 ' + qa.respuesta)),
        el('div', { class: 'acciones' },
          el('button', { class: 'boton boton-mini boton-claro', 'aria-label': 'Editar', onclick: () => editarQA(qa, li) }, '✏️'),
          el('button', {
            class: 'boton boton-mini boton-peligro', 'aria-label': 'Borrar',
            onclick: async () => {
              if (!confirm('¿Borrar esta pregunta?')) return;
              await api(`/robots/${id}/preguntas/${qa.id}`, { method: 'DELETE' });
              await vistaEditar(id);
            }
          }, '🗑️')));
      return li;
    }))
    : el('p', { class: 'ayuda' }, 'Tu robot todavía no sabe nada. ¡Enséñale su primera pregunta!');

  const sinRespuesta = robot.sinRespuesta || [];
  const seccionSinRespuesta = sinRespuesta.length > 0 && el('section', {},
    el('h2', {}, '🤔 Preguntas que tu robot no supo responder'),
    el('p', { class: 'ayuda' }, 'Otros compañeros le preguntaron esto. ¡Enséñale la respuesta!'),
    el('ul', { class: 'lista-qa sin-respuesta' }, sinRespuesta.map((s) => el('li', { class: 'qa' },
      el('span', { class: 'p' }, s.texto),
      el('div', { class: 'acciones' },
        el('button', {
          class: 'boton boton-mini',
          onclick: async () => {
            await api(`/robots/${id}/sin-respuesta/${s.id}`, { method: 'DELETE' });
            await vistaEditar(id);
            document.getElementById('nueva-p').value = s.texto;
            document.getElementById('nueva-r').focus();
          }
        }, 'Enseñar'),
        el('button', {
          class: 'boton boton-mini boton-claro', 'aria-label': 'Descartar',
          onclick: async () => {
            await api(`/robots/${id}/sin-respuesta/${s.id}`, { method: 'DELETE' });
            await vistaEditar(id);
          }
        }, '✖'))))));

  const inputCsv = el('input', {
    type: 'file', accept: '.csv,.txt,text/csv', hidden: true,
    onchange: async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      const preguntas = leerCsv(await archivo.text());
      if (!preguntas.length) return avisar('No encontré preguntas en ese archivo.');
      try {
        const { agregadas } = await api(`/robots/${id}/preguntas/importar`, { method: 'POST', body: { preguntas } });
        avisar(`¡Tu robot aprendió ${agregadas} preguntas nuevas!`);
        await vistaEditar(id);
      } catch (err) { avisar(err.message); }
    }
  });

  const formRobot = formularioRobot(robot, async (datos) => {
    await api('/robots/' + id, { method: 'PUT', body: datos });
    avisar('¡Cambios guardados!');
    await vistaEditar(id);
  });
  const detallesRobot = el('details', {}, el('summary', {}, el('strong', {}, 'Cambiar nombre, tema o apariencia')), formRobot);

  mostrar(
    el('div', { class: 'chat-cabecera tarjeta', style: 'margin-bottom:16px' },
      avatar(robot, true),
      el('div', { style: 'flex:1' }, el('h1', {}, `Enseña a ${robot.nombre}`), el('p', {}, `Tema: ${robot.tema}`)),
      el('a', { href: `#/robot/${id}/chat`, class: 'boton' }, '💬 Probar')),
    detallesRobot,
    el('h2', {}, 'Nueva pregunta'),
    formQA,
    seccionSinRespuesta,
    el('h2', {}, `📚 Lo que sabe ${robot.nombre} (${robot.preguntas.length})`),
    el('p', { class: 'fila', style: 'gap:8px' },
      el('button', { class: 'boton boton-claro boton-mini', style: 'flex:0 0 auto', onclick: () => inputCsv.click() }, '📤 Subir archivo CSV'),
      el('button', { class: 'boton boton-claro boton-mini', style: 'flex:0 0 auto', onclick: () => descargarCsv(robot), disabled: !robot.preguntas.length }, '📥 Descargar CSV'),
      inputCsv),
    el('p', { class: 'ayuda' }, 'El archivo CSV debe tener dos columnas: pregunta y respuesta (puedes hacerlo en Excel o Google Sheets).'),
    listaQA,
    el('h2', {}, 'Zona del docente'),
    el('button', {
      class: 'boton boton-peligro',
      onclick: async () => {
        const pin = prompt('Clave del docente para borrar este robot:');
        if (!pin) return;
        try {
          await api('/robots/' + id, { method: 'DELETE', headers: { 'x-docente-pin': pin } });
          avisar('Robot borrado.');
          location.hash = '#/';
        } catch (err) { avisar(err.message); }
      }
    }, '🗑️ Borrar robot'));
}

async function vistaChat(id) {
  const robot = await api('/robots/' + id);
  const mensajes = el('div', { class: 'mensajes', role: 'log' });
  const entrada = el('input', { type: 'text', maxlength: 300, placeholder: 'Escribe tu pregunta…', 'aria-label': 'Tu pregunta', autocomplete: 'off' });
  const verExplicacion = el('input', { type: 'checkbox' });

  const agregar = (quien, texto) => {
    mensajes.append(el('div', { class: 'mensaje ' + quien }, texto));
    mensajes.scrollTop = mensajes.scrollHeight;
  };

  const explicar = (r) => {
    if (!verExplicacion.checked) return;
    let texto = `🔍 Palabras clave que encontré: ${r.palabrasClave.join(', ') || '(ninguna)'}\n`;
    if (r.tipo === 'aprendida') texto += `Se parece en un ${Math.round(r.puntaje * 100)}% a: "${r.preguntaParecida}"`;
    else if (r.tipo === 'desconocida') texto += r.preguntaParecida
      ? `La pregunta más parecida fue "${r.preguntaParecida}" (${Math.round(r.puntaje * 100)}%), pero no es suficiente.`
      : 'No se parece a ninguna pregunta que me hayan enseñado.';
    else texto += 'Esta es una respuesta que todos los robots saben.';
    mensajes.append(el('div', { class: 'explicacion' }, texto));
    mensajes.scrollTop = mensajes.scrollHeight;
  };

  const form = el('form', {
    class: 'chat-entrada',
    onsubmit: async (e) => {
      e.preventDefault();
      const mensaje = entrada.value.trim();
      if (!mensaje) return;
      entrada.value = '';
      agregar('alumno', mensaje);
      try {
        const r = await api(`/robots/${id}/chat`, { method: 'POST', body: { mensaje } });
        setTimeout(() => { agregar('robot', r.respuesta); explicar(r); }, 350);
      } catch (err) {
        agregar('robot', '⚠️ ' + err.message);
      }
    }
  }, entrada, el('button', { type: 'submit', class: 'boton' }, 'Enviar'));

  mostrar(
    el('section', { class: 'tarjeta chat' },
      el('div', { class: 'chat-cabecera' },
        avatar(robot, true),
        el('div', { style: 'flex:1' },
          el('h1', {}, robot.nombre),
          el('p', {}, `Sabe de ${robot.tema}${robot.autor ? ' · creado por ' + robot.autor : ''}`)),
        el('label', { class: 'interruptor' }, verExplicacion, '¿Cómo pienso?')),
      mensajes,
      form),
    el('p', { style: 'text-align:center' }, el('a', { href: `#/robot/${id}/editar` }, '✏️ Enseñarle más preguntas')));

  agregar('robot', `¡Hola! Soy ${robot.nombre} ${robot.emoji || '🤖'}. Pregúntame sobre ${robot.tema}.` +
    (robot.preguntas.length ? '' : '\n(Todavía no me han enseñado nada… ¡ayúdame!)'));
  entrada.focus();
}

// ---------- rutas ----------

async function enrutar() {
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  try {
    if (partes[0] === 'nuevo') return vistaNuevo();
    if (partes[0] === 'robot' && partes[2] === 'editar') return await vistaEditar(partes[1]);
    if (partes[0] === 'robot' && partes[2] === 'chat') return await vistaChat(partes[1]);
    return await vistaInicio();
  } catch (err) {
    mostrar(el('div', { class: 'tarjeta vacio' },
      el('div', { class: 'grande' }, '😵'),
      el('p', {}, err.message),
      el('a', { href: '#/', class: 'boton' }, 'Volver al inicio')));
  }
}

window.addEventListener('hashchange', enrutar);
enrutar();
api('/estado').then((e) => {
  document.getElementById('estado-db').textContent = `Base de datos: ${e.baseDeDatos}`;
}).catch(() => {});
