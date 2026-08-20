"use client"

import type { CSSProperties, ReactNode } from "react"
import type { Components } from "react-markdown"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

const ink = "#1f2937"
const muted = "#6b7280"
const rule = "#d1d5db"
const wash = "#f3f4f6"
const link = "#1d4ed8"

const pageStyle: CSSProperties = {
  boxSizing: "border-box",
  width: 794,
  padding: "36px 40px 48px",
  background: "#ffffff",
  color: ink,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Hiragino Sans", "Yu Gothic", "PingFang SC", "Microsoft YaHei", Helvetica, Arial, sans-serif',
  fontSize: 13,
  lineHeight: 1.65,
  textAlign: "left",
}

const components: Components = {
  h1: ({ children }) => (
    <h1 style={{ margin: "0 0 14px", fontSize: 22, lineHeight: 1.3, fontWeight: 700, color: "#111827" }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        margin: "22px 0 10px",
        paddingBottom: 6,
        borderBottom: `1px solid ${rule}`,
        fontSize: 16,
        lineHeight: 1.35,
        fontWeight: 700,
        color: "#111827",
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ margin: "16px 0 8px", fontSize: 14, fontWeight: 700, color: "#111827" }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ margin: "12px 0 6px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{children}</h4>
  ),
  p: ({ children }) => <p style={{ margin: "0 0 10px", color: ink }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: "#111827" }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
  a: ({ href, children }) => (
    <a href={href} style={{ color: link, textDecoration: "underline" }}>
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: "0 0 10px", paddingLeft: 22, listStyleType: "disc" }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: "0 0 10px", paddingLeft: 22, listStyleType: "decimal" }}>{children}</ol>
  ),
  li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: "12px 0",
        padding: "8px 12px",
        borderLeft: `3px solid ${rule}`,
        background: wash,
        color: ink,
      }}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{ margin: "18px 0", border: 0, borderTop: `1px solid ${rule}` }} />,
  pre: ({ children }) => (
    <pre
      style={{
        margin: "10px 0",
        padding: 12,
        overflow: "hidden",
        background: wash,
        border: `1px solid ${rule}`,
        borderRadius: 6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        fontSize: 11,
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      return <code style={{ fontFamily: "inherit" }}>{children}</code>
    }
    return (
      <code
        style={{
          padding: "1px 4px",
          background: wash,
          border: `1px solid ${rule}`,
          borderRadius: 4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: "0.9em",
        }}
      >
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <table
      style={{
        width: "100%",
        margin: "10px 0 14px",
        borderCollapse: "collapse",
        fontSize: 12,
      }}
    >
      {children}
    </table>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  th: ({ children }) => (
    <th
      style={{
        textAlign: "left",
        background: wash,
        border: `1px solid ${rule}`,
        padding: "6px 8px",
        fontWeight: 600,
        color: "#111827",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ border: `1px solid ${rule}`, padding: "6px 8px", verticalAlign: "top", color: ink }}>
      {children}
    </td>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
}

function Header({ title, meta, model }: { title: string; meta: string; model: string }) {
  return (
    <header style={{ marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${rule}` }}>
      <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: muted }}>
        {title}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: ink }}>{meta}</p>
      <p style={{ margin: "2px 0 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 10, color: muted }}>
        {model}
      </p>
    </header>
  )
}

export function ReportPdfDocument({
  markdown,
  title,
  meta,
  model,
}: {
  markdown: string
  title: string
  meta: string
  model: string
}): ReactNode {
  return (
    <div data-report-pdf="" style={pageStyle}>
      <Header title={title} meta={meta} model={model} />
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  )
}
