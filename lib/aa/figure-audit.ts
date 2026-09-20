/**
 * Checks the figures a generated report prints against the data it was grounded on.
 *
 * The report prompt forbids deriving numbers — the value analysis is computed in
 * `value.ts` precisely so the arithmetic is reproducible — but nothing enforced
 * that. One fabricated dollar figure is enough to discredit the whole briefing,
 * and it is the one failure mode that can be checked mechanically, so it is.
 *
 * Money and percentages are audited because those are the figures a reader acts
 * on. Bare integers (token counts, model counts, section numbers) are left alone:
 * they carry little decision weight and would produce constant false alarms.
 */

/** Percentages below this are usually prose ("a 3% drop") rather than quoted data. */
const MIN_AUDITED_PERCENT = 1

/** Stored figures are rounded to 4 decimals, so exact matches need this much slack. */
const MIN_TOLERANCE = 5e-5

const MAX_SAMPLES = 6

export interface FigureAudit {
  /** Money and percentage figures found in the prose. */
  checkedCount: number
  unverifiedCount: number
  /** A few offenders, as printed, so the reader can judge for themselves. */
  samples: string[]
}

/**
 * Every number the report is allowed to print. Rates are stored as fractions but
 * usually printed as percentages, so both forms are admitted.
 */
function collectFacts(value: unknown, into: Set<number>): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return
    into.add(value)
    if (value > 0 && value <= 1) into.add(value * 100)
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectFacts(entry, into)
    return
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectFacts(entry, into)
  }
}

function parsePrinted(raw: string): number | null {
  const parsed = Number.parseFloat(raw.replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

/** A figure printed to two decimals only pins the true value to within half a cent. */
function toleranceFor(raw: string): number {
  const decimals = raw.split(".")[1]?.length ?? 0
  return Math.max(0.5 * 10 ** -decimals, MIN_TOLERANCE)
}

function isKnown(printed: number, raw: string, facts: Set<number>): boolean {
  const tolerance = toleranceFor(raw)
  for (const fact of facts) {
    if (Math.abs(fact - printed) <= tolerance) return true
  }
  return false
}

/**
 * `grounded` should be exactly what was handed to the model: the summary, the
 * value analysis, and the catalog. Anything not traceable to it is reported.
 */
export function auditReportFigures(markdown: string, grounded: unknown[]): FigureAudit {
  const facts = new Set<number>()
  for (const source of grounded) collectFacts(source, facts)

  const printed: { raw: string; display: string; value: number }[] = []

  for (const match of markdown.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)) {
    const value = parsePrinted(match[1])
    if (value != null) printed.push({ raw: match[1], display: `$${match[1]}`, value })
  }

  for (const match of markdown.matchAll(/(\d[\d,]*(?:\.\d+)?)\s?%/g)) {
    const value = parsePrinted(match[1])
    if (value != null && value >= MIN_AUDITED_PERCENT) {
      printed.push({ raw: match[1], display: `${match[1]}%`, value })
    }
  }

  const unverified: string[] = []
  for (const figure of printed) {
    if (isKnown(figure.value, figure.raw, facts)) continue
    if (!unverified.includes(figure.display)) unverified.push(figure.display)
  }

  return {
    checkedCount: printed.length,
    unverifiedCount: unverified.length,
    samples: unverified.slice(0, MAX_SAMPLES),
  }
}
