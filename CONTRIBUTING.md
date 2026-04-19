# Contributing to Orin / NaNoOrin

## Canonical branch and layout

- **Default integration branch:** `main`.
- **Product code** for the full stack (FastAPI + UI under `orin-ai/`) is expected in this repository under [`orin-ai/`](orin-ai/) — see the root [README.md](README.md).
- **Do not maintain two incompatible repository roots** (for example a root-level app tree vs `orin-ai/` only) on long-lived branches without a written migration plan. That pattern causes **modify/delete** merge conflicts and “where is the API?” confusion.
- A historical branch such as **`Master`** may use a **different layout**. Before merging, align with `main` or document an explicit merge strategy in the PR description.

## Git workflow

- **Feature branches:** branch from `main`, open a PR back to `main`.
- **Pull / integrate:** many teams prefer a linear history:
  - `git config pull.rebase true` (or pass `git pull --rebase`) when updating your branch from `main`.
- **Merge vs rebase:** either is acceptable; **avoid mixing unrelated layouts** in one PR.

### Resolving modify/delete conflicts

When Git reports **CONFLICT (modify/delete)** (one side deleted a file, the other changed it):

1. Decide whether the file **belongs in the canonical layout** (see [README.md](README.md)).
2. If the file was **removed on purpose** in the target branch, usually: `git rm <path>` and continue.
3. If you need the **modified content**, restore the file from the other side, then resolve normally.
4. Document the choice in the PR so reviewers understand.

### Branch protection (recommended on GitHub)

- Require **CI** (see [.github/workflows/ci.yml](.github/workflows/ci.yml)) to pass before merge.
- Optionally require **one approval** for `main`.

## Local checks (match CI)

Backend:

```bash
cd orin-ai/backend
pip install -r requirements.txt
export ORIN_SKIP_STARTUP_VALIDATION=1
pytest -q
```

Frontend:

```bash
cd orin-ai/frontend
npm ci
npm run lint
npm run build
```

Docker Compose file validation:

```bash
docker compose -f orin-ai/docker-compose.yml config -q
```

## Environment variables

See [`orin-ai/.env.example`](orin-ai/.env.example) for **required vs optional** keys, **development vs production** notes, and **`ORIN_SKIP_STARTUP_VALIDATION`**.

- **Production** should run **without** skipping startup validation unless you have a documented exception.
- Point load balancers or orchestrators at **`GET /health`** on the API.

## Tooling troubleshooting

### `npm warn Unknown env config "devdir"`

This comes from a user-level **npm** config (`~/.npmrc` or project `.npmrc`), not from this repo. Remove or fix the invalid `devdir` entry:

```bash
npm config delete devdir
# or edit ~/.npmrc
```

### `npm audit`

Security advisories are expected to change over time. The CI workflow does **not** fail the build on every advisory by default. Periodically run `npm audit` locally or enable **Dependabot** / Renovate on the repository if you want automated PRs for dependency updates.

## API contract

- Backend models and routes live under [`orin-ai/backend/models.py`](orin-ai/backend/models.py) and [`orin-ai/backend/main.py`](orin-ai/backend/main.py).
- Contract tests in [`orin-ai/backend/tests/test_api_contract.py`](orin-ai/backend/tests/test_api_contract.py) guard basic HTTP shapes and `AgentEvent` serialization. Extend them when changing response fields or SSE payloads.

## Optional follow-ups

- **Dependabot** for `npm` and `pip` (enable in repository settings).
- **End-to-end tests** (Playwright, etc.) against a deployed stack — add after CI is stable.
