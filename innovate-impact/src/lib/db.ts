import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";
import { execSync } from "child_process";
import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";

// =====================================================================
// Prisma client wired to Azure Database for PostgreSQL Flexible Server
// with Microsoft Entra (AAD) authentication.
//
// DATABASE_URL is a postgres URL like:
//   postgresql://<entra-user>@<host>:5432/<db>?sslmode=require
// The "password" is an Entra access token (scope
//   https://ossrdbms-aad.database.windows.net/.default).
//
// Two paths:
//   - Local dev (no AZURE_CLIENT_ID): pre-fetch the token synchronously
//     via `az account get-access-token` and pass it as a STRING password
//     on pg.Pool. The token is refreshed every 50 min by rebuilding the
//     pool. (password-as-async-function caused intermittent
//     "Connection terminated unexpectedly" with this version of pg/
//     @prisma/adapter-pg under Next.js HMR.)
//   - ACA (AZURE_CLIENT_ID set): use DefaultAzureCredential bound to the
//     UAMI and pass an async function as the password so every new pool
//     connection picks up a fresh token.
// =====================================================================

const PG_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";
const PG_AAD_RESOURCE = "https://ossrdbms-aad.database.windows.net";

function parsePgUrl(url: string) {
  const u = new URL(url);
  const ssl = (u.searchParams.get("sslmode") ?? "require") !== "disable";
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    user: decodeURIComponent(u.username),
    ssl,
  };
}

function getTokenSyncViaAzCli(): string {
  // execSync goes through cmd.exe, which handles .cmd shims correctly on
  // Windows (execFileSync('az.cmd', ...) raises EINVAL after Node's
  // CVE-2024-27980 fix). Local dev only.
  const out = execSync(
    `az account get-access-token --resource ${PG_AAD_RESOURCE} --query accessToken -o tsv`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return out.trim();
}

function buildPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const parsed = parsePgUrl(url);
  const useAzCli = !process.env.AZURE_CLIENT_ID;

  // Local dev: pre-fetch token, use string password, rebuild pool every 50 min.
  if (useAzCli) {
    function buildPoolWithToken(token: string): Pool {
      const config: PoolConfig = {
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        user: parsed.user,
        // Verify against Node's built-in Mozilla CA bundle (includes
        // DigiCert Global Root G2, the root for *.postgres.database.azure.com).
        // SNI hostname verification is on by default — passing no `ca`
        // option is what enables system-root validation.
        ssl: parsed.ssl ? { rejectUnauthorized: true } : false,
        password: token,
      };
      const p = new Pool(config);
      p.on("error", (err) => {
        console.warn("[prisma-pg] idle client error:", err.message);
      });
      return p;
    }

    let pool = buildPoolWithToken(getTokenSyncViaAzCli());
    const adapter = new PrismaPg(pool);
    const refresh = setInterval(() => {
      try {
        const newPool = buildPoolWithToken(getTokenSyncViaAzCli());
        const oldPool = pool;
        pool = newPool;
        // @ts-expect-error PrismaPg holds the pool privately; swap it in.
        adapter.pool = newPool;
        oldPool.end().catch(() => {});
      } catch (e) {
        console.warn("[prisma-pg] token refresh failed:", (e as Error).message);
      }
    }, 50 * 60_000);
    refresh.unref?.();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter, log: ["warn", "error"] } as any);
  }

  // ACA: async credential + password function.
  const credential: TokenCredential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID,
  });
  const config: PoolConfig = {
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    user: parsed.user,
    // See note in buildPoolWithToken — system CA bundle + SNI verification.
    ssl: parsed.ssl ? { rejectUnauthorized: true } : false,
    password: async () => {
      const tok = await credential.getToken(PG_AAD_SCOPE);
      if (!tok?.token) throw new Error("Failed to acquire Entra token for Postgres");
      return tok.token;
    },
  };
  const pool = new Pool(config);
  pool.on("error", (err) => {
    console.warn("[prisma-pg] idle client error:", err.message);
  });
  const adapter = new PrismaPg(pool);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter, log: ["warn", "error"] } as any);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Lazy proxy: do not build the Prisma client (and do not call `az` or
// touch Postgres) until something actually accesses it. This prevents
// failures during `next build` page-data collection inside the Docker
// image, where neither AZURE_CLIENT_ID nor `az` is available.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = buildPrisma();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
}) as PrismaClient;
