"use client"

import { PlusCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { colorForKey } from "@/lib/aa/colors"
import { formatDate, formatPrice, formatScore, formatSeconds, formatSpeed } from "@/lib/aa/format"
import { BENCHMARK_LABELS, type ModelNode } from "@/lib/aa/types"
import { ParetoScatter } from "@/components/charts/pareto-scatter"

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums leading-none">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function BenchmarkBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(2, Math.min(100, value <= 1 ? value * 100 : value))
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-xs text-muted-foreground sm:w-36">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums">
        {value <= 1 ? formatScore(value * 100, 0) : formatScore(value, 1)}
      </span>
    </div>
  )
}

export function ModelDetailPanel({
  model,
  allModels,
  onAddToCompare,
}: {
  model: ModelNode
  allModels: ModelNode[]
  onAddToCompare?: (id: string) => void
}) {
  const benchmarkEntries = Object.entries(model.benchmarks) as [keyof typeof BENCHMARK_LABELS, number][]

  return (
    <div className="flex h-full min-w-80 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: colorForKey(model.provider.slug) }}
                aria-hidden="true"
              />
              <h2 className="text-balance text-base font-semibold leading-tight">{model.name}</h2>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{model.provider.name}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {formatDate(model.releaseDate)}
            </Badge>
            {onAddToCompare && (
              <Button size="sm" variant="outline" onClick={() => onAddToCompare(model.id)}>
                <PlusCircleIcon data-icon="inline-start" />
                비교에 추가
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Intelligence Index" value={formatScore(model.intelligenceIndex)} />
          <MetricCard label="Coding Index" value={formatScore(model.codingIndex)} />
          <MetricCard label="Math Index" value={formatScore(model.mathIndex)} />
          <MetricCard label="블렌디드 가격" value={formatPrice(model.priceBlendedPerM)} sub="/1M 토큰" />
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="입력 가격" value={formatPrice(model.priceInputPerM)} sub="/1M 토큰" />
          <MetricCard label="출력 가격" value={formatPrice(model.priceOutputPerM)} sub="/1M 토큰" />
          <MetricCard label="출력 속도" value={formatSpeed(model.outputTokensPerSecond)} />
          <MetricCard label="TTFT" value={formatSeconds(model.timeToFirstTokenSeconds)} sub="첫 토큰까지" />
        </section>

        {benchmarkEntries.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-xs font-medium text-muted-foreground">벤치마크 점수</h3>
            <div className="flex flex-col gap-2">
              {benchmarkEntries.map(([key, value]) => (
                <BenchmarkBar key={key} label={BENCHMARK_LABELS[key]} value={value} />
              ))}
            </div>
          </section>
        )}

        <Separator />

        <section>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">Pareto 포지션 · 지능 대비 가격</h3>
          <ParetoScatter models={allModels} xMetric="price" highlightIds={[model.id]} />
        </section>

        <section>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">Pareto 포지션 · 지능 대비 속도</h3>
          <ParetoScatter models={allModels} xMetric="speed" highlightIds={[model.id]} />
        </section>
      </div>
    </div>
  )
}
