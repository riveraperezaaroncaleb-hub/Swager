import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middlewares/validate.js";
import { usuarioController } from "../controllers/usuarioController.js";

const router = Router();
const createSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(255)
}).strict();
const updateSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(150).optional(),
  password: z.string().min(8).max(255).optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Envía al menos un campo.");

/**
 * @openapi
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         nombre: { type: string, example: "Ana Pérez" }
 *         email: { type: string, format: email, example: "ana@example.com" }
 *         rol: { type: string, enum: [admin, consultor], example: consultor }
 *     UsuarioInput:
 *       type: object
 *       required: [nombre, email, password]
 *       properties:
 *         nombre: { type: string, maxLength: 100 }
 *         email: { type: string, format: email, maxLength: 150 }
 *         password: { type: string, minLength: 8, maxLength: 255, writeOnly: true }
 *     UsuarioUpdate:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nombre: { type: string, maxLength: 100 }
 *         email: { type: string, format: email, maxLength: 150 }
 *         password: { type: string, minLength: 8, maxLength: 255, writeOnly: true }
 */

/**
 * @openapi
 * /api/usuarios:
 *   get:
 *     summary: Lista los usuarios
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: Usuarios registrados.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usuarios:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Usuario' }
 *       500: { description: Error del servidor. }
 */
router.get("/", usuarioController.obtenerTodos);

/**
 * @openapi
 * /api/usuarios/{id}:
 *   get:
 *     summary: Obtiene un usuario por ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Usuario encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usuario: { $ref: '#/components/schemas/Usuario' }
 *       400: { description: ID inválido. }
 *       404: { description: Usuario no encontrado. }
 *       500: { description: Error del servidor. }
 */
router.get("/:id", usuarioController.obtenerPorId);

/**
 * @openapi
 * /api/usuarios:
 *   post:
 *     summary: Crea un usuario consultor
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UsuarioInput' }
 *     responses:
 *       201: { description: Usuario creado. }
 *       400: { description: Datos inválidos. }
 *       409: { description: El correo ya está registrado. }
 *       500: { description: Error del servidor. }
 */
router.post("/", validateBody(createSchema), usuarioController.crear);

/**
 * @openapi
 * /api/usuarios/{id}:
 *   put:
 *     summary: Actualiza nombre, correo o contraseña
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UsuarioUpdate' }
 *     responses:
 *       200: { description: Usuario actualizado. }
 *       400: { description: ID o datos inválidos. }
 *       404: { description: Usuario no encontrado. }
 *       409: { description: El correo ya está registrado. }
 *       500: { description: Error del servidor. }
 */
router.put("/:id", validateBody(updateSchema), usuarioController.actualizar);

/**
 * @openapi
 * /api/usuarios/{id}:
 *   delete:
 *     summary: Elimina un usuario
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Usuario eliminado. }
 *       400: { description: ID inválido. }
 *       404: { description: Usuario no encontrado. }
 *       500: { description: Error del servidor. }
 */
router.delete("/:id", usuarioController.eliminar);

export default router;
