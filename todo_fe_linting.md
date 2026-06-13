You are working in a frontend project using Vite, React, TypeScript, and Playwright.

The project already has a `check.sh` command used to run all validation checks.

Your task is to strengthen the project’s linting, formatting, typing, testing, accessibility, and architectural validation suite so that it enforces, as much as reasonably possible through tooling, the principles from:

* SOLID
* Clean Code / Uncle Bob-style maintainability principles
* Refactoring.Guru design-pattern guidance
* The Pragmatic Programmer

Do **not** merely describe what should be done. Implement the tooling, configuration, and integration into the existing validation flow.

## Core principle

Tooling is the highest-signal mechanism we have for enforcing code quality, consistency, maintainability, accessibility, and architectural boundaries.

You must **never disable linting rules globally** as a shortcut.

Do not add broad ignores, blanket ESLint disables, relaxed TypeScript settings, or weak configurations to make checks pass. If a rule creates friction, prefer refactoring the code. Exceptions must be narrow, justified, and local.

## Required tools

Add and configure the following tools unless they already exist:

1. **ESLint**

   * Use as the primary linting system.
   * Configure with TypeScript, React, React Hooks, JSX accessibility, import rules, promise rules, unused import detection, and code-quality rules.

2. **Prettier**

   * Use for formatting.
   * ESLint should not fight Prettier.
   * Formatting should be checked in `check.sh`.

3. **TypeScript strict mode**

   * Enable strict typing.
   * Type checking must run independently from build.
   * The goal is to reduce ambiguity, hidden coupling, unsafe props, implicit `any`, and fragile interfaces.

4. **dependency-cruiser**

   * Add architectural import-boundary enforcement.
   * Use it to prevent unhealthy coupling between app layers.
   * This is required because normal ESLint rules do not sufficiently enforce Clean Architecture or dependency direction.

5. **Vitest**

   * Use for unit and component tests unless another test runner already exists.
   * Preserve existing tests.
   * Add coverage checks if coverage does not already exist.

6. **Playwright**

   * Ensure existing Playwright tests run in the validation suite.
   * Use for end-to-end behavior, not as a substitute for unit/component tests.

7. **Knip**

   * Add unused file, export, and dependency detection.
   * Prefer deleting dead code and unused dependencies over preserving speculative abstractions.

8. **ts-prune or Knip exports**

   * If Knip is configured to detect unused exports, separate `ts-prune` is optional.
   * Do not keep dead exports just because they might be useful later.

9. **size-limit or bundle analysis**

   * Add a lightweight bundle-size guard if the project has a build output.
   * The goal is to prevent accidental dependency bloat.

## ESLint configuration

Use a strict but practical ESLint setup.

Required packages should include the equivalent of:

```bash
npm install -D \
  eslint \
  typescript-eslint \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-jsx-a11y \
  eslint-plugin-import \
  eslint-import-resolver-typescript \
  eslint-plugin-unused-imports \
  eslint-plugin-sonarjs \
  eslint-plugin-promise \
  eslint-config-prettier \
  prettier
```

Configure ESLint to enforce:

* TypeScript safety
* React correctness
* React Hooks correctness
* Accessibility
* No unused imports
* No floating promises
* No ignored promises
* No `console.log` in committed code
* No debugger statements
* No duplicated branches
* No overly complex functions
* No default exports for shared modules unless the project already consistently uses them
* Consistent import ordering
* No circular dependencies
* No restricted cross-layer imports

Example `eslint.config.js` direction:

```js
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import sonarjs from "eslint-plugin-sonarjs";
import promise from "eslint-plugin-promise";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.recommended,
  promise.configs["flat/recommended"],
  sonarjs.configs.recommended,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: true,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": "error",

      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-identical-functions": "error",

      "import/no-cycle": "error",
      "import/no-default-export": "error"
    },
  },
  {
    files: ["*.config.*", "vite.config.*", "playwright.config.*"],
    rules: {
      "import/no-default-export": "off"
    }
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "sonarjs/no-duplicate-string": "off"
    }
  }
);
```

Do not add additional disabled rules unless absolutely necessary. If an exception is needed, make it file-scoped or line-scoped and explain why.

## TypeScript configuration

Use strict TypeScript settings.

In `tsconfig.json`, ensure the equivalent of:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "useUnknownInCatchVariables": true
  }
}
```

If these settings expose many existing issues, do not weaken them globally without justification. Prefer fixing the code. If migration is required, document temporary exceptions explicitly.

## Architectural boundaries

Add `dependency-cruiser`.

Required package:

```bash
npm install -D dependency-cruiser
```

Create a dependency-cruiser config that reflects the actual project structure.

Prefer a layered frontend architecture similar to:

```text
src/app
src/pages
src/features
src/entities
src/shared
```

or, if the project is simpler:

```text
src/routes
src/features
src/components
src/hooks
src/lib
src/api
```

The exact folders should match the existing codebase. Do not invent a new architecture unless necessary.

Enforce rules such as:

* `shared` must not import from `features`, `pages`, or `app`
* `entities` must not import from `features`, `pages`, or `app`
* `features` must not import from `pages` or `app`
* `pages` must not import from `app`
* UI components must not directly import API clients unless they are intentionally container components
* domain/model code must not import React components
* shared utilities must stay framework-light where practical
* no circular dependencies
* no orphan modules unless explicitly allowed

Example dependency-cruiser rule direction:

```js
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },
    {
      name: "shared-must-not-depend-on-higher-layers",
      severity: "error",
      from: { path: "^src/shared" },
      to: { path: "^src/(features|pages|app)" }
    },
    {
      name: "features-must-not-depend-on-pages-or-app",
      severity: "error",
      from: { path: "^src/features" },
      to: { path: "^src/(pages|app)" }
    },
    {
      name: "domain-must-not-import-ui",
      severity: "error",
      from: { path: "^src/(entities|domain|model)" },
      to: { path: "^src/.*/(components|ui)" }
    }
  ],
  options: {
    doNotFollow: {
      path: "node_modules"
    },
    tsConfig: {
      fileName: "tsconfig.json"
    }
  }
};
```

Adapt the layer names to the actual project.

## Testing and coverage

Ensure the validation suite runs:

```bash
vitest run
playwright test
```

If coverage does not already exist, add coverage with Vitest:

```bash
npm install -D @vitest/coverage-v8
```

Recommended minimum:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "html"],
  thresholds: {
    statements: 80,
    branches: 70,
    functions: 80,
    lines: 80
  }
}
```

Do not chase coverage with low-value tests. Prefer meaningful tests around behavior, state transitions, rendering logic, accessibility expectations, and integration boundaries.

## Accessibility

Accessibility is part of frontend code quality.

Ensure `eslint-plugin-jsx-a11y` is enabled.

Where practical, tests should use accessible selectors:

* `getByRole`
* `getByLabel`
* `getByText`
* `getByPlaceholder`
* Playwright role-based locators

Avoid brittle selectors based on implementation details unless no semantic selector is available.

## Dead code and dependency hygiene

Add Knip:

```bash
npm install -D knip
```

Add a script such as:

```json
{
  "scripts": {
    "knip": "knip"
  }
}
```

Use Knip to detect:

* unused files
* unused exports
* unused dependencies
* unused devDependencies

Prefer removing dead code over creating broad ignores.

## Bundle-size guard

If the project has a production build, add a bundle-size check.

Use either `size-limit` or an existing bundle analyzer. Prefer a lightweight CI-compatible guard.

Example:

```bash
npm install -D size-limit @size-limit/preset-app
```

Example package config:

```json
{
  "size-limit": [
    {
      "path": "dist/assets/*.js",
      "limit": "250 KB"
    }
  ]
}
```

The exact threshold should be realistic for the app. Do not set an arbitrary threshold that immediately fails without context. Establish a baseline and prevent accidental growth.

## Validation command

Update the existing `check.sh` command so it runs all required checks.

The script should fail fast and use strict shell behavior:

```bash
#!/usr/bin/env bash
set -euo pipefail

npm run format:check
npm run lint
npm run typecheck
npm run depcruise
npm run knip
npm run test
npm run test:e2e
npm run build
npm run size
```

Add or update `package.json` scripts as needed:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "depcruise": "depcruise src --config .dependency-cruiser.js",
    "knip": "knip",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "build": "vite build",
    "size": "size-limit"
  }
}
```

If the project uses `pnpm` or `yarn`, use the project’s existing package manager consistently.

## Implementation expectations

After implementing the tooling:

1. Add or update dependencies using the project’s package manager.
2. Add or update ESLint, Prettier, TypeScript, dependency-cruiser, Vitest, Playwright, Knip, and bundle-size configuration.
3. Update `package.json` scripts.
4. Update `check.sh`.
5. Run `check.sh`.
6. Fix violations by improving the code, not by weakening the checks.
7. Keep exceptions narrow, local, and documented.
8. Do not introduce speculative abstractions purely to satisfy design-pattern ideals.
9. Prefer simple, explicit, cohesive code.
10. Prefer composition over inheritance.
11. Keep dependency direction clean and intentional.
12. Avoid god components, oversized hooks, over-generic abstractions, service locators, global mutable state, and premature factory patterns.
13. Preserve existing behavior.

## Frontend-specific quality expectations

The codebase should trend toward:

* Small components with clear responsibilities
* Hooks that encapsulate behavior without becoming hidden service layers
* Clear separation between UI, state, data access, and domain logic
* Explicit prop types
* Minimal `useEffect` complexity
* Accessible markup
* Stable tests based on user-visible behavior
* No unnecessary memoization
* No speculative generic components
* No hidden cross-feature imports
* No avoidable global state
* No broad test mocking that hides integration failures

## Definition of done

The task is complete only when:

* `check.sh` runs Prettier formatting checks
* `check.sh` runs ESLint
* `check.sh` runs TypeScript type checking
* `check.sh` runs dependency-cruiser architectural checks
* `check.sh` runs Knip dead-code/dependency checks
* `check.sh` runs unit/component tests
* `check.sh` runs Playwright tests
* `check.sh` runs a production build
* `check.sh` runs a bundle-size guard if applicable
* The validation suite passes
* No linting rules are globally disabled to force success
* Any exceptions are narrow, documented, and justified
