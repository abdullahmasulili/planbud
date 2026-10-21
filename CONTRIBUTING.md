# Develop Plan Bud

Use Node from `.nvmrc` and pnpm from `package.json`. Install with `pnpm install --frozen-lockfile`. Install new packages through `pnpm exec expo install <package>` and commit the resulting dependency/lock changes only when publication is authorized.

Read the product specification, engineering standards, and implementation plan linked in `docs/README.md`. Changes to behavior start with the requirement and a failing behavior test. Document callable contracts with meaningful JSDoc, use const-bound arrow functions and async/await, and keep native adapters outside presentation and domain logic.

Run `pnpm check` before handing off implementation. It checks formatting, lint, TypeScript, dependency boundaries, artifact portability, and Jest tests. A passing mocked test is not native verification; record Android runtime checks separately in `docs/engineering/verification.md`.

Start development with `pnpm start` or `pnpm android`. Native dependencies require a development build. Configure native behavior through Expo configuration and plugins, never by editing generated Android projects. Production features must work without the development server or network.

Never record a real recovery phrase, financial data, signing key, selected document-provider reference, or workstation path in fixtures, logs, screenshots, or reports. Use only labeled published cryptographic vectors for tests. Git operations follow the repository's existing identity and authorization rules.
