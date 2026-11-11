import { DataTypes } from "sequelize";

export default (sequelize) => sequelize.define(
  "Nota",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    titulo: { type: DataTypes.STRING(100), allowNull: false },
    contenido: { type: DataTypes.TEXT, allowNull: false },
    usuarioId: { type: DataTypes.INTEGER, allowNull: false }
  },
  {
    tableName: "Notas",
    timestamps: false
  }
);
