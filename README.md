# Typescript Monorepo Example

This is a modern typescript monorepo example

The full write up on how this monorepo works is and how to set it up [here]()

## Package Breakdown 

1. `interfaces`
    Typescript only interface repo, no build step, no testing, no javascript support
2. `package-a`
    Package with build step, testing, dependance on `interfaces`, and with publish support for javascript.
    Uses `esbuild` for building -> more configurable, better for complex packages
3. `package-b`
    React package with build step, dependance on `package A`, and with publish support for javascript.
    Uses `vite` for building, perfect for frontend packages.
3. `package-c`
    Package with build step and publish support for javascript.
    Uses `tsup` for building -> zero config, better for simpler packages


Both `tsup` and `vite` are built upon `esbuild` so they are all insanely fast.


## Technologies

- Pnpm - more space efficent package manager
- Esbuild - blazing fast build tool
- Vite - Support for frontend ui packages
- Eslint
- Prettier
- Jest
- [Typescript Project Reference](https://www.typescriptlang.org/docs/handbook/project-references.html) - Incremental and composite typescript builds