import { BlobNotFoundError, del, get, put } from "@vercel/blob"
import { DEFAULT_LOCALE, LANGUAGE_NAMES, parseLocale, type Locale } from "@/lib/i18n/locales"
import { type ServingPlan } from "./sizing"
import type { GuideHardwareContext, GuideIndex, HubDetail, ModelGuide, ModelNode } from "./types"

export { hasUsableHubDetail } from "./hub-ready"

/** Layout before guides were stored per locale, kept only so old guides can be migrated. */
const LEGACY_GUIDE_INDEX_PATHNAME = "frontier-models/guides/index.json"

export const GUIDE_MODEL_ID = "gemini-3.5-flash"

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function modelSlug(modelId: string): string {
  return modelId.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export function guideBlobPath(locale: Locale, modelId: string): string {
  return `frontier-models/guides/${locale}/${modelSlug(modelId)}.json`
}

export function guideIndexPathname(locale: Locale): string {
  return `frontier-models/guides/${locale}/index.json`
}

export function buildHardwareContext(model: ModelNode, detail: HubDetail): GuideHardwareContext {
  const benches: Record<string, number> = {}
  for (const [key, value] of Object.entries(model.benchmarks)) {
    if (typeof value === "number") benches[key] = round(value, 3)
  }

  const ctx: GuideHardwareContext = {
    modelId: model.id,
    modelName: model.name,
    provider: model.provider.name,
  }
  if (model.releaseDate) ctx.releaseDate = model.releaseDate
  if (detail.hfId) ctx.hfId = detail.hfId
  if (detail.license) ctx.license = detail.license
  if (detail.gated != null) ctx.gated = detail.gated
  if (detail.parameterCount != null) ctx.parameterCount = detail.parameterCount
  if (detail.modelSizeBytes != null) ctx.modelSizeGb = round(detail.modelSizeBytes / 1e9, 2)
  if (detail.modelSizeSource) ctx.modelSizeSource = detail.modelSizeSource
  if (detail.primaryDtype) ctx.primaryDtype = detail.primaryDtype
  if (detail.pipelineTag) ctx.pipelineTag = detail.pipelineTag
  if (detail.vramEstimate) ctx.vramGb = detail.vramEstimate
  if (model.intelligenceIndex != null) ctx.intelligenceIndex = round(model.intelligenceIndex, 1)
  if (model.codingIndex != null) ctx.codingIndex = round(model.codingIndex, 1)
  if (model.mathIndex != null) ctx.mathIndex = round(model.mathIndex, 1)
  if (Object.keys(benches).length > 0) ctx.benchmarks = benches
  return ctx
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isModelGuide(value: unknown): value is ModelGuide {
  if (!isRecord(value)) return false
  return (
    typeof value.generatedAt === "string" &&
    typeof value.locale === "string" &&
    typeof value.modelId === "string" &&
    typeof value.modelName === "string" &&
    typeof value.markdown === "string" &&
    typeof value.geminiModel === "string" &&
    isRecord(value.hardwareContext)
  )
}

function isGuideIndex(value: unknown): value is GuideIndex {
  if (!isRecord(value)) return false
  for (const entry of Object.values(value)) {
    if (!isRecord(entry) || typeof entry.generatedAt !== "string" || typeof entry.modelName !== "string") {
      return false
    }
  }
  return true
}

async function readJsonBlob(pathname: string): Promise<unknown | null> {
  try {
    const result = await get(pathname, { access: "private" })
    if (!result) return null
    const text = await new Response(result.stream).text()
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null
    console.error("Failed to read guide blob:", pathname, error)
    return null
  }
}

async function writeJsonBlob(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

/**
 * Guides once shared one blob per model, so regenerating in another language
 * silently overwrote the previous version. Re-files each old guide under the
 * locale it was actually written in, then drops the legacy index so this runs
 * at most once. Writes are idempotent, so overlapping requests are harmless.
 */
async function migrateLegacyGuides(): Promise<void> {
  const legacyIndex = await readJsonBlob(LEGACY_GUIDE_INDEX_PATHNAME)
  if (!isGuideIndex(legacyIndex)) return

  for (const modelId of Object.keys(legacyIndex)) {
    const legacyPath = `frontier-models/guides/${modelSlug(modelId)}.json`
    const parsed = await readJsonBlob(legacyPath)
    if (!isModelGuide(parsed) || !parseLocale(parsed.locale)) continue
    await writeGuide(parsed)
    await del(legacyPath).catch(() => undefined)
  }

  await del(LEGACY_GUIDE_INDEX_PATHNAME).catch(() => undefined)
}

export async function readGuideIndex(locale: Locale): Promise<GuideIndex> {
  const parsed = await readJsonBlob(guideIndexPathname(locale))
  if (isGuideIndex(parsed)) return parsed

  await migrateLegacyGuides()
  const migrated = await readJsonBlob(guideIndexPathname(locale))
  return isGuideIndex(migrated) ? migrated : {}
}

export async function readGuide(locale: Locale, modelId: string): Promise<ModelGuide | null> {
  const parsed = await readJsonBlob(guideBlobPath(locale, modelId))
  return isModelGuide(parsed) ? parsed : null
}

export async function writeGuide(guide: ModelGuide): Promise<ModelGuide> {
  const locale = parseLocale(guide.locale) ?? DEFAULT_LOCALE
  await writeJsonBlob(guideBlobPath(locale, guide.modelId), guide)

  const indexPath = guideIndexPathname(locale)
  const existing = await readJsonBlob(indexPath)
  const index: GuideIndex = isGuideIndex(existing) ? existing : {}
  index[guide.modelId] = {
    generatedAt: guide.generatedAt,
    modelName: guide.modelName,
    hfId: guide.hfId,
  }
  await writeJsonBlob(indexPath, index)
  return guide
}

/**
 * Factual accelerator sketch for Gemini. Real TPU product line — not "TPU v1–v8" SKUs.
 * Memory figures are typical advertised HBM; treat as planning estimates.
 */
const HARDWARE_PACK = `
Accelerator knowledge pack (planning estimates, not a capacity guarantee):

NVIDIA GPUs (HBM, typical):
- RTX 4090 24GB / RTX 5090 32GB — single-workstation, NVLink-less consumer.
- L40S 48GB — datacenter inference, PCIe.
- A100 80GB HBM2e — NVLink HGX 8-GPU nodes still common.
- H100 SXM 80GB HBM3 — NVLink 4, HGX 8.
- H200 141GB HBM3e — drop-in H100-class node with more KV headroom.
- B200 / GB200 Blackwell ~180–192GB — NVL72 rack scale for large MoE / long context.
- AMD MI300X 192GB HBM3 — 8-GPU nodes, ROCm + vLLM.

Google TPU (map informal “TPU v1–v8” to this real line; there is no GA TPU v8 SKU — never invent one):
- TPU v1: first Cloud TPU (2018). Not a modern LLM-serving target.
- TPU v2: ~16 GiB HBM2/chip, 2D torus, 256-chip pods. Legacy.
- TPU v3: ~32 GiB HBM2/chip, 2D torus, 1024-chip pods. Legacy.
- TPU v4: 32 GiB HBM2/chip, ~1200 GB/s, 3D mesh/torus, 4096-chip pods. 2 TensorCores/chip; v4-8 = 4 chips (2x2x1). Cubes 4x4x4 = 64 chips.
- TPU v5e: 16 GB HBM/chip, 2D torus, 256-chip pods. VMs 1/4/8 chips (ct5lp-hightpu-1t/4t/8t). Single-host serve up to 8 chips.
- TPU v5p: 95 GiB HBM/chip, ~2765 GB/s, 3D torus, 8960-chip pods. 4-chip VM ct5p-hightpu-4t.
- TPU v6e (Trillium): 32 GiB HBM/chip, ~1638 GB/s, 2D torus, 256-chip pods. VMs ct6e-standard-1t/4t/8t.
- Ironwood / TPU7x (7th gen): 192 GiB HBM3E/chip, ~7.37 TB/s, 3D torus, up to 9216-chip superpods (also 256-chip configs).
Prefer v4 / v5e / v5p / v6e / Ironwood. If a chip's HBM is below native min GPU memory, say the SKU is too small unless quantized + sharded.

Orchestration: Kubernetes (GPU operator / GKE with GPU or TPU), Slurm for research, Ray Serve for replica autoscaling. For TPU prefer GKE TPU slices or TPU VM queued resources.

Frameworks:
- GPU: vLLM (PagedAttention, prefix cache, FP8), SGLang, TensorRT-LLM, TGI. Hugging Face id in hardware JSON is the serve target.
- TPU: vLLM TPU via tpu-inference (JAX→XLA for PyTorch and JAX), JAX MaxText / Pax / JetStream. CUDA graphs and nvidia-smi do not apply; use XLA compile + Cloud TPU profiler.

3D parallelism (match interconnect):
- Tensor parallel (TP) within a node (NVLink / TPU ICI). Typical TP = GPUs per node if the shard fits.
- Pipeline parallel (PP) across nodes when layers exceed one node.
- Data parallel / replicas for throughput.
- Expert parallel for MoE if the architecture is MoE (only if tags/name suggest it; otherwise say dense).
Give concrete TP/PP/DP numbers that fit the estimated min VRAM and weight size.

KV cache / long-context:
- PagedAttention, prefix/session cache, KV FP8/INT8, chunked prefill.
- If kvCache4k (GB, batch 1, FP16) is present, scale linearly with context/4096 and batch.
- Prefill/decode disaggregation for long-context reasoning when context >> 4k.

TPU recipes + XLA (source of record for TPU serving methodology: https://github.com/AI-Hypercomputer/tpu-recipes — recipes reproduce throughput, they do NOT publish confidential scoreboards; never invent tok/s from that repo):
- Layout: inference/{v5e,trillium=v6e,ironwood=TPU7x}/vLLM plus training/ and microbenchmarks/ (matmul, HBM, ICI collectives). Prefer vLLM TPU via tpu-inference (JAX→XLA lowering for PyTorch and JAX). Image family vllm/vllm-tpu (pin a tag in examples). GCE TPU VMs or GKE; production clusters: Cluster Toolkit. Capacity: Queued Resources when on-demand is scarce.
- Topologies from recipes: Trillium v6e 1x1 (1 chip, ~8B), 2x2 (4 chips, ~32B), 2x4 (8 chips, ~70B); runtime v2-alpha-tpuv6e. Ironwood GKE nodeSelector cloud.google.com/gke-tpu-accelerator=tpu7x, topology 2x2x1 (4 chips), machine tpu7x-standard-4t. Single-host: set tensor-parallel-size to the chip count — do not set TP below chips on one host.
- XLA is a static-shape compiler. First vLLM TPU start pre-compiles graphs per (batch, seq) bucket — minutes to ~1 hour. Cache at VLLM_XLA_CACHE_PATH (default ~/.cache/vllm/xla_cache). Put the cache on shared PVC/GCS so scaled replicas skip compile. If many replicas write the cache at once, filesystem errors occur: bring up replica 1 first, then scale, or give later replicas read-only cache.
- Shape/padding knobs: VLLM_TPU_MOST_MODEL_LEN when most traffic is shorter than max-model-len; VLLM_TPU_BUCKET_PADDING_GAP in 128-token steps (128, 256, …) for online latency. VLLM_USE_V1=1 in Trillium recipes. VLLM_ENGINE_READY_TIMEOUT_S high (e.g. 1800) because compile is slow. Quantized matmul: LIBTPU_INIT_ARGS may include --xla_jf_conv_input_fusion=False. v5e/v6e MXU has int4/int8 acceleration.
- Serve flags seen in tpu-recipes (adapt to THIS model's size; do not copy their throughput numbers): --gpu-memory-utilization 0.9–0.98; --max-num-batched-tokens 512 decode-heavy vs 1024–2048+ prefill-heavy (Ironwood Gemma used 16384); --max-num-seqs 128–256; --async-scheduling; some recipes --no-enable-prefix-caching; --kv-cache-dtype fp8 and --block-size 256 on Ironwood; Docker --privileged --net=host --shm-size large (weights often HF_HOME=/dev/shm).
- Measure like the recipes: vllm bench serve --dataset-name random; prefill-heavy ~1800/128 vs decode-heavy ~1000/1000; concurrency 64 vs 128 (higher concurrency raises throughput and TTFT P99). Ironwood GKE benches also use 1k/500, 1k/8k, 8k/1k sweeps. Microbenchmarks (GEMM, HBM, collectives) diagnose ICI vs memory bound. Cloud TPU profiler / XLA dump after compile, not nvidia-smi.
`.trim()

export function buildGuidePrompt({
  context,
  locale,
  sizing,
}: {
  context: GuideHardwareContext
  locale: Locale
  sizing: ServingPlan
}): { system: string; prompt: string } {
  const tpuRequired = sizing.tpuJustified
  const system = [
    "You are a serving/infrastructure architect for Frontier Model Explorer.",
    "Write a practical runbook for THIS open-weight model only.",
    "Use ONLY the hardware JSON and the precomputed serving plan below for model size, dtype, VRAM, SKU counts, monthly cost, and serve commands.",
    "Do not invent parameter counts, file sizes, GPU/TPU counts, topologies, or dollar figures. Copy SKU names, counts, monthlyUsd, and serve commands verbatim from the serving plan.",
    "VRAM figures are estimates (weights + ~20% overhead, plus KV when kvCache4k is present). Never claim a specific SKU 'will run' — say 'planning fit'.",
    tpuRequired
      ? "The serving plan sets tpuJustified=true, so include a TPU path next to GPU."
      : "The serving plan sets tpuJustified=false: this model fits a small GPU layout. Do NOT recommend TPU as a default. Mention TPU only as an optional scale-out, or omit it.",
    "Catalog intelligence/coding scores are quality references, NOT cluster SLOs. There is no API tok/s in the hardware JSON; do not invent local throughput.",
    HARDWARE_PACK,
    `Write the entire guide in ${LANGUAGE_NAMES[locale]}. Translate section titles.`,
    "Prefer tables and numbered steps. About 800–1300 words. Do not wrap the document in a code fence.",
    "Hardware JSON:",
    JSON.stringify(context),
    "Precomputed serving plan (the only source for SKUs, device counts, monthly cost, and serve commands):",
    JSON.stringify(sizing),
  ].join("\n")

  const tpuSections = tpuRequired
    ? [
        "4. H2 TPU path — use the TPU row from the serving plan (real gens: v5e / v6e Trillium / v5p / Ironwood TPU7x). Include H3 XLA tuning: static shapes, first-compile warmup, VLLM_XLA_CACHE_PATH, replica cache-write race, VLLM_TPU_MOST_MODEL_LEN, VLLM_TPU_BUCKET_PADDING_GAP (128). Link https://github.com/AI-Hypercomputer/tpu-recipes. Never recommend TPU v1 or a fictional TPU v8.",
        "5. H2 Framework — paste the GPU serveCommand from the plan in a fenced shell block. If tpuServeCommand is present, paste it too. Gated weights: HF token. Do not invent flags that contradict the plan.",
      ]
    : [
        "4. H2 TPU path — one short paragraph: TPU is not the default for this size. Name the GPU fit. Optional: the TPU row in the plan if you mention scale-out.",
        "5. H2 Framework — paste the GPU serveCommand from the plan in a fenced shell block. Gated weights: HF token.",
      ]

  const prompt = [
    "Write GitHub-flavored markdown with this section order (titles translated). Do not wrap the document in a code fence.",
    "",
    "1. H1 — model name + one-line serving thesis (budget vs production).",
    "2. H2 Go / no-go — 4 bullets copied from the serving plan: (a) required HBM for budget and production targets (b) recommended GPU SKU × count and monthlyUsd (c) the serve command lives in the next section (d) incomplete=true means KV or weights were estimated — say so. The app also renders this table; keep this section to four bullets, no second SKU table.",
    "3. H2 GPU path — explain the plan's GPU row: why that SKU, what is too small. Copy monthlyUsd. Orchestrator: Kubernetes/GKE for multi-GPU, a single workstation if count=1.",
    ...tpuSections,
    "6. H2 3D parallelism — TP equals the plan's GPU count within a node; PP only if count would exceed 8. EP only if tags/name suggest MoE.",
    "7. H2 KV cache and long context — the plan already scaled kvCache4k to 8k/batch 8 and 32k/batch 4. Say what happens at 128k (linear in context). kvKnown=false means the KV term is a 30% buffer, not a measurement.",
    "8. H2 Measure after deploy — TTFT, TPOT, throughput, KV hit rate, queue depth. GPU: vLLM /metrics + DCGM. Do not treat catalog API speed as the cluster SLO and do not invent tpu-recipes tok/s.",
    "9. H2 Optimization loop — if first start is slow / if TTFT is high / if OOM on KV. GPU knobs: max-num-seqs, prefix cache, KV quant. TPU knobs only if tpuJustified.",
    "10. H2 Risks — OOM (weights vs KV), gated weights, GGUF vs GPU serving if modelSizeSource is gguf, missing facts, list prices are planning estimates not quotes.",
    "",
    "Be specific to this model's numbers. Keep it a runbook (~800–1300 words).",
  ].join("\n")

  return { system, prompt }
}
