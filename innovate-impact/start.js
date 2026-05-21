// Container startup bootstrap for Azure Database for PostgreSQL Flexible
// Server with Microsoft Entra (AAD) auth.
//
// The Prisma CLI (used here for `db push`) does NOT use our driver adapter
// and reads credentials directly from DATABASE_URL. So before invoking it
// we fetch an Entra access token and inject it into the URL as the
// password. The token is then no longer needed: seed.js and server.js
// build their own pg.Pool via the driver adapter, which re-fetches the
// token on every new pool connection (so 1h token expiry is transparent).
//
// Env contract:
//   DATABASE_URL    postgresql://<user>@<host>:5432/<db>?sslmode=require
//   AZURE_CLIENT_ID (optional) clientId of UAMI to select in ACA
"use strict";

const { spawnSync } = require("child_process");
const { DefaultAzureCredential } = require("@azure/identity");

const PG_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

async function getToken() {
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID,
  });
  const t = await credential.getToken(PG_AAD_SCOPE);
  if (!t?.token) throw new Error("Failed to acquire Entra token for Postgres");
  return t.token;
}

function withPassword(url, password) {
  const u = new URL(url);
  // Tokens are JWTs containing special chars; encode them.
  u.password = encodeURIComponent(password);
  // URL() will re-encode the user as well; restore if it was simple.
  return u.toString();
}

function run(cmd, args, env) {
  console.log(`[start] $ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

(async () => {
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl) {
    console.error("[start] DATABASE_URL is not set");
    process.exit(1);
  }
  console.log("[start] fetching Entra token for Postgres...");
  const token = await getToken();
  const urlWithToken = withPassword(originalUrl, token);

  // 1) Prisma schema push -- needs token in URL.
  run(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push", "--accept-data-loss", "--skip-generate"],
    { ...process.env, DATABASE_URL: urlWithToken }
  );

  // 2) Seed -- uses the driver adapter (DATABASE_URL without token is fine).
  run(process.execPath, ["prisma/seed.js"], process.env);

  // 3) Hand off to the Next.js standalone server.
  console.log("[start] launching Next.js server...");
  require("./server.js");
})().catch((err) => {
  console.error("[start] fatal:", err);
  process.exit(1);
});
