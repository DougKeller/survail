/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "types-must-stay-foundational",
      severity: "error",
      from: { path: "^src/types\\.ts$" },
      to: { path: "^src/(api|CardPresentation|main)\\.tsx?$" },
    },
    {
      name: "api-must-not-import-ui-or-app",
      severity: "error",
      from: { path: "^src/api\\.ts$" },
      to: { path: "^src/(CardPresentation|main)\\.tsx?$" },
    },
    {
      name: "presentation-must-not-import-api-or-app",
      severity: "error",
      from: { path: "^src/CardPresentation\\.tsx$" },
      to: { path: "^src/(api|main)\\.tsx?$" },
    },
    {
      name: "no-orphans",
      severity: "error",
      from: {
        orphan: true,
        pathNot: "^src/(main\\.tsx|types\\.ts|vite-env\\.d\\.ts)$",
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "\\.(css|test\\.(ts|tsx)|spec\\.(ts|tsx))$",
    },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
