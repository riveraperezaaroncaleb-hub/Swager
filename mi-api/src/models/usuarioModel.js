module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "Usuario",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true }
      },
      edad: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0 }
      }
    },
    {
      tableName: "Usuarios",
      timestamps: true
    }
  );
};
