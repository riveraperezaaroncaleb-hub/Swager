import { Sequelize } from "sequelize";
import { createRequire } from "node:module";
import UsuarioModel from "./Usuario.js";
import NotaModel from "./Nota.js";
import HistorialIAModel from "./HistorialIA.js";

const require = createRequire(import.meta.url);
const configs = require("../config/database.cjs");
const environment = process.env.NODE_ENV || "development";
const config = configs[environment];

if (!config) {
  throw new Error(`No existe configuración de base de datos para "${environment}".`);
}

export const sequelize = new Sequelize(config);
export const Usuario = UsuarioModel(sequelize);
export const Nota = NotaModel(sequelize);
export const HistorialIA = HistorialIAModel(sequelize);

Usuario.hasMany(Nota, { foreignKey: "usuarioId", as: "notas", onDelete: "CASCADE" });
Nota.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

Usuario.hasMany(HistorialIA, { foreignKey: "usuarioId", as: "historialIA", onDelete: "SET NULL" });
HistorialIA.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
Nota.hasMany(HistorialIA, { foreignKey: "notaId", as: "historialIA", onDelete: "SET NULL" });
HistorialIA.belongsTo(Nota, { foreignKey: "notaId", as: "nota" });
