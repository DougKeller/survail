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
      "import/no-unresolved": ["error", { ignore: ["\\.css$"] }],
      "import/order": [
        "error",
        {
          alphabetize: {
            caseInsensitive: true,
            order: "asc",
          },
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "type",
          ],
          "newlines-between": "always",
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
    files: ["src/main.tsx", "src/CardPresentation.tsx"],
    rules: {
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["src/main.tsx"],
    rules: {
      "promise/always-return": "off",
      "react-hooks/exhaustive-deps": "off",
      "sonarjs/cognitive-complexity": "off",
      "jsx-a11y/no-noninteractive-tabindex": "off",
    },
  },
);
