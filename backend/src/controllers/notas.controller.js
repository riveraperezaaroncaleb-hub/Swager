import { prisma } from "../lib/prisma.js";
import { obtenerNotaPorId } from "../services/notas.service.js";
import { AppError } from "../utils/errors.js";

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError("El ID debe ser un entero positivo.", 400);
  }
  return id;
}

export const notasController = {
  async listar(_req, res, next) {
    try {
      const notas = await prisma.nota.findMany({
        include: { usuario: { select: { id: true, nombre: true, email: true } } },
        orderBy: { createdAt: "desc" }
      });
      res.json({ notas });
    } catch (error) {
      next(error);
    }
  },

  async obtenerPorId(req, res, next) {
    try {
      const nota = await obtenerNotaPorId(req.params.id, prisma, {
        usuario: { select: { id: true, nombre: true, email: true } }
      });
      res.json({ nota });
    } catch (error) {
      next(error);
    }
  },

  async crear(req, res, next) {
    try {
      let usuarioId = null;
      if (req.body.usuarioId !== undefined) {
        const usuario = await prisma.usuario.findUnique({
          where: { id: req.body.usuarioId },
          select: { id: true }
        });
        if (!usuario) throw new AppError("El usuario indicado no existe.", 404);
        usuarioId = usuario.id;
      }

      const nota = await prisma.nota.create({
        data: {
          titulo: req.body.titulo,
          contenido: req.body.contenido,
          usuarioId
        },
        include: { usuario: { select: { id: true, nombre: true, email: true } } }
      });
      res.status(201).json({ nota });
    } catch (error) {
      next(error);
    }
  },

  async actualizar(req, res, next) {
    try {
      const id = parseId(req.params.id);
      const data = {
        ...(req.body.titulo !== undefined && { titulo: req.body.titulo }),
        ...(req.body.contenido !== undefined && { contenido: req.body.contenido })
      };
      if (req.body.usuarioId !== undefined) {
        const usuario = await prisma.usuario.findUnique({
          where: { id: req.body.usuarioId },
          select: { id: true }
        });
        if (!usuario) throw new AppError("El usuario indicado no existe.", 404);
        data.usuarioId = usuario.id;
      }

      const result = await prisma.nota.updateMany({ where: { id }, data });
      if (result.count === 0) throw new AppError("Nota no encontrada.", 404);
      const nota = await prisma.nota.findUnique({
        where: { id },
        include: { usuario: { select: { id: true, nombre: true, email: true } } }
      });
      res.json({ nota });
    } catch (error) {
      next(error);
    }
  },

  async eliminar(req, res, next) {
    try {
      const id = parseId(req.params.id);
      const result = await prisma.nota.deleteMany({ where: { id } });
      if (result.count === 0) throw new AppError("Nota no encontrada.", 404);
      res.json({ message: "Nota eliminada correctamente." });
    } catch (error) {
      next(error);
    }
  }
};
