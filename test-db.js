const { Client } = require('pg');

// Pega aquí directamente la URL que quieras probar (prueba la directa o la del pooler)
const connectionString = "postgresql://postgres.ycxvggrbvesswfyssvuh:petroenergy2026*@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000 // Si en 5 segundos no conecta, avisa
});

async function run() {
  console.log("Intentando conectar a Supabase...");
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log(" ¡CONEXIÓN EXITOSA! Hora del servidor:", res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error("❌ ERROR DE CONEXIÓN:", err.message);
  }
}

run();