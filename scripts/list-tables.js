// One-off helper to list Postgres tables + row counts using the current
// Azure CLI user's Entra token. Run with:
//   $env:PG_TOKEN = (az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
//   node scripts/list-tables.js
const { Client } = require("pg");

const c = new Client({
  host: "pg-workshopbuddy-eus.postgres.database.azure.com",
  port: 5432,
  database: "workshopbuddy",
  user: process.env.PG_USER || "Jaime Basilico",
  password: process.env.PG_TOKEN,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await c.connect();
  const t = await c.query(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
     ORDER BY table_schema, table_name`
  );
  console.log("=== TABLES ===");
  console.table(t.rows);
  for (const r of t.rows) {
    try {
      const cnt = await c.query(
        `SELECT count(*)::int AS n FROM "${r.table_schema}"."${r.table_name}"`
      );
      console.log(`${r.table_schema}.${r.table_name}: ${cnt.rows[0].n} rows`);
    } catch (e) {
      console.log(`${r.table_schema}.${r.table_name}: count failed (${e.message})`);
    }
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
