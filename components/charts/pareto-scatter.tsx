"use client"

import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { ModelNode } from "@/lib/aa/types"

const chartConfig: ChartConfig = {
  others: { label: "다른 모델", color: "var(--chart-5)" },
  highlighted: { label: "선택 모델", color: "var(--chart-1)" },
}

/**
 * Scatter plot of intelligence vs. cost (or speed) across all models, with the
 * currently viewed model(s) highlighted — shows where a model sits on the
 * Pareto frontier of "smart for the price" / "smart for the speed".
 */
export function ParetoScatter({
  models,
  xMetric,
  highlightIds,
}: {
  models: ModelNode[]
  xMetric: "price" | "speed"
  highlightIds: string[]
}) {
  const xKey = xMetric === "price" ? "priceBlendedPerM" : "outputTokensPerSecond"
  const xLabel = xMetric === "price" ? "가격 ($/1M 토큰, blended)" : "속도 (tok/s)"

  const points = models
    .filter((m) => m.intelligenceIndex !== null && m[xKey] !== null)
    .map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider.name,
      x: m[xKey] as number,
      y: m.intelligenceIndex as number,
      highlighted: highlightIds.includes(m.id),
    }))

  const others = points.filter((p) => !p.highlighted)
  const highlighted = points.filter((p) => p.highlighted)

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          scale={xMetric === "price" ? "log" : "linear"}
          domain={xMetric === "price" ? ["auto", "auto"] : [0, "auto"]}
          tickFormatter={(v: number) => (xMetric === "price" ? `$${v}` : `${v}`)}
          tick={{ fontSize: 11 }}
          label={{ value: xLabel, position: "insideBottom", offset: -6, fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Intelligence Index"
          tick={{ fontSize: 11 }}
          width={32}
          label={{
            value: "지능",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
        />
        <ZAxis range={[40, 40]} />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_value, _name, item) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{item.payload.name}</span>
                  <span className="text-muted-foreground">{item.payload.provider}</span>
                  <span className="font-mono text-foreground">
                    지능 {item.payload.y.toFixed(1)} · {xMetric === "price" ? `$${item.payload.x}` : `${item.payload.x} tok/s`}
                  </span>
                </div>
              )}
            />
          }
        />
        <Scatter data={others} fill="var(--color-others)" fillOpacity={0.45} />
        <Scatter data={highlighted} fill="var(--color-highlighted)" shape="circle" r={5} />
      </ScatterChart>
    </ChartContainer>
  )
}
