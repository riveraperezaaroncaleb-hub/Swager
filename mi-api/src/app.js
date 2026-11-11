const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const { sequelize } = require("./models");
const usuarioRoutes = require("./routes/usuarioRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/usuarios", usuarioRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error("Error no controlado:", error);
  res.status(500).json({ error: "Error interno del servidor." });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  sequelize.authenticate()
    .then(() => {
      app.listen(port, () => {
        console.log(`API disponible en http://localhost:${port}`);
        console.log(`Documentación Swagger en http://localhost:${port}/api-docs`);
      });
    })
    .catch((error) => {
      console.error("No se pudo conectar a MySQL:", error.message);
      process.exitCode = 1;
    });
}

module.exports = app;
