import { DataTypes } from "sequelize";

export default (sequelize) => sequelize.define(
  "HistorialIA",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: {
      type: DataTypes.ENUM("preguntar", "resumen"),
      allowNull: false
    },
    promptEntrada: { type: DataTypes.TEXT, allowNull: false },
    respuestaSalida: { type: DataTypes.TEXT, allowNull: false },
    inputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    outputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    modeloUsado: { type: DataTypes.STRING(100), allowNull: false },
    notaId: { type: DataTypes.INTEGER, allowNull: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true }
  },
  {
    tableName: "HistorialIAs",
    timestamps: false
  }
);
