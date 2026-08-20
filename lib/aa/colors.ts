/**
 * Deterministic categorical color for provider dots/badges in the mind map.
 * Uses a fixed set of hand-tuned OKLCH hues that read clearly on the dark
 * dashboard background without introducing new "core" UI colors.
 */
const PALETTE = [
  "oklch(0.75 0.15 70)", // amber
  "oklch(0.72 0.12 195)", // teal
  "oklch(0.72 0.16 25)", // coral
  "oklch(0.75 0.14 145)", // sage
  "oklch(0.72 0.15 300)", // violet
  "oklch(0.78 0.13 105)", // olive
  "oklch(0.7 0.15 235)", // sky
  "oklch(0.75 0.16 350)", // rose
  "oklch(0.76 0.12 165)", // mint
  "oklch(0.73 0.14 55)", // gold
]

export function colorForKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % PALETTE.length
  return PALETTE[index]
}
