# DocuAI Enterprise

API Express para administrar usuarios, notas y chats con DeepSeek. La persistencia activa usa Prisma y SQLite.

## Requisitos

- Node.js 20+
- Una clave DeepSeek guardada como `DEEPSEEK_API_KEY` en `backend/.env`

## Backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:import:mysql
npm run dev
```

Configura `DATABASE_URL="file:./dev.db"` y `DEEPSEEK_API_KEY` en `backend/.env`. El importador copia registros de la base MySQL anterior sin borrarlos; requiere que conserves `DB_HOST`, `DB_USER`, `DB_PASS` y `DB_NAME` en ese archivo. Si no tienes datos en MySQL, omite `npm run db:import:mysql`. La API queda en `http://localhost:3000` y Swagger en `http://localhost:3000/api-docs`.

`npm run db:import:mysql` es idempotente por ID: no reemplaza registros existentes de SQLite. La base MySQL original permanece intacta. El endpoint de chat guarda conversaciones y mensajes, envía el historial completo al modelo, transmite la respuesta por SSE y registra el consumo en `HistorialIA`. `IA_RATE_LIMIT_MAX` limita las peticiones de IA por IP (10 cada 15 minutos por defecto).

## Pruebas

```powershell
cd backend
npm test
```

Las pruebas cubren el CRUD de usuarios y notas, la gestión de conversaciones, el historial, el streaming y el rate limit. Usan SQLite independiente (`prisma/test.db`) y un generador DeepSeek simulado; no consumen créditos.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Abre la dirección que indique Vite (por defecto `http://localhost:5173`). El chat puede crear conversaciones nuevas y reabrir el historial guardado.
# Laboratorio 5: Respuestas de Reflexión e Integración de IA

Este documento contiene las respuestas a las preguntas de reflexión correspondientes al Laboratorio 5, abordando la integración de la API de Anthropic (Claude), manejo de errores, arquitectura de seguridad, optimización de costos y resolución de conflictos en el control de versiones.

---

## 📋 Tabla de Contenidos

1. [Seguridad de API Keys en el Frontend](#1-seguridad-de-api-keys-en-el-frontend)
2. [Manejo de Errores y Semántica HTTP (Error 401 de Claude)](#2-manejo-de-errores-y-semántica-http-error-401-de-claude)
3. [Parámetro `system` vs `messages`](#3-parámetro-system-vs-messages)
4. [Métricas de Tokens y Control de Costos](#4-métricas-de-tokens-y-control-de-costos)
5. [Validación de Entrada (`req.body`) y Consecuencias](#5-validación-de-entrada-reqbody-y-consecuencias)
6. [Resolución de Conflictos de Git](#6-resolución-de-conflictos-de-git)

---

## 1. Seguridad de API Keys en el Frontend

### ¿Por qué la API key no puede estar en el frontend?
La API key **jamás debe exponerse en el frontend** porque todo código ejecutado en el navegador del cliente es público e inseguro por naturaleza.

### ¿Cómo podría obtenerla un usuario?
Cualquier usuario sin conocimientos avanzados de programación puede extraer la API key en segundos mediante los siguientes pasos:

1. **Abrir la aplicación:** Cargar la página web en un navegador (Chrome, Firefox, Edge, etc.).
2. **Inspeccionar con DevTools:** Hacer clic derecho en la página y seleccionar *Inspeccionar* o presionar `F12`.
3. **Pestaña Network (Red):** Al realizar una acción que consulte la IA, se puede inspeccionar la petición HTTP y ver la API key en los encabezados (*Headers*) o cuerpo (*Payload*) en texto plano.
4. **Pestaña Sources (Fuentes):** Inspeccionar los archivos `.js` bundleados y buscar patrones/prefijos de llaves (por ejemplo, `sk-ant-...`).

> **⚠️ Consecuencias de una filtración:** Un atacante que obtenga la API key puede realizar peticiones masivas sin restricción a su favor, agotando los saldos de la cuenta o generando cobros excesivos imprevistos en la tarjeta de crédito vinculada.

---

## 2. Manejo de Errores y Semántica HTTP (Error 401 de Claude)

### Respuesta de nuestra API ante un 401 de Claude
Cuando la API de Anthropic/Claude devuelve un error `401 Unauthorized` (debido a una API Key inválida, vencida o ausente), el middleware de errores (`errorHandler.js`) intercepta la excepción y responde al cliente con un código de estado **`502 Bad Gateway`** y un cuerpo JSON genérico:

```json
{
  "error": "IA_NO_DISPONIBLE"
}
```

### ¿Por qué no se reenvía el 401 al cliente?

1. **Confusión de responsabilidad (Semántica HTTP):** Un estado `401` devuelto por nuestra API le indicaría al cliente que sus credenciales de usuario dentro de nuestro sistema no son válidas. En este escenario, el cliente está autenticado correctamente; la falla ocurre en la comunicación backend-a-tercero.
2. **Seguridad por Abstracción:** No se debe revelar la infraestructura ni las razones internas del fallo (como claves vencidas o variables de entorno no configuradas), ya que provee información técnica útil para posibles atacantes.

---

## 3. Parámetro `system` vs `messages`

### Definición de conceptos

* **Parámetro `system`:** Define el rol global, comportamiento, tono, reglas de seguridad y formato de salida del modelo. Funciona como el marco de referencia o contexto base previo a cualquier interacción.
* **Contenido de `messages`:** Representa la conversación activa (historial o turnos del usuario/asistente). Es el contenido o petición puntual que el modelo debe procesar en esa llamada específica.

### Ejemplo de Prueba en el Laboratorio

* **Endpoint evaluado:** `POST /api/notas/:id/resumen`
* **Configuración del prompt:**

```javascript
// Configuración enviada a la API de Claude
const params = {
  system: "Eres un asistente de síntesis ejecutiva. Resume el texto proporcionado exactamente en 3 viñetas breves, utilizando un tono formal y en idioma español.",
  messages: [
    {
      role: "user",
      content: "El equipo de desarrollo se reunió hoy a las 10 AM. Se acordó migrar la base de datos a PostgreSQL la próxima semana. Juan se encargará de los scripts de migración y Maria probará los endpoints..."
    }
  ]
};
```

* **Resultado devuelto por la IA:**
  * Reunión del equipo de desarrollo realizada a las 10 AM.
  * Acuerdo de migración a base de datos PostgreSQL programado para la próxima semana.
  * Asignación de tareas: Juan ejecuta scripts de migración y María realiza pruebas de endpoints.

---

## 4. Métricas de Tokens y Control de Costos

### Registro de llamadas realizadas

| Endpoint / Prueba | `input_tokens` | `output_tokens` |
| :--- | :---: | :---: |
| `POST /api/ia/preguntar` | 24 | 85 |
| `POST /api/notas/1/resumen` | 142 | 58 |

### Mecanismos para limitar el costo

1. **Parámetro `max_tokens`:** Se envía en el SDK dentro de `client.messages.create`. Garantiza un límite superior para los `output_tokens` producidos por el modelo en cada consulta.
2. **Validación de entrada (Zod):** Configurar restricciones de longitud máxima en el backend (ej. `.max(2000)`) previene peticiones excesivamente largas que incrementen innecesariamente los `input_tokens`.

---

## 5. Validación de Entrada (`req.body`) y Consecuencias

Omitir la validación de los datos entrantes mediante un middleware (ej. Zod) antes de llamar a la API de Claude trae graves problemas:

1. **Desperdicio de presupuesto:** Permite el envío de payloads masivos (ej. textos de +100,000 caracteres) o peticiones maliciosas que disparan el conteo de `input_tokens`, agotando los créditos velozmente.
2. **Peticiones fallidas a terceros (Errores 400 no controlados):** Si un cliente envía un `req.body` vacío `{}` o sin la clave requerida (`pregunta`/`contenido`), la API de Claude reaccionará con un error `400 Invalid Request`. Sin validación previa local, la API consume ancho de banda y tiempo de procesamiento en llamadas fallidas previsibles.

---

## 6. Resolución de Conflictos de Git

### Conflicto detectado
Al intentar integrar la rama `feature/ia` (Integrante B) a `main` (que ya incluía los avances de `feature/notas` del Integrante A), ocurrió un conflicto de fusión en el archivo:
`src/routes/notas.routes.js`

* **Integrante A (`feature/notas`):** Agregó los endpoints CRUD (`GET /:id` y `DELETE /:id`).
* **Integrante B (`feature/ia`):** Importó `claude.service.js` y añadió el endpoint `POST /:id/resumen`.

### Pasos de resolución

1. Actualización de rama base:
   ```bash
   git checkout main
   git pull
   ```
2. Iniciar el proceso de fusión desde la rama de trabajo:
   ```bash
   git checkout feature/ia
   git merge main
   ```
3. **Edición Manual:** Se abrió `src/routes/notas.routes.js` en VS Code para resolver los bloques de conflicto (`<<<<<<<`, `=======`, `>>>>>>>`). Se conservaron tanto las importaciones del servicio de IA como las rutas CRUD existentes, organizándolas limpiamente.
4. **Verificación y Confirmación:**
   ```bash
   # Comprobación local
   npm run dev

   # Subir solución
   git add src/routes/notas.routes.js
   git commit -m "fix: resolver conflicto en rutas de notas"
   git push origin feature/ia
   ```#   S w a g e r  
 