# Frontier Model Explorer

A Next.js app for exploring and comparing frontier LLMs from the [Artificial Analysis](https://artificialanalysis.ai/) catalog, with Hugging Face Hub enrichment and GPU/TPU serving guides for open-weight models.

The catalog is fetched from the Artificial Analysis Data API and cached as a **Vercel Blob** snapshot. Hub metadata, reports, and guides live in **separate private blobs** so they can be refreshed independently. LLM features (chat, reports, guides) use **Gemini 3.5 Flash**.

| | |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, Base UI / shadcn, lucide-react |
| Data | Artificial Analysis API + Hugging Face Hub API |
| Storage | `@vercel/blob` (private objects) |
| LLM | `@ai-sdk/google` (`gemini-3.5-flash`) |
| Package manager | pnpm |

---

## Features

The header shows catalog sync time, Hub refresh time, a language switcher, **Sync now**, and **Refresh details**. If no snapshot exists, the app shows an empty state and a sync prompt.

Tabs are shareable via `tab=`. The default tab is the mind map.

### Mind map (no `tab`, or `tab=mindmap`)

A three-step drill-down. On desktop, groups → models → detail sit in a horizontal column layout. On mobile, each step is a full screen.

1. **Groups** — change the axis with `by=`.
   | `by` | Meaning | Buckets |
   |------|---------|---------|
   | `provider` (default) | Creator | one group per slug |
   | `intelligence` | Intelligence Index | 60 / 50 / 40 / 30 / 20 / 10 / 0+ |
   | `price` | Blended $/1M tokens | $50 / $15 / $5 / $2 / $0.5 / $0+ |
   | `speed` | Output tok/s | 600 / 300 / 150 / 75 / 0+ |
   | `release` | Release date | UTC year–quarter (`2026-Q1`, …) |
2. **Model list** — models inside the selected group, ordered by `sort=`.
3. **Detail** — AA scores, price, speed, named benchmarks, Hub size / dtype / min VRAM, and **Compute resources** (guide generation) for open-weight models.

The **filter bar appears only on the mind map tab**. Compare, Report, and Guides stay uncluttered. On small screens, filter chips collapse into a **Filters** dialog; group-by and sort become one-row selects and hide once you drill into a group or model.

### Compare (`tab=compare`)

Compare up to **four** models side by side. IDs live in `models=` as a comma-separated list. “Add to compare” on a mind-map detail panel switches to this tab. The picker uses the full catalog and is independent of mind-map filters.

### Report (`tab=report`)

Gemini writes a briefing over the entire synced snapshot (Pareto price/intelligence, top models, open-weight share, and so on). Generation requires `SYNC_PASSWORD`. Only one report is stored (`latest.json`). The UI can download Markdown or PDF.

### Guides (`tab=guides`, `guideModel=`)

Guides can be generated only for **open-weight** models that have **usable Hub details**. Generation needs the sync password and Gemini; **GET is public**. The prompt uses stored Hub + AA numbers only — it does not call Hugging Face or Artificial Analysis at generate time.

The executive table must include **GPU budget**, **GPU production**, **TPU budget**, and **TPU production** rows. TPU sections follow [AI-Hypercomputer/tpu-recipes](https://github.com/AI-Hypercomputer/tpu-recipes) (XLA compile/cache, topologies, vLLM-TPU flags, recipe-style benches). The model must not invent a GA “TPU v8” SKU.

Existing blob guides do not pick up prompt changes until you **regenerate**.

### Agent chat

A floating action button in the corner. The model may answer only from the catalog JSON and must not invent models or numbers missing from the snapshot. **Off by default.** The FAB and `POST /api/agent` exist only when `AGENT_ENABLED=true` and a Gemini key is set. There is no password; traffic is capped at **30 requests per minute per IP** (in-memory, per instance).

---

## Shareable URL state

`useQueryState` updates search params with `router.push`. Refresh, back, and shared links keep the same view.

| Param | Tab | Values |
|-------|-----|--------|
| `tab` | global | `compare` \| `report` \| `guides` (omit for mind map) |
| `by` | mind map | `provider` \| `intelligence` \| `price` \| `speed` \| `release` |
| `sort` | mind map | sort keys below. Default `intelligence-desc` is omitted from the URL |
| `group` | mind map | group id |
| `model` | mind map | model id |
| `providers` | mind-map filters | provider slug CSV |
| `open` | mind-map filters | `1` open / `0` proprietary |
| `purpose` | mind-map filters | `coding,reasoning,math,cheap,fast` CSV |
| `models` | Compare | model id CSV (max 4) |
| `guideModel` | Guides | model id of the open guide |

**Sort keys:** `intelligence-desc` (default), `intelligence-asc`, `release-desc`, `release-asc`, `price-asc`, `price-desc`, `speed-desc`, `speed-asc`, `name-asc`. Missing values sort last.

**Purpose cutoffs** are absolute (not percentiles), so a shared URL means the same thing after a resync:

| `purpose` | Rule |
|-----------|------|
| `coding` | Coding Index ≥ 40, or else LiveCodeBench / SciCode / Terminal-Bench present |
| `reasoning` | Intelligence Index ≥ 40 |
| `math` | Math Index ≥ 70 |
| `cheap` | blended $/1M < 2 |
| `fast` | output ≥ 150 tok/s |

**Open vs proprietary** is a **heuristic**. The AA v2 models catalog has no license field. Known open-weight creators (Meta, Mistral, DeepSeek, Qwen, …) plus name patterns such as Gemma / gpt-oss count as open. Closed labs (OpenAI, Anthropic, Gemini, xAI, …) stay proprietary unless the name matches an open family. This is independent of Hub `gated`.

---

## Data pipeline

```
Artificial Analysis API          Hugging Face Hub API
        │                                  │
        ▼                                  ▼
  normalizeModels()              resolveHfMapping() + expand
        │                                  │
        ▼                                  ▼
frontier-models/                 frontier-models/hub/latest.json
  latest-snapshot.json           (open-weight only, 12h freshness)
        │                                  │
        └──────────┬───────────────────────┘
                   ▼
            page SSR (parallel reads)
                   │
     ┌─────────────┼──────────────┐
     ▼             ▼              ▼
  Mind map     Report / guides    Agent prompt
               (Gemini + Blob)
```

### Artificial Analysis snapshot

- `GET https://artificialanalysis.ai/api/v2/data/llms/models` (`x-api-key`)
- Zod validates the raw payload; `lib/aa/normalize.ts` maps it to `ModelNode`.
- Blob path: `frontier-models/latest-snapshot.json` (`access: "private"`).
- Fields include Intelligence / Coding / Math indexes; MMLU-Pro, GPQA, HLE, LiveCodeBench, SciCode, MATH-500, AIME, IFBench, Terminal-Bench, Tau²; input / output / blended price; output tok/s; TTFT.

### Hugging Face Hub (independent refresh)

A **different button and blob** from AA sync. Only models classified as open-weight are fetched.

1. Slug / name → HF id (`lib/aa/hf-resolve.ts`: exact map, heuristics, Hub search).
2. `GET /api/models/{id}` with **repeated** `expand` query params (`safetensors`, `cardData`, `siblings`, `usedStorage`, `gated`, `tags`, `pipeline_tag`). A single comma-separated `expand` value returns HTTP 400.
3. Size (safetensors sum → GGUF → `usedStorage`), primary dtype, parameter count.
4. VRAM estimate: weights + **~20% overhead**, FP16 / INT8 / INT4, native dtype, KV cache at 4k context, batch 1, FP16.
5. Concurrency 4; timeouts 12s (model) / 6s (config) / 8s (search). Details newer than 12 hours are skipped.
6. Gated models are retried when `HF_TOKEN` is set.

Status codes: `unmapped` | `gated` | `not_found` | `timeout` | `rate_limited` | `fetch_failed`.

### Report and guide blobs

| Path | Contents |
|------|----------|
| `frontier-models/reports/latest.json` | Single catalog briefing |
| `frontier-models/guides/index.json` | model id → generatedAt, name |
| `frontier-models/guides/{safeId}.json` | Per-model guide (unsafe id chars become `_`) |

Guide generation uses **stored Hub details only**. It refuses `unmapped` / `not_found` / `timeout` and similar blocking errors.

---

## APIs and server actions

Password-gated writes all go through `requireSyncPassword` (`timingSafeEqual`). Missing password → `503 SYNC_PASSWORD_NOT_CONFIGURED`. Wrong password → `401 INVALID_SYNC_PASSWORD`.

| Endpoint | Auth | Role |
|----------|------|------|
| `syncModels(password)` server action | password | AA fetch → Blob → `revalidatePath("/")` |
| `syncHubDetails(password, modelId?)` | password | Full Hub refresh or one model |
| `POST /api/hub` | password | Hub refresh (`maxDuration` 300s) |
| `GET /api/report` | none | Stored report |
| `POST /api/report` | password + Gemini | Generate report (120s) |
| `GET /api/guide?modelId=` | none | Index + optional guide |
| `POST /api/guide` | password + Gemini | Open-weight + usable Hub required (120s) |
| `POST /api/agent` | **none** (flag) | Streaming catalog Q&A. Requires `AGENT_ENABLED=true`. 30 req/min/IP |

Sync errors returned to the client are **codes only** (`AA_API_NOT_CONFIGURED`, `AA_API_HTTP_*`, `SYNC_FAILED`). Upstream response bodies are not exposed.

The agent keeps the last 16 messages and compact catalog JSON up to ~280k characters. If that budget is exceeded, per-model benchmark field `b` is dropped so every model still fits.

---

## i18n

Locales: **`ko` (default)** · `en` · `ja` · `zh`.

1. Cookie `fme-locale`
2. Else `Accept-Language`
3. Else `ko`

The header switcher writes the cookie. Document `lang`, meta title/description, UI copy, and Gemini reply language all follow this locale. Strings live in `lib/i18n/messages.ts`.

---

## Local development

```bash
pnpm install
cp .env.example .env.local
# fill in .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) → **Sync now** (password) → optionally **Refresh details**.

To enable the agent, set `AGENT_ENABLED=true` and `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`, then restart the server.

---

## Environment variables

Secrets are **server-only**. There are no `NEXT_PUBLIC_*` API keys. Use `.env.local` locally and the host’s encrypted env (e.g. Vercel) in production.

| Variable | When required | Purpose |
|----------|---------------|---------|
| `ARTIFICIALANALYSIS_API_KEY` | Sync | AA Data API |
| `BLOB_READ_WRITE_TOKEN` | Sync / Hub / report / guide | Private blob read/write |
| `SYNC_PASSWORD` | All writes | Long random string; never sent to the client as config |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Report, guides, optional agent | Gemini |
| `HF_TOKEN` | Optional | Gated HF models (`HUGGING_FACE_HUB_TOKEN` is also accepted) |
| `AGENT_ENABLED` | Optional | Chat only when `true`. **Off by default** |

---

## Deploy (Vercel)

1. Attach Blob storage and set the variables above.
2. After deploy, run **Sync now** once so `latest-snapshot.json` exists.
3. Refresh Hub details for open-weight models.
4. Decide whether a public site should expose chat (`AGENT_ENABLED`).

Vercel Analytics is enabled when `NODE_ENV === "production"`.

`typescript.ignoreBuildErrors` in `next.config.mjs` is a v0-era compatibility flag. Prefer turning it off for long-term production.

---

## Security (public GitHub repo and public site)

Publishing **source** is fine if real keys never enter git. `.gitignore` covers `.env` and `.env*.local`. Commit only [`.env.example`](.env.example).

**What the code already does**

- Keys and passwords are read from `process.env` only.
- Sync / Hub / report / guide writes require `SYNC_PASSWORD` with constant-time compare.
- Blobs use `access: "private"`.
- Sync failures return codes, not upstream bodies.
- Response headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- Agent is off by default and rate-limited by IP.

**Residual risk after you deploy a public site**

| Risk | Mitigation |
|------|------------|
| Anyone hitting `/api/agent` spends Gemini quota | `AGENT_ENABLED` defaults off. When on: open chat + 30 req/min/IP per instance |
| Brute-forcing `SYNC_PASSWORD` | Use 32+ random characters; add a WAF or IP allowlist if needed |
| Leaked `BLOB_READ_WRITE_TOKEN` | Treat as write access to your store; rotate in Vercel |
| Forks running their own instance | They must supply their own keys; none ship in this repo |

`GET /api/report` and `GET /api/guide` return stored documents. Do not put confidential internal runbooks in those blobs.

---

## Project layout

```
app/
  page.tsx                 # SSR: parallel snapshot + Hub reads; agent gated
  actions/sync.ts          # AA sync / snapshot read
  actions/hub.ts           # Hub refresh / Hub snapshot read
  api/agent|report|guide|hub/
components/
  explorer/                # header, tabs, filters, sync, language
  mindmap/                 # group/model columns, detail, Hub, sort
  compare/  report/  guide/  agent/
hooks/use-query-state.ts   # shareable URL state
lib/aa/
  client.ts                # AA HTTP
  normalize.ts / types.ts  # Zod + ModelNode / Hub / Guide
  snapshot.ts / hub-snapshot.ts
  filter.ts / sort.ts / group-by.ts
  hub.ts / hf-resolve.ts   # Hub mapping and VRAM
  guide.ts / report.ts     # Gemini prompts + blobs
  protect.ts / env.ts / rate-limit.ts
lib/i18n/                  # locales, messages, cookie + Accept-Language
```

---

## Data attribution and license

Benchmarks, prices, and API speed come from the **Artificial Analysis** snapshot. Size, dtype, and VRAM estimates come from **Hugging Face Hub** and are cached separately. Model weights and licenses remain under their providers’ terms. Catalog API tok/s and TTFT are **not** local-cluster SLOs (the guide prompt states this explicitly).

See the repository LICENSE for this project’s source code.
