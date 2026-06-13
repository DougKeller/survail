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
      name: "core-must-not-import-app-or-modules",
      severity: "error",
      from: { path: "^src/core/" },
      to: { path: "^src/(app|modules)/" },
    },
    {
      name: "modules-must-not-import-app",
      severity: "error",
      from: { path: "^src/modules/" },
      to: { path: "^src/app/" },
    },
    {
      name: "module-contracts-must-stay-foundational",
      severity: "error",
      from: { path: "^src/modules/.+/contracts\\.ts$" },
      to: { path: "^src/(app|core/http|modules/.+/(api|ui)/)" },
    },
    {
      name: "module-api-must-not-import-ui",
      severity: "error",
      from: { path: "^src/modules/.+/api/" },
      to: { path: "^src/modules/.+/ui/" },
    },
    {
      name: "agent-must-not-be-imported-by-other-modules",
      severity: "error",
      from: { path: "^src/modules/(?!agent/)" },
      to: { path: "^src/modules/agent/" },
    },
    {
      name: "app-must-not-be-imported",
      severity: "error",
      from: { pathNot: "^src/main\\.tsx$" },
      to: { path: "^src/main\\.tsx$" },
    },
    {
      name: "no-orphans",
      severity: "error",
      from: {
        orphan: true,
        pathNot: "^src/(main\\.tsx|vite-env\\.d\\.ts|.+/contracts\\.ts)$",
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
