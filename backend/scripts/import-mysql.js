import "dotenv/config";
import mysql from "mysql2/promise";
import { prisma } from "../src/lib/prisma.js";

const tableNames = ["Usuarios", "Notas", "HistorialIAs"];

async function readLegacyTable(connection, tableName) {
  const [tables] = await connection.query("SHOW TABLES LIKE ?", [tableName]);
  if (tables.length === 0) return [];
  const [rows] = await connection.query(`SELECT * FROM \`${tableName}\` ORDER BY id`);
  return rows;
}

async function importRows(rows, model, mapRow) {
  let imported = 0;
  for (const row of rows) {
    const data = mapRow(row);
    const existing = await model.findUnique({ where: { id: data.id } });
    if (existing) continue;
    await model.create({ data });
    imported += 1;
  }
  return imported;
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "notas_api"
});

try {
  const [usuarios, notas, historial] = await Promise.all(
    tableNames.map((name) => readLegacyTable(connection, name))
  );

  const result = await prisma.$transaction(async (tx) => {
    const importedUsers = await importRows(usuarios, tx.usuario, (row) => ({
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      password: row.password,
      rol: row.rol
    }));
    const importedNotes = await importRows(notas, tx.nota, (row) => ({
      id: row.id,
      titulo: row.titulo,
      contenido: row.contenido,
      usuarioId: row.usuarioId
    }));
    const importedHistory = await importRows(historial, tx.historialIA, (row) => ({
      id: row.id,
      tipo: row.tipo,
      promptEntrada: row.promptEntrada,
      respuestaSalida: row.respuestaSalida,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      modeloUsado: row.modeloUsado,
      notaId: row.notaId,
      usuarioId: row.usuarioId
    }));
    return { importedUsers, importedNotes, importedHistory };
  });

  console.log("Importación MySQL → SQLite completada:", result);
  console.log("Los datos originales de MySQL no se modificaron.");
} finally {
  await connection.end();
  await prisma.$disconnect();
}
