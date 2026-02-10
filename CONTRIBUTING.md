# Contributing to flumen.dev

Thanks for your interest in contributing! ❤️ This guide covers local setup, scripts, and CI checks.

## Requirements

- Node 24+
- pnpm 10+

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a local environment file:

```bash
copy .env.example .env
```

3. Configure GitHub OAuth in `.env`:

```dotenv
NUXT_OAUTH_GITHUB_CLIENT_ID=
NUXT_OAUTH_GITHUB_CLIENT_SECRET=
NUXT_SESSION_PASSWORD=
```

4. Create a GitHub OAuth app and copy the credentials:

- GitHub settings: https://github.com/settings/developers
- Create an OAuth app with:
  - Homepage URL: `http://localhost:3000`
  - Authorization callback URL: `http://localhost:3000/auth/github`
- Copy the client ID and secret into `.env`
- Set `NUXT_SESSION_PASSWORD` to a long random string

For details, see GitHub's docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app

5. Start the dev server:

```bash
pnpm dev
```

## Common commands

```bash
# Development
pnpm dev

# Lint and type checks
pnpm lint
pnpm test:types

# Tests
pnpm test
pnpm test:watch
pnpm test:unit
pnpm test:nuxt
pnpm test:coverage

# Unused code checks
pnpm knip
pnpm knip:fix

# i18n validation
pnpm i18n:report
pnpm i18n:report:fix
# updating i18n/schema.ts
pnpm i18n:schema

# Build and preview
pnpm build
pnpm preview
```

## CI checks (parity)

CI runs these checks on every PR and push to `main`:

- `pnpm lint`
- `pnpm test:types`
- `pnpm test:unit`
- `pnpm test:nuxt`
- `pnpm knip` and `pnpm knip --production`
- `pnpm i18n:report`
- `pnpm i18n:schema` (must keep `i18n/schema.json` updated)
- `pnpm audit`
- `pnpm build`

## Contribution workflow

- Open an issue or discussion if you want to propose larger changes.
- Keep changes focused and include tests when it makes sense.
- Ensure the CI checks above pass before requesting review.
