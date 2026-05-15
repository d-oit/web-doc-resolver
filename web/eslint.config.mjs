import js from "@eslint/js";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import playwrightPlugin from "eslint-plugin-playwright";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [".next/*", "node_modules/*", "dist/*", ".vercel/output/**", "playwright-report/**", "test-results/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooksPlugin,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...tsPlugin.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off", // Relax for this task
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",

      // 2026 Standard: Prohibit Date.now() in favor of performance.now() for client-side timing
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Use performance.now() instead of Date.now() for 2026 performance and consistency standards.",
        },
        // 2026 Standard: Prohibit synchronous setState inside useEffect to prevent redundant renders
        {
          selector: "CallExpression[callee.name='useEffect'] > ArrowFunctionExpression > BlockStatement > ExpressionStatement > CallExpression[callee.name=/^set[A-Z]/]",
          message: "Synchronous setState inside useEffect is prohibited. Use asynchronous synchronization or move logic outside the effect.",
        },
        {
          selector: "CallExpression[callee.name='useEffect'] > FunctionExpression > BlockStatement > ExpressionStatement > CallExpression[callee.name=/^set[A-Z]/]",
          message: "Synchronous setState inside useEffect is prohibited. Use asynchronous synchronization or move logic outside the effect.",
        }
      ],
    },
  },
  {
    // Vitest unit tests - not Playwright
    files: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    ignores: ["tests/e2e/**"],
    languageOptions: {
      globals: {
        // Vitest globals
        ...globals.vitest,
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
      },
    },
    rules: {
      "no-restricted-syntax": "off",
    }
  },
  {
    // Playwright e2e tests
    files: ["tests/e2e/**/*.test.ts", "tests/e2e/**/*.spec.ts"],
    plugins: {
      playwright: playwrightPlugin,
    },
    languageOptions: {
      globals: {
        // Playwright test globals
        ...globals.playwright,
        test: "readonly",
        expect: "readonly",
        describe: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        page: "readonly",
        browser: "readonly",
        context: "readonly",
        locator: "readonly",
      },
    },
    rules: {
      ...playwrightPlugin.configs.recommended.rules,
      "no-restricted-syntax": "off",
      // Warnings for test style issues (can be fixed over time)
      "playwright/no-skipped-test": "warn",
      "playwright/no-focused-test": "error",
      "playwright/no-standalone-expect": "off",
      "playwright/no-networkidle": "warn",
      "playwright/no-useless-not": "warn",
      "playwright/no-wait-for-selector": "warn",
      "playwright/no-wait-for-timeout": "warn",
      "playwright/no-force-option": "warn",
      "playwright/prefer-locator": "warn",
      "playwright/prefer-web-first-assertions": "warn",
    }
  },
  {
    files: ["app/api/**/*.ts", "lib/resolvers/*.ts", "lib/circuit-breaker.ts", "lib/rate-limit.ts", "lib/ui-state.ts", "lib/cache.ts", "lib/records.ts"],
    rules: {
      "no-restricted-syntax": "off",
    }
  },
  {
    files: ["eslint.config.mjs"],
    rules: {
      "no-unused-vars": "off"
    }
  }
];
