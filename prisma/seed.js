// Plain JS seed used at container startup (no tsx required at runtime).
// Uses the Prisma 6 @prisma/adapter-pg driver adapter — PrismaPg owns
// the pg.Pool internally; we pass an async `password` callback so every
// new connection picks up a fresh Entra token.
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { DefaultAzureCredential } = require("@azure/identity");

const PG_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

function buildSeedClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const u = new URL(url);
  const ssl = (u.searchParams.get("sslmode") ?? "require") !== "disable";
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID,
  });
  const adapter = new PrismaPg({
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    user: decodeURIComponent(u.username),
    ssl: ssl ? { rejectUnauthorized: true } : false,
    password: async () => {
      const t = await credential.getToken(PG_AAD_SCOPE);
      if (!t?.token) throw new Error("Failed to acquire Entra token for Postgres");
      return t.token;
    },
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  });
  return new PrismaClient({ adapter });
}

const prisma = buildSeedClient();

const SEED_INPUTS = [
  { category: "Pain Point", persona: "Operations", priority: "High", content: "Manual exception handling consumes too much operational capacity." },
  { category: "Technical Constraint", persona: "IT", priority: "High", content: "OCR templates break when vendor layouts change." },
  { category: "Process Bottleneck", persona: "Operations", priority: "High", content: "New document types take weeks to onboard." },
  { category: "Customer Impact", persona: "Customer Experience", priority: "Medium", content: "Mobile-captured images create quality issues." },
  { category: "Technical Constraint", persona: "Engineering", priority: "High", content: "Current systems extract characters but do not understand context." },
  { category: "Solution Idea", persona: "Operations", priority: "High", content: "Operators need next-best-action recommendations." },
  { category: "Business Outcome", persona: "Executive", priority: "Critical", content: "Executives need measurable business impact before funding modernization." },
  { category: "Risk / Dependency", persona: "Compliance", priority: "High", content: "Compliance teams need traceability and audit history." },
  { category: "Customer Impact", persona: "Customer Experience", priority: "High", content: "Customers want faster answers and self-service visibility." },
  { category: "Business Outcome", persona: "Executive", priority: "Critical", content: "Leadership wants a practical 90-day plan, not a multi-year transformation proposal." }
];

async function main() {
  const existing = await prisma.project.findFirst({ where: { name: { contains: "OCR to GenAI" } } });
  if (existing) {
    console.log("Seed project already present:", existing.id);
    return;
  }
  const seedOwnerId =
    process.env.SEED_OWNER_ID ||
    process.env.DEV_AUTH_BYPASS_OID ||
    "98e79176-ff79-441d-ae4e-2bfc5ccf1a06";
  const project = await prisma.project.create({
    data: {
      ownerId: seedOwnerId,
      name: "OCR to GenAI Document Intelligence Modernization",
      clientName: "Demo Global Logistics Client",
      industry: "Transportation, Logistics, Freight, and Shipping",
      businessProblem:
        "Legacy OCR-based document processing is creating high exception handling costs, long onboarding cycles, limited semantic understanding, and poor visibility into document-driven operations.",
      desiredOutcomes: JSON.stringify([
        "Reduce manual exception handling",
        "Increase straight-through-processing to 90% or higher on anchor document types",
        "Reduce new document layout onboarding from weeks to days",
        "Create a governed analytics layer from document streams",
        "Improve customer and operator experience through AI-assisted workflows"
      ]),
      targetAudience: JSON.stringify(["CIO", "CTO", "CFO", "Operations Executive"]),
      selectedArtifacts: JSON.stringify([
        "Impact Statement",
        "Executive Briefing Deck",
        "Solution Map",
        "90-Day Execution Plan",
        "Trends White Paper",
        "KPI Framework"
      ]),
      timeHorizon: "90 days for pilot planning; 6-8 months for full modernization",
      status: "Active"
    }
  });
  for (const input of SEED_INPUTS) {
    await prisma.workshopInput.create({
      data: { ...input, projectId: project.id, submittedBy: "Facilitator", votes: Math.floor(Math.random() * 5) }
    });
  }
  console.log("Seeded project:", project.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
