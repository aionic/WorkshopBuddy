import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { execSync } from "child_process";
import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";
import { env } from "./env";

// =====================================================================
// Prisma client wired to Azure Database for PostgreSQL Flexible Server
// with Microsoft Entra (AAD) authentication.
//
// DATABASE_URL is a postgres URL like:
//   postgresql://<entra-user>@<host>:5432/<db>?sslmode=require
// The "password" is an Entra access token (scope
//   https://ossrdbms-aad.database.windows.net/.default).
//
// Prisma 6: PrismaPg now owns the pg.Pool — we pass pg connection config
// directly and supply an async `password` callback. The pg driver invokes
// the callback for every NEW pool connection, so token expiry is handled
// transparently without manual pool churn.
//
// Two credential modes:
//   - "cli"               → local dev, shells out to `az account get-access-token`
//   - "managed-identity"  → ACA, DefaultAzureCredential bound to the UAMI
// Both produce a string token, cached in-process until ~5 min before expiry.
// =====================================================================

const PG_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";
const PG_AAD_RESOURCE = "https://ossrdbms-aad.database.windows.net";
const REFRESH_LEAD_MS = 5 * 60_000;

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

type CachedTok = { token: string; expiresOnMs: number };
const tokenCache = new Map<string, CachedTok>();

async function getCachedToken(
  key: string,
  fetcher: () => Promise<CachedTok>,
): Promise<string> {
  const cached = tokenCache.get(key);
  if (cached && cached.expiresOnMs - Date.now() > REFRESH_LEAD_MS) {
    return cached.token;
  }
  const fresh = await fetcher();
  tokenCache.set(key, fresh);
  return fresh.token;
}

function buildPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const parsed = parsePgUrl(url);

  // S-8: explicit credential-mode switch sourced from validated env.
  const useAzCli = env.credentialMode === "cli";

  let getToken: () => Promise<string>;
  if (useAzCli) {
    // Local dev: shell out to az CLI via cmd.exe (handles .cmd shims;
    // execFileSync('az.cmd', ...) raises EINVAL after CVE-2024-27980).
    getToken = () =>
      getCachedToken("cli", async () => {
        const out = execSync(
          `az account get-access-token --resource ${PG_AAD_RESOURCE} --query "[accessToken,expiresOn]" -o tsv`,
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        );
        const [token, expiresOn] = out.trim().split(/\s+/);
        const expiresOnMs = Date.parse(expiresOn);
        return {
          token,
          expiresOnMs: Number.isFinite(expiresOnMs)
            ? expiresOnMs
            : Date.now() + 50 * 60_000,
        };
      });
  } else {
    // ACA: UAMI-backed DefaultAzureCredential.
    const credential: TokenCredential = new DefaultAzureCredential({
      managedIdentityClientId: process.env.AZURE_CLIENT_ID,
    });
    getToken = () =>
      getCachedToken("mi", async () => {
        const t = await credential.getToken(PG_AAD_SCOPE);
        if (!t?.token) throw new Error("Failed to acquire Entra token for Postgres");
        return { token: t.token, expiresOnMs: t.expiresOnTimestamp };
      });
  }

  // Prisma 6 PrismaPg: takes pg connection config + owns the pool.
  // Explicit v6 timeout defaults so the v7 upgrade is a no-op here.
  const adapter = new PrismaPg({
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    user: parsed.user,
    // System CA bundle (includes DigiCert Global Root G2, root for
    // *.postgres.database.azure.com); SNI hostname verification is on
    // by default — passing no `ca` enables system-root validation.
    ssl: parsed.ssl ? { rejectUnauthorized: true } : false,
    password: getToken,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  });

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
