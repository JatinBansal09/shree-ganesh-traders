import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    // ✅ Ignore backend, node_modules, and build folders
    ignores: [
      "dist/**",
      "node_modules/**",
      "backend/**",          // ✅ ignore all Django backend files
      "**/*.min.js",         // ✅ ignore minified files
    ]
  },
  {
    files: ["src/**/*.{js,jsx}"],  // ✅ only lint src folder
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react/react-in-jsx-scope":    "off",
      "react/prop-types":            "off",
      "no-unused-vars":              "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity":          "off",
      "react-hooks/rules-of-hooks":  "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": "warn",
      "no-dupe-keys":                "error",
    },
  },
];