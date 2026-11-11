import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

const publicFields = { id: true, nombre: true, email: true, rol: true };

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError("El ID debe ser un entero positivo.", 400);
  }
  return id;
}

function handlePrismaError(error, next) {
  if (error.code === "P2002") return next(new AppError("El correo ya está registrado.", 409));
  if (error.code === "P2025") return next(new AppError("Usuario no encontrado.", 404));
  next(error);
}

export const usuarioController = {
  async obtenerTodos(_req, res, next) {
    try {
      const usuarios = await prisma.usuario.findMany({
        select: publicFields,
        orderBy: { id: "asc" }
      });
      res.json({ usuarios });
    } catch (error) {
      next(error);
    }
  },

  async obtenerPorId(req, res, next) {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: parseId(req.params.id) },
        select: publicFields
      });
      if (!usuario) throw new AppError("Usuario no encontrado.", 404);
      res.json({ usuario });
    } catch (error) {
      next(error);
    }
  },

  async crear(req, res, next) {
    try {
      const usuario = await prisma.usuario.create({
        data: {
          nombre: req.body.nombre,
          email: req.body.email.toLowerCase(),
          password: await bcrypt.hash(req.body.password, 12),
          rol: "consultor"
        },
        select: publicFields
      });
      res.status(201).json({ usuario });
    } catch (error) {
      handlePrismaError(error, next);
    }
  },

  async actualizar(req, res, next) {
    try {
      const id = parseId(req.params.id);
      const data = {
        ...(req.body.nombre !== undefined && { nombre: req.body.nombre }),
        ...(req.body.email !== undefined && { email: req.body.email.toLowerCase() }),
        ...(req.body.password !== undefined && {
          password: await bcrypt.hash(req.body.password, 12)
        })
      };
      const usuario = await prisma.usuario.update({
        where: { id },
        data,
        select: publicFields
      });
      res.json({ usuario });
    } catch (error) {
      handlePrismaError(error, next);
    }
  },

  async eliminar(req, res, next) {
    try {
      const id = parseId(req.params.id);
      const result = await prisma.usuario.deleteMany({ where: { id } });
      if (result.count === 0) throw new AppError("Usuario no encontrado.", 404);
      res.json({ message: "Usuario eliminado correctamente." });
    } catch (error) {
      next(error);
    }
  }
};
