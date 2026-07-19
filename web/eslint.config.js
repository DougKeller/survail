import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import promise from "eslint-plugin-promise";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const typedFiles = ["**/*.{ts,tsx}"];
const testFiles = [
  "**/*.test.{ts,tsx}",
  "**/*.spec.{ts,tsx}",
  "tests/**/*.{ts,tsx}",
];
const configFiles = [
  "*.config.{js,ts}",
  ".dependency-cruiser.cjs",
  "eslint.config.js",
];
const jsFiles = ["**/*.{js,cjs,mjs}"];

// Modules must stay self-contained: one zone per module forbids importing any
// sibling module's code. Contracts files are excepted because they may be
// imported type-only across module boundaries and this plugin cannot tell
// type-only imports apart; .dependency-cruiser.cjs enforces the stricter
// runtime rule (modules-must-not-import-other-modules). Add new modules and
// contracts files to these lists.
const moduleNames = ["agent", "auth", "cards", "decks", "imports"];
const moduleContracts = [
  "./agent/contracts.ts",
  "./auth/contracts.ts",
  "./cards/contracts.ts",
  "./decks/contracts.ts",
  "./decks/analytics/contracts.ts",
  "./decks/evaluations/contracts.ts",
  "./decks/guidance/contracts.ts",
  "./decks/operations/contracts.ts",
  "./imports/contracts.ts",
];
const crossModuleZones = moduleNames.map((name) => ({
  target: `./src/modules/${name}`,
  from: "./src/modules",
  except: [`./${name}`, ...moduleContracts],
  message: `modules must stay self-contained; ${name} may only import other modules' contracts (type-only).`,
}));

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  promise.configs["flat/recommended"],
  prettier,
  {
    files: jsFiles,
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      sonarjs,
      "unused-imports": unusedImports,
    },
    settings: {
      "import/resolver": {
        typescript: true,
      },
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "import/newline-after-import": "error",
      "import/no-cycle": "error",
      "import/no-default-export": "error",
      "import/no-named-as-default": "off",
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/core",
              from: "./src/app",
              message: "core is foundational and must not depend on app.",
            },
            {
              target: "./src/core",
              from: "./src/modules",
              message: "core is foundational and must not depend on modules.",
            },
            {
              target: "./src/modules",
              from: "./src/app",
              message: "modules must not depend on app.",
            },
            {
              target: "./src/designsystem",
              from: "./src/app",
              message:
                "the design system is standalone and must not depend on app.",
            },
            {
              target: "./src/designsystem",
              from: "./src/modules",
              message:
                "the design system is standalone and must not depend on modules.",
            },
            {
              target: "./src/designsystem",
              from: "./src/core",
              message:
                "the design system is standalone and must not depend on core.",
            },
            ...crossModuleZones,
          ],
        },
      ],
      "import/no-unresolved": ["error", { ignore: ["\\.css$"] }],
      "import/order": "off",
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message:
                "Style with stylesheets and design tokens; runtime-computed styles belong in the files exempted in eslint.config.js.",
            },
            {
              propName: "className",
              message:
                "App code composes design-system components; classNames belong inside src/designsystem.",
            },
          ],
        },
      ],
      "jsx-a11y/no-autofocus": "off",
      "react/prop-types": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-identical-functions": "error",
      "unused-imports/no-unused-imports": "error",
    },
  },
  {
    files: configFiles,
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
    rules: {
      "import/no-unresolved": "off",
      "import/no-default-export": "off",
      "no-undef": "off",
    },
  },
  {
    files: testFiles,
    rules: {
      "import/no-restricted-paths": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-identical-functions": "off",
    },
  },
  {
    files: [
      "src/app/deckPrimitives.tsx",
      "src/app/deck/printingPicker.tsx",
      "src/app/screens/*.tsx",
      "src/app/editor/*.tsx",
      "src/app/library/*.tsx",
      "src/modules/cards/ui/*.tsx",
    ],
    rules: {
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["src/app/screens/EditorScreen.tsx"],
    rules: {
      "promise/always-return": "off",
      "react-hooks/exhaustive-deps": "off",
      "sonarjs/cognitive-complexity": "off",
      "jsx-a11y/no-noninteractive-tabindex": "off",
    },
  },
  {
    files: ["src/app/editor/useDeckEditor.ts"],
    rules: {
      "promise/always-return": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    // The design system owns classNames; DOM style stays banned so all
    // presentation lives in the component stylesheets.
    files: ["src/designsystem/**/*.{ts,tsx}"],
    rules: {
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message:
                "Design-system presentation belongs in the component stylesheet; runtime-computed styles are exempted per file in eslint.config.js.",
            },
          ],
        },
      ],
    },
  },
  {
    // Sanctioned runtime-computed DOM style: the progress meter width.
    files: [
      "src/designsystem/primitives/progress.tsx",
      "src/designsystem/primitives/popover.tsx",
      "src/designsystem/patterns/cardDragPreview.tsx",
    ],
    rules: {
      "react/forbid-dom-props": "off",
    },
  },
  {
    // Sanctioned className outside the design system: the .sr-only utility
    // from src/designsystem/base.css for the announcement live region.
    files: ["src/app/screens/EditorScreen.tsx"],
    rules: {
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message:
                "Style with stylesheets and design tokens; runtime-computed styles belong in the files exempted in eslint.config.js.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    // These orchestration modules are intentionally cohesive; component and hook
    // extraction is enforced elsewhere by architecture and complexity checks.
    files: ["src/app/deck/chartsView.tsx", "src/app/editor/useDeckActions.ts"],
    rules: {
      "max-lines": [
        "error",
        { max: 420, skipBlankLines: true, skipComments: true },
      ],
    },
  },
);
