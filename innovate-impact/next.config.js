/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "docx", "pptxgenjs", "@azure/service-bus", "@azure/identity"]
  }
};
module.exports = nextConfig;
