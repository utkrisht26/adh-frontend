# ADH Console

React + TypeScript + Vite operator console for AgenticDatasetHarness.

## Development

Run the backend with `adh serve` on port 8000, then:

```sh
npm install --legacy-peer-deps
npm run dev
```

Vite proxies `/api` to the backend. `npm run build` produces `dist`, which the
sibling backend can serve from the same origin. `npm run lint` runs Oxlint.
The legacy peer option accommodates the existing lucide-react/React peer range.

## Job Spec Builder

`/spec` is the full contract-driven editor. `/discovery/new` and `/runs/:runId/edit`
reuse it. Features include:

- All Job Spec fields, nested source constraints, generation settings, and budgets.
- Record profiles for text, code, image, and video with compatible local schemas.
- Ajv validation against the server's JSON Schema, followed by server validation
  of cross-field rules and schema/verification requirements.
- YAML/JSON import, validated YAML export, and local browser draft save/restore.
- Validation and warning review before discovery or restart; saved settings are
  preserved when editing an existing run.

The backend serves `GET /api/specs/schema`, `POST /api/specs/validate`, and
`POST /api/specs/import`. Deployment model overrides are shown in the editor.
Relative schema paths refer to files on the backend server.

`npm run gen:api` refreshes the gateway contract snapshot in `openapi.json` and
regenerates `src/lib/api-types.ts` from the sibling backend. Do not hand-edit those types.

## Browser acceptance tests

The sibling backend owns browser tests that connect the built frontend to its real
API through TestClient, with offline discovery and crawl doubles. No external
service or model is called. From `AgenticDatasetHarness`:

```sh
ADH_FRONTEND_DIST=../adh-frontend/dist .venv/bin/pytest tests/test_spec_builder_browser.py -o addopts='' -q
```

Install Playwright Chromium first. Set `ADH_BROWSER_ARTIFACTS` to retain light/dark
screenshots at 320, 768, 1024, and 1440 pixels.
