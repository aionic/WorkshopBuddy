// Sweeper job — runs on a schedule (every 5 min) as a Container Apps Job.
// Marks any AgentRun stuck in 'Running' for >30 min as Failed, on the
// assumption the orchestrator worker died, was scaled in, or lost network.
//
// Raw SQL via pg + driver-adapter-style Entra token so we avoid loading
// the full TS Prisma client when we only do one UPDATE.
"use strict";

const { Pool } = require("pg");
const { DefaultAzureCredential } = require("@azure/identity");

const PG_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("[sweeper] DATABASE_URL not set"); process.exit(1); }
  const u = new URL(url);
  const ssl = (u.searchParams.get("sslmode") ?? "require") !== "disable";
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID
  });
  const pool = new Pool({
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    user: decodeURIComponent(u.username),
    ssl: ssl ? { rejectUnauthorized: true } : false,
    password: async () => {
      const t = await credential.getToken(PG_AAD_SCOPE);
      if (!t?.token) throw new Error("Failed to acquire Entra token for Postgres");
      return t.token;
    }
  });

  const sql = `
    UPDATE "AgentRun"
       SET "status" = 'Failed',
           "completedAt" = NOW(),
           "outputJson" = COALESCE("outputJson", '') ||
             CASE WHEN "outputJson" IS NULL OR "outputJson" = ''
                  THEN '{"error":"orchestrator timeout / lost"}'
                  ELSE '' END
     WHERE "status" = 'Running'
       AND "startedAt" IS NOT NULL
       AND "startedAt" < NOW() - INTERVAL '30 minutes'
   RETURNING id
  `;
  const r = await pool.query(sql);
  console.log(`[sweeper] swept ${r.rowCount} stale Running runs`, r.rows.map((x) => x.id));
  await pool.end();
}

main().catch((err) => { console.error("[sweeper] fatal:", err); process.exit(1); });
