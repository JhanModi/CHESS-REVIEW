import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for TypeScript workspaces.
 * Apps extend this and add framework-specific plugins where needed.
 */
export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" }
      ]
    }
  },
  {
    ignores: ["dist/**", ".next/**", "generated/**", "coverage/**"]
  }
);
