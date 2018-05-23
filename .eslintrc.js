module.exports = {
  extends: ["eslint:recommended"],
  env: {
    es6: true,
    browser: true
  },
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module"
  },
  // globals: {
  // },
  rules: {
    "no-console": 0 // TODO: remove once stabler
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
