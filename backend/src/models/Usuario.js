import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";

export default (sequelize) => sequelize.define(
  "Usuario",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    rol: {
      type: DataTypes.ENUM("admin", "consultor"),
      allowNull: false,
      defaultValue: "consultor"
    }
  },
  {
    tableName: "Usuarios",
    timestamps: false,
    defaultScope: { attributes: { exclude: ["password"] } },
    hooks: {
      async beforeSave(usuario) {
        if (usuario.changed("password")) {
          usuario.password = await bcrypt.hash(usuario.password, 12);
        }
      }
    }
  }
);
