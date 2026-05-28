// Probe which Postgres Entra username works against the flex server.
// Usage:  node scripts/pg-probe.js
const { Client } = require("pg");
const { execSync } = require("child_process");

const HOST = "pg-workshopbuddy-eus.postgres.database.azure.com";
const DB = "workshopbuddy";
const CANDIDATES = [
  "Jaime Basilico",
  "jamesbas@microsoft.com",
  "jamesbas",
  "Jaime.Basilico@microsoft.com",
  "James.Basilico@microsoft.com",
];

function getToken() {
  const out = execSync(
    'az account get-access-token --resource https://ossrdbms-aad.database.windows.net --query accessToken -o tsv',
    { encoding: "utf8" },
  );
  return out.trim();
}

(async () => {
  const token = getToken();
  console.log(`Got token (len=${token.length}).\n`);
  for (const user of CANDIDATES) {
    process.stdout.write(`-- trying user='${user}' ... `);
    const c = new Client({
      host: HOST,
      port: 5432,
      database: DB,
      user,
      password: token,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    try {
      await c.connect();
      const r = await c.query("select current_user, current_database()");
      console.log(`OK  -> ${JSON.stringify(r.rows[0])}`);
      const r2 = await c.query(
        "select rolname from pg_roles where rolcanlogin order by 1",
      );
      console.log("Login roles on server:");
      for (const row of r2.rows) console.log("  - " + row.rolname);
      await c.end();
      process.exit(0);
    } catch (err) {
      console.log("FAIL: " + (err.message || err));
      try { await c.end(); } catch {}
    }
  }
  console.log("\nNo candidate succeeded.");
  process.exit(1);
})();
