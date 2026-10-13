# 🤖 Chatbot del Taller de IA (primaria)

Aplicación web en **JavaScript** para que los alumnos creen su propio robot conversacional:
eligen un **tema**, le dan nombre y apariencia (emoji, color o un dibujo propio), le
**enseñan preguntas y respuestas** y luego conversan con él y con los robots de sus compañeros.

## ¿Qué pueden hacer los alumnos?

| Paso | Qué hacen | Qué aprenden |
|------|-----------|--------------|
| 1. Crear | Nombre, tema, autor, cara/color o subir un dibujo de su robot | Un chatbot tiene un propósito y un tema |
| 2. Enseñar | Escriben preguntas y respuestas, o suben un archivo CSV | Los datos de entrenamiento |
| 3. Probar | Conversan con su robot y con los de la clase | Probar y evaluar un sistema |
| 4. ¿Cómo pienso? | Activan el interruptor y ven las palabras clave y el % de parecido | El robot *compara*, no "entiende" |
| 5. Mejorar | Revisan "Preguntas que tu robot no supo" y le enseñan la respuesta | Mejorar un modelo con nuevos datos |

El docente tiene una clave (`DOCENTE_PIN`) para borrar robots.

## Puesta en marcha

Requiere [Node.js](https://nodejs.org) 22.13 o superior.

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm start
```

Abrir <http://localhost:3000>. Si los alumnos están en la misma red, pueden entrar con la IP
del computador del docente, por ejemplo `http://192.168.1.20:3000`.

## Conectar una base de datos

Se elige en el archivo `.env` con `DB_TYPE`:

| `DB_TYPE` | Cuándo usarla | Configuración |
|-----------|---------------|---------------|
| `json` (por defecto) | Para empezar; no requiere instalar nada | `DB_FILE=./data/robots.json` |
| `sqlite` | Base de datos real en un archivo, incluida en Node.js | `DB_FILE=./data/robots.sqlite` |
| `mongodb` | Servidor local o en la nube (MongoDB Atlas, gratis) | `MONGODB_URI=...` y `MONGODB_DB=taller_ia` |

Ejemplo con MongoDB Atlas:

```env
DB_TYPE=mongodb
MONGODB_URI=mongodb+srv://usuario:clave@cluster0.xxxxx.mongodb.net
MONGODB_DB=taller_ia
```

> Con SQLite, Node.js muestra un aviso `ExperimentalWarning` al iniciar: es normal.

### Agregar otra base de datos (MySQL, PostgreSQL, Firebase…)

Todas las bases de datos están en `src/db/` y comparten las mismas funciones
(`listarRobots`, `crearRobot`, `agregarPregunta`, …). Para sumar otra, copia
`src/db/sqliteStore.js` como modelo, implementa esas funciones y regístrala en `src/db/index.js`.

## Subir preguntas desde un archivo

En la pantalla **Enseñar** se puede subir un CSV (hecho en Excel o Google Sheets) con dos
columnas, `pregunta` y `respuesta`. Hay un ejemplo en [`ejemplos/dinosaurios.csv`](ejemplos/dinosaurios.csv).
También se pueden descargar las preguntas de un robot en el mismo formato.

## ¿Cómo funciona el robot?

`src/chatbot/motor.js` hace lo siguiente con cada mensaje:

1. Lo pasa a minúsculas, quita tildes y signos.
2. Elimina palabras vacías ("el", "de", "que"…) y plurales → **palabras clave**.
3. Compara esas palabras con las de cada pregunta enseñada y calcula un **% de parecido**.
4. Si el parecido supera `UMBRAL_COINCIDENCIA` (0.4 por defecto), responde; si no, dice que no
   sabe y guarda la pregunta para que el alumno se la enseñe.

Todos los robots saben además saludar, despedirse, agradecer y decir qué temas conocen ("ayuda").

## Estructura

```
public/            Interfaz (HTML, CSS y JavaScript del navegador)
src/server.js      Servidor Express y API REST
src/chatbot/       Motor de coincidencia de preguntas
src/db/            Adaptadores de base de datos (json, sqlite, mongodb)
test/              Pruebas automáticas (npm test)
ejemplos/          CSV de ejemplo
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/robots` | Lista de robots |
| POST | `/api/robots` | Crear robot `{nombre, tema, autor, emoji, color, imagen}` |
| GET / PUT | `/api/robots/:id` | Ver / editar robot |
| DELETE | `/api/robots/:id` | Borrar (cabecera `x-docente-pin`) |
| POST | `/api/robots/:id/preguntas` | Enseñar `{pregunta, respuesta}` |
| POST | `/api/robots/:id/preguntas/importar` | Enseñar varias `{preguntas: [...]}` |
| PUT / DELETE | `/api/robots/:id/preguntas/:qaId` | Editar / borrar pregunta |
| POST | `/api/robots/:id/chat` | Conversar `{mensaje}` |
