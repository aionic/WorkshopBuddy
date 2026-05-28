// Container startup bootstrap for Azure Database for PostgreSQL Flexible
// Server with Microsoft Entra (AAD) auth.
//
// As of P0-3, this script no longer mutates schema. Schema migrations run
// out-of-band via `prisma migrate deploy` in the azd predeploy hook (see
// azure.yaml). This container only:
//   1. Seeds the DB if empty (idempotent; uses the driver adapter, which
//      fetches its own Entra token per pool connection).
//   2. Launches the Next.js standalone server.
//
// If a schema change ships without the migration job having run, the app
// surfaces a Prisma "column X does not exist" runtime error — preferred over
// `db push --accept-data-loss` silently dropping columns to match an older
// container image (the P0-2 deploy crashloop, 2026-05-27).
//
// Env contract:
//   DATABASE_URL    postgresql://<user>@<host>:5432/<db>?sslmode=require
//   AZURE_CLIENT_ID (optional) clientId of UAMI to select in ACA
"use strict";

const { spawnSync } = require("child_process");

function run(cmd, args, env) {
  console.log(`[start] $ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error("[start] DATABASE_URL is not set");
    process.exit(1);
  }

  // 1) Seed -- idempotent (no-ops if seed row already present).
  //    seed.js uses the driver adapter, which fetches its own Entra token.
  run(process.execPath, ["prisma/seed.js"], process.env);

  // 2) Hand off to the Next.js standalone server.
  console.log("[start] launching Next.js server...");
  require("./server.js");
})().catch((err) => {
  console.error("[start] fatal:", err);
  process.exit(1);
});
