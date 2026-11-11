# Laboratorio 5 — DocuAI Enterprise

API REST con Express 5, Claude (SDK oficial de Anthropic), Prisma y SQLite. Incluye administración de notas, chat multi-turno, streaming SSE, auditoría de uso, Swagger UI y pruebas HTTP con la IA simulada.

## Requisitos

- Node.js 20 o posterior.
- Una clave válida de Anthropic configurada solo en el backend.

## Instalación y ejecución

En PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Configura `ANTHROPIC_API_KEY` dentro de `backend/.env`; nunca la pongas en variables `VITE_*`, código del navegador, capturas ni repositorios. El modelo por defecto se configura mediante `CLAUDE_MODEL`. La base local se crea en `backend/prisma/dev.db`.

Swagger UI: <http://localhost:3000/api-docs>

OpenAPI JSON: <http://localhost:3000/api-docs.json>

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

El frontend consume `http://localhost:3000/api` por defecto. Opcionalmente, configura `VITE_API_URL` en `frontend/.env`.

## Endpoints del laboratorio

| Método | Ruta | Función | Área responsable |
|---|---|---|---|
| GET | `/api/notas` | Lista notas | Pendiente de asignar al equipo |
| GET | `/api/notas/:id` | Obtiene una nota | Pendiente de asignar al equipo |
| POST | `/api/notas` | Crea nota con título y contenido; propietario opcional | Pendiente de asignar al equipo |
| DELETE | `/api/notas/:id` | Elimina una nota | Pendiente de asignar al equipo |
| POST | `/api/ia/preguntar` | Chat libre con Claude; respuesta SSE y contexto multi-turno | Pendiente de asignar al equipo |
| POST | `/api/notas/:id/resumen` | Resume en tres viñetas con Claude y registra tokens | Pendiente de asignar al equipo |
| GET | `/api-docs` | Swagger UI interactivo | Integración |

El API también expone actualización de notas y CRUD de usuarios, historial de IA y conversaciones. El rate limit predeterminado es 10 solicitudes por IP cada 15 minutos (`IA_RATE_LIMIT_MAX`) y protege tanto `/api/ia` como el resumen de notas.

## Organización y colaboración

La estructura ejecutable actual se encuentra en `backend/src/`: `controllers/`, `middlewares/`, `routes/`, `services/`, `utils/`, `config/` y `lib/`. Las notas usan `notas.controller.js` y `notas.service.js`; la integración con Anthropic está en `claude.service.js`.

Antes de entregar, completen con datos reales:

| Integrante | Responsabilidad | Rama `feature/*` | Commits significativos |
|---|---|---|---|
| Integrante A | CRUD de notas | `feature/notas` | Agregar enlaces o hashes |
| Integrante B | Claude, chat y resumen IA | `feature/ia` | Agregar enlaces o hashes |

**Evidencia colaborativa pendiente de adjuntar:** ramas remotas, al menos cinco commits significativos por integrante, Pull Requests con revisión y enlaces a los PRs. El historial visible en este entorno no demuestra esos requisitos, por lo que este README no los presenta como cumplidos.

El `.gitignore` raíz excluye archivos `.env`, dependencias y bases SQLite; los archivos `.env.example` no contienen claves. Si una clave estuvo alguna vez en un commit o se compartió fuera del equipo, debe revocarse y reemplazarse: ignorar el archivo ahora no la elimina del historial de Git.

## Pruebas automatizadas

```powershell
cd backend
npm test
```

Las pruebas usan SQLite aislado y un generador Claude simulado, sin llamar al proveedor ni gastar créditos. Cubren validación, chat multi-turno, streaming SSE, rate limit, CRUD, resumen, historial y el mapeo seguro de errores Anthropic.

Comprobación manual en Swagger UI:

1. Crear una nota con `titulo` y `contenido` (no se requiere `usuarioId`).
2. Consultar el listado y el detalle.
3. Probar un ID inexistente y un cuerpo inválido.
4. Enviar una pregunta a `/api/ia/preguntar` y continuar usando el `conversationId` recibido.
5. Resumir la nota y comprobar las tres viñetas y el registro en `/api/ia/historial`.
6. Eliminar la nota.
7. Probar una clave Anthropic inválida solo en un entorno controlado: la API debe devolver `502` con `IA_NO_DISPONIBLE`. No guardes ni captures la clave falsa.

**Capturas de Swagger y casos marcados con ★: pendientes de generar desde el navegador** después de levantar backend y frontend con una clave de desarrollo. No se incluyen capturas simuladas.

## Preguntas de reflexión

### 1. ¿Por qué la API key no debe estar en el frontend?

Todo el código y las solicitudes del navegador son inspeccionables. Una clave en React, `VITE_*` o los headers visibles para el cliente puede copiarse y usarse fuera de la aplicación. La clave se lee únicamente en el proceso backend y se excluye `.env` del repositorio. Si se filtró previamente, hay que revocarla.

### 2. ¿Cómo se manejan los errores de Anthropic y por qué?

El middleware identifica `Anthropic.APIError` sin exponer el mensaje del proveedor ni credenciales: autenticación inválida (401 de Anthropic) se transforma en `502 IA_NO_DISPONIBLE`; límite del proveedor (429) en `429 IA_LIMITE_ALCANZADO`; sobrecarga (529) en `503 IA_NO_DISPONIBLE`. El cliente de nuestra API no debe interpretar un fallo de credenciales del servidor como si fueran credenciales propias.

### 3. ¿Cuál es la diferencia entre `system` y `messages`?

`system` define el comportamiento e instrucciones globales del asistente. `messages` contiene los turnos `user` y `assistant`; se recuperan de SQLite y se envían en orden para mantener el contexto de la conversación. La integración traduce el mensaje interno de sistema al parámetro `system` que espera Anthropic.

### 4. ¿Cómo se registran tokens y se controlan costos?

Cada respuesta completada registra `input_tokens`, `output_tokens`, modelo, entrada y respuesta en `HistorialIA`. `max_tokens` limita la salida; Zod limita preguntas a 5,000 caracteres y express-rate-limit restringe frecuencia por IP. No se presentan cifras de consumo como mediciones reales sin una respuesta verificada del proveedor.

### 5. ¿Qué aporta validar `req.body` con Zod antes de invocar la IA?

Rechaza campos faltantes, tipos incorrectos y entradas excesivas antes de enviar solicitudes costosas. El middleware sustituye `req.body` con los datos validados/normalizados; los errores siguen el flujo centralizado de `AppError`.

### 6. ¿Cómo se resolvió el conflicto de integración entre `feature/notas` y `feature/ia`?

El código integrado mantiene las rutas CRUD de notas y la ruta de resumen IA en `backend/src/routes/notas.routes.js`; el resumen reutiliza `notas.service.js` para obtener y validar la nota. **El conflicto y su resolución deben respaldarse con el PR/commit real del equipo**: no hay evidencia suficiente en el historial disponible para afirmar quién resolvió el conflicto ni qué revisión se realizó.

## Entregables que faltan para cerrar el laboratorio

- Publicar o verificar la URL del repositorio y que `main` esté actualizada.
- Adjuntar enlaces a los Pull Requests y evidencia de revisión/commits de ambos integrantes.
- Generar y agregar capturas reales de Swagger UI para los casos requeridos.
- Confirmar en el navegador los endpoints Swagger; la documentación también puede comprobarse con `GET /api-docs.json`.
