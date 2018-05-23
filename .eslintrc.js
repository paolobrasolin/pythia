module.exports = {
  extends: ["eslint:recommended"],
  env: {
    es6: true
  },
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module"
  },
  globals: {
    document: true,
    console: true
  },
  rules: {
    "no-console": 1
  },
  overrides: [
    {
      files: ["**/*.test.js"],
      // Can't extend in overrides: https://github.com/eslint/eslint/issues/8813
      // "extends": ["plugin:jest/recommended"]
      env: {
        jest: true
      },
      plugins: ["jest"]
    }
  ]
};
