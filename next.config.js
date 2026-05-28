/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "docx", "pptxgenjs", "@azure/service-bus", "@azure/identity"]
  },
  // Workaround for a Next.js 14.2.x + Node 23 webpack bug. Five of our
  // larger client chunks (workshop-board, artifact-workspace,
  // agent-workflow-canvas, projects-list, help/page) fail to build with
  // `Failed to compile. Unexpected end of JSON input` whenever webpack's
  // ModuleConcatenationPlugin (scope hoisting) runs on them. Disabling
  // scope hoisting costs a small bundle-size win but produces a stable
  // production build. Revisit when we upgrade to Next 15 / Node 22 LTS.
  webpack: (config) => {
    if (config.optimization) {
      config.optimization.concatenateModules = false;
    }
    return config;
  }
};
module.exports = nextConfig;
