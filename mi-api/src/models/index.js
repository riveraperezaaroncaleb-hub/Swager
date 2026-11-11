const fs = require("node:fs");
const path = require("node:path");
const { Sequelize, DataTypes } = require("sequelize");
const configs = require("../config/database");

const environment = process.env.NODE_ENV || "development";
const config = configs[environment];

if (!config) {
  throw new Error(`No existe configuración de base de datos para "${environment}".`);
}

const sequelize = new Sequelize(config);
const db = { sequelize, Sequelize };

for (const file of fs.readdirSync(__dirname)) {
  if (file === "index.js" || !file.endsWith(".js")) continue;
  const defineModel = require(path.join(__dirname, file));
  const model = defineModel(sequelize, DataTypes);
  db[model.name] = model;
}

for (const model of Object.values(db)) {
  if (model && typeof model.associate === "function") {
    model.associate(db);
  }
}

module.exports = db;
