import type { GuideHardwareContext, HubVramEstimate } from "./types"

/**
 * Deterministic serving sizer.
 *
 * GPU/TPU counts and copy-paste serve commands are computed here so the guide
 * LLM cannot invent a layout. Required HBM is weights (native or FP16, already
 * including ~20% overhead) plus KV cache scaled from the 4k/batch-1 estimate.
 *
 * Cloud prices are public list-price planning figures, not a quote. They exist
 * so GPU vs TPU is a dollar comparison rather than a SKU beauty contest.
 */

const HOURS_PER_MONTH = 730
/** Leave headroom for fragmentation, CUDA graphs, and the engine itself. */
const UTILIZATION = 0.9
/** Recommend TPU only when the budget GPU path needs this many devices. */
const TPU_MIN_GPU_COUNT = 4

export type ServingTargetId = "budget" | "production"

export interface AcceleratorSku {
  id: string
  family: "gpu" | "tpu"
  label: string
  hbmGb: number
  /** On-demand list price per device-hour, USD. Null when we will not invent one. */
  hourlyUsd: number | null
  /** TPU slice notation, e.g. 2x2. */
  topologyForCount: (count: number) => string | undefined
}

const GPU_COUNTS = [1, 2, 4, 8] as const
const TPU_COUNTS = [1, 4, 8] as const

export const GPU_SKUS: readonly AcceleratorSku[] = [
  {
    id: "rtx4090",
    family: "gpu",
    label: "RTX 4090 24GB",
    hbmGb: 24,
    hourlyUsd: 0.4,
    topologyForCount: () => undefined,
  },
  {
    id: "l40s",
    family: "gpu",
    label: "L40S 48GB",
    hbmGb: 48,
    hourlyUsd: 1.4,
    topologyForCount: () => undefined,
  },
  {
    id: "a100",
    family: "gpu",
    label: "A100 80GB",
    hbmGb: 80,
    hourlyUsd: 2.15,
    topologyForCount: (count) => (count >= 8 ? "8×A100 NVLink" : undefined),
  },
  {
    id: "h100",
    family: "gpu",
    label: "H100 80GB",
    hbmGb: 80,
    hourlyUsd: 3.9,
    topologyForCount: (count) => (count >= 8 ? "8×H100 NVLink" : undefined),
  },
  {
    id: "h200",
    family: "gpu",
    label: "H200 141GB",
    hbmGb: 141,
    hourlyUsd: 4.8,
    topologyForCount: (count) => (count >= 8 ? "8×H200 NVLink" : undefined),
  },
  {
    id: "b200",
    family: "gpu",
    label: "B200 192GB",
    hbmGb: 192,
    hourlyUsd: 8,
    topologyForCount: (count) => (count >= 8 ? "8×B200 NVLink" : undefined),
  },
]

export const TPU_SKUS: readonly AcceleratorSku[] = [
  {
    id: "v5e",
    family: "tpu",
    label: "TPU v5e 16GB",
    hbmGb: 16,
    hourlyUsd: 1.2,
    topologyForCount: (count) => (count === 1 ? "1x1" : count === 4 ? "2x2" : "2x4"),
  },
  {
    id: "v6e",
    family: "tpu",
    label: "TPU v6e Trillium 32GB",
    hbmGb: 32,
    hourlyUsd: 2.7,
    topologyForCount: (count) => (count === 1 ? "1x1" : count === 4 ? "2x2" : "2x4"),
  },
  {
    id: "v5p",
    family: "tpu",
    label: "TPU v5p 95GB",
    hbmGb: 95,
    hourlyUsd: 4.2,
    topologyForCount: (count) => (count <= 4 ? "2x2x1" : "2x2x2"),
  },
  {
    id: "ironwood",
    family: "tpu",
    label: "Ironwood TPU7x 192GB",
    hbmGb: 192,
    hourlyUsd: null,
    topologyForCount: (count) => (count <= 4 ? "2x2x1" : "2x4x1"),
  },
]

export const SERVING_TARGETS: readonly {
  id: ServingTargetId
  contextTokens: number
  batch: number
}[] = [
  { id: "budget", contextTokens: 8_192, batch: 8 },
  { id: "production", contextTokens: 32_768, batch: 4 },
]

export interface SkuFit {
  family: "gpu" | "tpu"
  skuId: string
  label: string
  hbmGb: number
  count: number
  topology?: string
  requiredHbmGb: number
  usableHbmGb: number
  hourlyUsd: number | null
  monthlyUsd: number | null
}

export interface ServingTargetPlan {
  id: ServingTargetId
  contextTokens: number
  batch: number
  requiredHbmGb: number
  kvKnown: boolean
  gpu: SkuFit | null
  tpu: SkuFit | null
  serveCommand: string | null
  tpuServeCommand: string | null
}

export interface ServingPlan {
  weightHbmGb: number | null
  kvCache4kGb: number | null
  dtype?: string
  parameterCount?: number
  hfId?: string
  gated?: boolean
  /** True when the budget GPU layout needs several devices. Otherwise TPU is optional. */
  tpuJustified: boolean
  incomplete: boolean
  targets: ServingTargetPlan[]
}

function roundGb(value: number): number {
  if (value >= 100) return Math.round(value)
  if (value >= 10) return Math.round(value * 10) / 10
  return Math.round(value * 100) / 100
}

function roundUsd(value: number): number {
  if (value >= 100) return Math.round(value)
  if (value >= 1) return Math.round(value * 100) / 100
  return Math.round(value * 1000) / 1000
}

function weightHbm(vram: HubVramEstimate | undefined): number | null {
  if (!vram) return null
  if (vram.native != null && vram.native > 0) return vram.native
  if (vram.fp16 != null && vram.fp16 > 0) return vram.fp16
  return null
}

export function requiredHbmGb(
  vram: HubVramEstimate | undefined,
  contextTokens: number,
  batch: number,
): { requiredHbmGb: number; kvKnown: boolean } | null {
  const weights = weightHbm(vram)
  if (weights == null) return null

  const kv4k = vram?.kvCache4k
  if (kv4k != null && kv4k > 0) {
    const kv = kv4k * (contextTokens / 4096) * batch
    return { requiredHbmGb: roundGb(weights + kv), kvKnown: true }
  }

  // No architecture-derived KV: keep a conservative 30% decode buffer and say so.
  return { requiredHbmGb: roundGb(weights * 1.3), kvKnown: false }
}

function monthlyUsd(sku: AcceleratorSku, count: number): number | null {
  if (sku.hourlyUsd == null) return null
  return roundUsd(sku.hourlyUsd * HOURS_PER_MONTH * count)
}

function fitSku(
  sku: AcceleratorSku,
  required: number,
  allowedCounts: readonly number[],
): SkuFit | null {
  for (const count of allowedCounts) {
    const usable = sku.hbmGb * UTILIZATION * count
    if (usable + 1e-6 >= required) {
      const topology = sku.topologyForCount(count)
      return {
        family: sku.family,
        skuId: sku.id,
        label: sku.label,
        hbmGb: sku.hbmGb,
        count,
        topology,
        requiredHbmGb: required,
        usableHbmGb: roundGb(usable),
        hourlyUsd: sku.hourlyUsd,
        monthlyUsd: monthlyUsd(sku, count),
      }
    }
  }
  return null
}

/**
 * Cheapest layout that fits: among SKUs that can hold the working set, pick the
 * one with the lowest monthly (or hourly) bill, then the fewest devices.
 */
function cheapestFit(
  skus: readonly AcceleratorSku[],
  required: number,
  allowedCounts: readonly number[],
): SkuFit | null {
  const fits = skus
    .map((sku) => fitSku(sku, required, allowedCounts))
    .filter((row): row is SkuFit => row !== null)
  if (fits.length === 0) return null

  return [...fits].sort((a, b) => {
    const aCost = a.monthlyUsd ?? Number.POSITIVE_INFINITY
    const bCost = b.monthlyUsd ?? Number.POSITIVE_INFINITY
    if (aCost !== bCost) return aCost - bCost
    if (a.count !== b.count) return a.count - b.count
    return a.hbmGb - b.hbmGb
  })[0]
}

function serveCommand(
  family: "gpu" | "tpu",
  hfId: string | undefined,
  tp: number,
  contextTokens: number,
  maxSeqs: number,
  gated: boolean | undefined,
): string | null {
  if (!hfId) return null
  const token = gated ? " \\\n  --hf-token $HF_TOKEN" : ""
  if (family === "tpu") {
    return [
      `vllm serve ${hfId} \\`,
      `  --tensor-parallel-size ${tp} \\`,
      `  --max-model-len ${contextTokens} \\`,
      `  --max-num-seqs ${maxSeqs} \\`,
      `  --gpu-memory-utilization 0.9 \\`,
      `  --max-num-batched-tokens ${Math.max(512, contextTokens)} \\`,
      `  --async-scheduling${token}`,
    ].join("\n")
  }
  return [
    `vllm serve ${hfId} \\`,
    `  --tensor-parallel-size ${tp} \\`,
    `  --max-model-len ${contextTokens} \\`,
    `  --max-num-seqs ${maxSeqs} \\`,
    `  --gpu-memory-utilization 0.9${token}`,
  ].join("\n")
}

export function planServing(context: GuideHardwareContext): ServingPlan {
  const vram = context.vramGb
  const weights = weightHbm(vram)
  const targets: ServingTargetPlan[] = []

  for (const spec of SERVING_TARGETS) {
    const need = requiredHbmGb(vram, spec.contextTokens, spec.batch)
    if (!need) {
      targets.push({
        id: spec.id,
        contextTokens: spec.contextTokens,
        batch: spec.batch,
        requiredHbmGb: 0,
        kvKnown: false,
        gpu: null,
        tpu: null,
        serveCommand: null,
        tpuServeCommand: null,
      })
      continue
    }

    const gpu = cheapestFit(GPU_SKUS, need.requiredHbmGb, GPU_COUNTS)
    const tpu = cheapestFit(TPU_SKUS, need.requiredHbmGb, TPU_COUNTS)
    targets.push({
      id: spec.id,
      contextTokens: spec.contextTokens,
      batch: spec.batch,
      requiredHbmGb: need.requiredHbmGb,
      kvKnown: need.kvKnown,
      gpu,
      tpu,
      serveCommand: gpu
        ? serveCommand("gpu", context.hfId, gpu.count, spec.contextTokens, spec.batch, context.gated)
        : null,
      tpuServeCommand: tpu
        ? serveCommand("tpu", context.hfId, tpu.count, spec.contextTokens, spec.batch, context.gated)
        : null,
    })
  }

  const budgetGpuCount = targets.find((row) => row.id === "budget")?.gpu?.count ?? 1
  const tpuJustified = budgetGpuCount >= TPU_MIN_GPU_COUNT || (weights != null && weights > 80)
  const incomplete = weights == null || targets.some((row) => !row.kvKnown || row.gpu == null)

  return {
    weightHbmGb: weights,
    kvCache4kGb: vram?.kvCache4k ?? null,
    dtype: vram?.nativeDtype ?? context.primaryDtype,
    parameterCount: context.parameterCount,
    hfId: context.hfId,
    gated: context.gated,
    tpuJustified,
    incomplete,
    targets,
  }
}
