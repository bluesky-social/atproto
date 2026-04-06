'use strict'

// require.resolve fixes pnpm: plugin must resolve from workspace root, not Prettier's package dir.
module.exports = {
  trailingComma: 'all',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  plugins: [require.resolve('prettier-plugin-tailwindcss')],
  overrides: [
    {
      files: '*.hbs',
      options: {
        singleQuote: false,
      },
    },
    {
      files: ['.eslintrc'],
      options: {
        parser: 'json',
        trailingComma: 'none',
      },
    },
  ],
}
