import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT) || 3000;

try {
  await prisma.$connect();
  const server = app.listen(port, () => console.log(`API lista en http://localhost:${port}`));

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error("No se pudo conectar a SQLite:", error.message);
  process.exitCode = 1;
}
