"use client"

import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { colorForKey } from "@/lib/aa/colors"
import { formatDate, formatPrice, formatScore, formatSeconds, formatSpeed } from "@/lib/aa/format"
import { BENCHMARK_LABELS, type ModelNode } from "@/lib/aa/types"
import { cn } from "@/lib/utils"

interface Row {
  label: string
  get: (m: ModelNode) => number | null
  format: (v: number | null) => string
  /** "high" = highest value wins, "low" = lowest value wins */
  better: "high" | "low"
}

const ROWS: Row[] = [
  { label: "Intelligence Index", get: (m) => m.intelligenceIndex, format: formatScore, better: "high" },
  { label: "Coding Index", get: (m) => m.codingIndex, format: formatScore, better: "high" },
  { label: "Math Index", get: (m) => m.mathIndex, format: formatScore, better: "high" },
  { label: "블렌디드 가격 ($/1M)", get: (m) => m.priceBlendedPerM, format: formatPrice, better: "low" },
  { label: "입력 가격 ($/1M)", get: (m) => m.priceInputPerM, format: formatPrice, better: "low" },
  { label: "출력 가격 ($/1M)", get: (m) => m.priceOutputPerM, format: formatPrice, better: "low" },
  { label: "출력 속도 (tok/s)", get: (m) => m.outputTokensPerSecond, format: formatSpeed, better: "high" },
  {
    label: "TTFT",
    get: (m) => m.timeToFirstTokenSeconds,
    format: formatSeconds,
    better: "low",
  },
]

function bestValue(models: ModelNode[], row: Row): number | null {
  const values = models.map((m) => row.get(m)).filter((v): v is number => v !== null)
  if (values.length === 0) return null
  return row.better === "high" ? Math.max(...values) : Math.min(...values)
}

export function CompareTable({ models, onRemove }: { models: ModelNode[]; onRemove: (id: string) => void }) {
  const benchmarkKeys = Array.from(new Set(models.flatMap((m) => Object.keys(m.benchmarks)))) as Array<
    keyof typeof BENCHMARK_LABELS
  >

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-24 min-w-24 bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground sm:w-32 sm:min-w-32">
              지표
            </th>
            {models.map((model) => (
              <th key={model.id} className="min-w-36 px-3 py-2 text-left align-top sm:min-w-40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colorForKey(model.provider.slug) }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-semibold leading-tight">{model.name}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{model.provider.name}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${model.name} 제거`}
                    onClick={() => onRemove(model.id)}
                    className="shrink-0"
                  >
                    <XIcon />
                  </Button>
                </div>
                <Badge variant="outline" className="mt-2 font-mono text-[10px]">
                  {formatDate(model.releaseDate)}
                </Badge>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const best = bestValue(models, row)
            return (
              <tr key={row.label} className="border-t border-border">
                <td className="sticky left-0 z-10 w-24 bg-background px-3 py-2 text-xs text-muted-foreground sm:w-32">
                  {row.label}
                </td>
                {models.map((model) => {
                  const value = row.get(model)
                  const isBest = value !== null && best !== null && value === best && models.length > 1
                  return (
                    <td
                      key={model.id}
                      className={cn(
                        "px-3 py-2 font-mono text-sm tabular-nums",
                        isBest && "font-semibold text-primary",
                      )}
                    >
                      {row.format(value)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {benchmarkKeys.length > 0 && (
            <tr>
              <td colSpan={models.length + 1} className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground">
                벤치마크
              </td>
            </tr>
          )}
          {benchmarkKeys.map((key) => {
            const values = models.map((m) => m.benchmarks[key] ?? null)
            const best = values.filter((v): v is number => v !== null).reduce(
              (max, v) => (max === null || v > max ? v : max),
              null as number | null,
            )
            return (
              <tr key={key} className="border-t border-border">
                <td className="sticky left-0 z-10 w-24 bg-background px-3 py-2 text-xs text-muted-foreground sm:w-32">
                  {BENCHMARK_LABELS[key]}
                </td>
                {models.map((model, i) => {
                  const value = values[i]
                  const isBest = value !== null && best !== null && value === best && models.length > 1
                  return (
                    <td
                      key={model.id}
                      className={cn(
                        "px-3 py-2 font-mono text-sm tabular-nums",
                        isBest && "font-semibold text-primary",
                      )}
                    >
                      {value === null ? "—" : value <= 1 ? formatScore(value * 100, 0) : formatScore(value, 1)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
