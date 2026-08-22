import { get, put } from "@vercel/blob"
import type { Locale } from "@/lib/i18n/locales"
import type { GuideHardwareContext, GuideIndex, HubDetail, ModelGuide, ModelNode } from "./types"

export const GUIDE_INDEX_PATHNAME = "frontier-models/guides/index.json"
export const GUIDE_MODEL_ID = "gemini-3.5-flash"

const GUIDE_LANGUAGE: Record<Locale, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  zh: "Simplified Chinese",
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function guideBlobPath(modelId: string): string {
  const safe = modelId.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `frontier-models/guides/${safe}.json`
}

const BLOCKING_HUB_ERRORS = new Set([
  "unmapped",
  "not_found",
  "timeout",
  "rate_limited",
  "fetch_failed",
])

export function hasUsableHubDetail(detail: HubDetail | null | undefined): boolean {
  if (!detail) return false
  if (detail.error && BLOCKING_HUB_ERRORS.has(detail.error)) return false
  return (
    (detail.parameterCount != null && detail.parameterCount > 0) ||
    (detail.modelSizeBytes != null && detail.modelSizeBytes > 0) ||
    Boolean(detail.vramEstimate)
  )
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
  if (model.outputTokensPerSecond != null) ctx.outputTokensPerSecond = round(model.outputTokensPerSecond, 1)
  if (model.timeToFirstTokenSeconds != null) ctx.timeToFirstTokenSeconds = round(model.timeToFirstTokenSeconds, 3)
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
    console.error("[v0] Failed to read guide blob:", pathname, error)
    return null
  }
}

export async function readGuideIndex(): Promise<GuideIndex> {
  const parsed = await readJsonBlob(GUIDE_INDEX_PATHNAME)
  return isGuideIndex(parsed) ? parsed : {}
}

export async function readGuide(modelId: string): Promise<ModelGuide | null> {
  const parsed = await readJsonBlob(guideBlobPath(modelId))
  return isModelGuide(parsed) ? parsed : null
}

export async function writeGuide(guide: ModelGuide): Promise<ModelGuide> {
  await put(guideBlobPath(guide.modelId), JSON.stringify(guide), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  const index = await readGuideIndex()
  index[guide.modelId] = {
    generatedAt: guide.generatedAt,
    modelName: guide.modelName,
    hfId: guide.hfId,
  }
  await put(GUIDE_INDEX_PATHNAME, JSON.stringify(index), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
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
}: {
  context: GuideHardwareContext
  locale: Locale
}): { system: string; prompt: string } {
  const system = [
    "You are a serving/infrastructure architect for Frontier Model Explorer.",
    "Write a practical deployment guide for THIS open-weight model only.",
    "Use ONLY the hardware JSON below for model size, dtype, VRAM estimates, and parameter counts.",
    "Do not invent parameter counts, file sizes, or GPU memory numbers. If a field is missing, say unknown and plan conservatively.",
    "VRAM figures are estimates (weights + ~20% overhead). Never claim a specific SKU 'will run' — say 'planning fit' vs 'too small unless quantized/sharded'.",
    "Give 1–2 recommended configs for BOTH GPU and TPU: (A) budget inference (B) production long-context. Label all accelerator counts as estimates.",
    "The executive recommendation MUST include TPU, not GPU only. Never skip TPU in that section.",
    "For every TPU recommendation, follow AI-Hypercomputer/tpu-recipes methodology (XLA compile/cache, topologies, vLLM-TPU flags, recipe-style benches). Do not paste confidential or invented tok/s from that repo.",
    "Catalog intelligence/coding scores and API tok/s are quality/API references, NOT local-cluster SLOs or GPU-sizing inputs.",
    HARDWARE_PACK,
    `Write the entire guide in ${GUIDE_LANGUAGE[locale]}. Translate section titles.`,
    "Prefer tables and numbered steps. About 1100–1800 words. Do not wrap the document in a code fence.",
    "Hardware JSON:",
    JSON.stringify(context),
  ].join("\n")

  const prompt = [
    "Write GitHub-flavored markdown with this section order (titles translated). Do not wrap the document in a code fence.",
    "",
    "1. H1 — model name + one-line serving thesis (budget vs production).",
    "2. H2 Executive recommendation — MUST cover GPU and TPU equally. Required markdown table with columns: Path | Role | SKU / generation | Count | Topology (nodes or TPU slice/pod) | Orchestrator | Why. Required rows: (1) GPU budget (2) GPU production long-context (3) TPU budget (4) TPU production long-context. Use real TPU gens (v5e / v6e / v5p / Ironwood), never omit the TPU rows. Then 2–4 bullets: when to pick GPU vs TPU.",
    "3. H2 GPU path — SKU options, GPU count, node layout (e.g. 8×H100), Kubernetes/GKE/Slurm/Ray, interconnect. Call out SKUs that are too small.",
    "4. H2 TPU path — real generation (v5e / v6e Trillium / v5p / Ironwood TPU7x), chip count, topology (e.g. v6e 2x2/2x4, Ironwood 2x2x1), GCE TPU VM vs GKE + Cluster Toolkit, queued resources. Include H3 XLA tuning: static shapes, first-compile warmup, VLLM_XLA_CACHE_PATH, replica cache-write race, VLLM_TPU_MOST_MODEL_LEN, VLLM_TPU_BUCKET_PADDING_GAP (128), LIBTPU_INIT_ARGS for quantized matmul. Link https://github.com/AI-Hypercomputer/tpu-recipes as the reproduce-the-stack reference. Never recommend TPU v1 or a fictional TPU v8.",
    "5. H2 Framework — GPU: vLLM and/or SGLang with example serve flags using hfId (TGI optional). TPU: vllm/vllm-tpu (tpu-inference JAX→XLA path) with a concrete `vllm serve` using this hfId, TP=chips, gpu-memory-utilization, max-num-batched-tokens (prefill vs decode), max-num-seqs, async-scheduling; JAX MaxText/Pax/JetStream as the training/native-JAX alternative. Gated weights: HF token. Docker privileged + large shm as in tpu-recipes.",
    "6. H2 3D parallelism — concrete TP/PP/DP (EP if MoE) mapped to the GPU node fabric and a TPU topology.",
    "7. H2 KV cache and long context — paged attention, prefix/session cache, KV quantization, when to disaggregate prefill/decode. Use kvCache4k if present to estimate 32k/128k at batch 1 and a small batch.",
    "8. H2 Performance measurement — after the model is serving: metrics (TTFT, TPOT, ITL, throughput tok/s, goodput, GPU/TPU util, KV cache hit rate, queue depth). GPU: vLLM /metrics + DCGM. TPU: follow tpu-recipes — `vllm bench serve` random dataset; run a prefill-heavy and a decode-heavy sweep; note concurrency vs P99 TTFT; optional Ironwood 1k/8k and 8k/1k; XLA compile time as a separate SLO; Cloud TPU profiler. Do not treat catalog API tok/s as the cluster SLO and do not invent tpu-recipes throughput numbers.",
    "9. H2 Benchmarks and quality checks — serving benches vs quality benches. Use catalog intelligence/coding/math and named scores as the pre-deploy quality baseline. After quantization or tensor-parallel serving, re-run a small eval (lm-eval subset, needle-in-haystack, or LongBench-style check) so quality does not silently regress.",
    "10. H2 Optimization loop — GPU knobs: max_num_seqs / batch, chunked prefill, CUDA graphs, prefix cache, KV/weight quant, speculative decoding, replicas vs TP. TPU knobs (after XLA cache is warm): max-num-batched-tokens (512 decode vs 2048+ prefill), max-num-seqs, gpu-memory-utilization, KV FP8, bucket padding, MOST_MODEL_LEN, INT8/FP8 on v5e/v6e MXU, then more chips vs more replicas. Playbook: if first start is slow (compile/cache) / if TTFT is high / if throughput is low / if OOM on KV.",
    "11. H2 Risks — OOM (weights vs KV), interconnect, gated weights, GGUF vs GPU serving if modelSizeSource is gguf, missing facts.",
    "",
    "Be specific to this model's numbers. Keep it scannable (~1100–1800 words).",
  ].join("\n")

  return { system, prompt }
}
