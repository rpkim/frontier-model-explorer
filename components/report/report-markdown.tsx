"use client"

import type { Components } from "react-markdown"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-0 mb-3 text-2xl font-semibold tracking-tight text-balance">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 border-b border-border pb-1.5 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-sm font-semibold tracking-tight text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-medium">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-2.5 text-[0.9375rem] leading-relaxed text-foreground/90 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-2.5 ml-5 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 ml-5 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="text-[0.9375rem] leading-relaxed pl-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-sm leading-relaxed [&>p]:my-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-[0.8em] leading-snug ring-1 ring-border">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      return <code className={cn("font-mono", className)}>{children}</code>
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] ring-1 ring-border">
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg ring-1 ring-border">
      <table className="w-full min-w-[28rem] border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/70 text-xs uppercase tracking-wide">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium text-muted-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
  tr: ({ children }) => <tr className="even:bg-muted/30">{children}</tr>,
}

export function ReportMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("min-w-0 break-words", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  )
}
