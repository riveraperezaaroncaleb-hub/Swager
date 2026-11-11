const { Usuario } = require("../models");

function validarId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validarEntrada(body) {
  if (!body || typeof body.nombre !== "string" || !body.nombre.trim()) {
    return "El campo nombre es obligatorio y debe ser texto.";
  }
  if (
    body.edad !== undefined &&
    body.edad !== null &&
    (!Number.isInteger(body.edad) || body.edad < 0)
  ) {
    return "El campo edad debe ser un entero mayor o igual a cero, o null.";
  }
  return null;
}

async function obtenerTodos(_req, res) {
  try {
    const usuarios = await Usuario.findAll({ order: [["id", "ASC"]] });
    return res.status(200).json(usuarios);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return res.status(500).json({ error: "Error interno al obtener usuarios." });
  }
}

async function obtenerPorId(req, res) {
  try {
    const id = validarId(req.params.id);
    if (!id) return res.status(400).json({ error: "El ID debe ser un entero positivo." });

    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });
    return res.status(200).json(usuario);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return res.status(500).json({ error: "Error interno al obtener el usuario." });
  }
}

async function crear(req, res) {
  try {
    const errorValidacion = validarEntrada(req.body);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const usuario = await Usuario.create({
      nombre: req.body.nombre.trim(),
      edad: req.body.edad ?? null
    });
    return res.status(201).json(usuario);
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return res.status(500).json({ error: "Error interno al crear el usuario." });
  }
}

async function actualizar(req, res) {
  try {
    const id = validarId(req.params.id);
    if (!id) return res.status(400).json({ error: "El ID debe ser un entero positivo." });

    const errorValidacion = validarEntrada(req.body);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

    usuario.nombre = req.body.nombre.trim();
    usuario.edad = req.body.edad ?? null;
    await usuario.save();
    return res.status(200).json(usuario);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    return res.status(500).json({ error: "Error interno al actualizar el usuario." });
  }
}

async function eliminar(req, res) {
  try {
    const id = validarId(req.params.id);
    if (!id) return res.status(400).json({ error: "El ID debe ser un entero positivo." });

    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

    await usuario.destroy();
    return res.status(200).json({ message: "Usuario eliminado correctamente.", usuario });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return res.status(500).json({ error: "Error interno al eliminar el usuario." });
  }
}

module.exports = { obtenerTodos, obtenerPorId, crear, actualizar, eliminar };
