import "katex/dist/katex.min.css";
import katex from "katex";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const OrderedCtx = createContext(false);

// ── KaTeX rendering helpers ───────────────────────────────────────────────
function renderKatex(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula.trim(), {
      throwOnError: false,
      displayMode,
      strict: false,
      trust: true,
      output: "htmlAndMathml",
    });
  } catch {
    return `<code class="text-violet-300 font-mono text-xs">${formula}</code>`;
  }
}

// ── Segment: split content into text/math parts ───────────────────────────
type Segment =
  | { kind: "text"; value: string }
  | { kind: "block"; formula: string }
  | { kind: "inline"; formula: string };

function segmentContent(raw: string): Segment[] {
  const segments: Segment[] = [];
  let pos = 0;
  let textStart = 0;

  const flush = (to: number) => {
    if (to > textStart) segments.push({ kind: "text", value: raw.slice(textStart, to) });
  };

  while (pos < raw.length) {
    const ch = raw[pos];

    // ── Skip fenced code blocks (``` ... ```) completely — pass as-is to ReactMarkdown ──
    if (ch === "`" && raw[pos + 1] === "`" && raw[pos + 2] === "`") {
      // find closing ```
      const closeIdx = raw.indexOf("```", pos + 3);
      if (closeIdx !== -1) {
        // just advance past the whole block — ReactMarkdown handles it
        pos = closeIdx + 3;
        continue;
      }
    }

    // \[ ... \] block math  (single or double backslash)
    if (ch === "\\") {
      const next = raw[pos + 1];
      if (next === "[" || (next === "\\" && raw[pos + 2] === "[")) {
        const skip = next === "\\" ? 3 : 2;
        const close = next === "\\" ? "\\\\]" : "\\]";
        const end = raw.indexOf(close, pos + skip);
        if (end !== -1) {
          flush(pos);
          segments.push({ kind: "block", formula: raw.slice(pos + skip, end).trim() });
          pos = end + close.length;
          textStart = pos;
          continue;
        }
      }
      // \( ... \) inline math  (single or double backslash)
      if (next === "(" || (next === "\\" && raw[pos + 2] === "(")) {
        const skip = next === "\\" ? 3 : 2;
        const close = next === "\\" ? "\\\\)" : "\\)";
        const end = raw.indexOf(close, pos + skip);
        if (end !== -1) {
          flush(pos);
          segments.push({ kind: "inline", formula: raw.slice(pos + skip, end).trim() });
          pos = end + close.length;
          textStart = pos;
          continue;
        }
      }
    }

    // $$ ... $$ block math
    if (ch === "$" && raw[pos + 1] === "$") {
      const end = raw.indexOf("$$", pos + 2);
      if (end !== -1) {
        flush(pos);
        segments.push({ kind: "block", formula: raw.slice(pos + 2, end).trim() });
        pos = end + 2;
        textStart = pos;
        continue;
      }
    }

    // $ ... $ inline math — only if candidate contains actual LaTeX commands
    if (ch === "$" && raw[pos + 1] !== "$") {
      const end = raw.indexOf("$", pos + 1);
      if (end !== -1 && end > pos + 1) {
        const candidate = raw.slice(pos + 1, end);
        // Only treat as math if it contains LaTeX commands (backslash + letters) or ^ _ superscript/subscript
        if (/\\[a-zA-Z]|[_^{}]/.test(candidate)) {
          flush(pos);
          segments.push({ kind: "inline", formula: candidate.trim() });
          pos = end + 1;
          textStart = pos;
          continue;
        }
      }
    }

    // \begin{...}...\end{...}
    if (ch === "\\" && raw.slice(pos, pos + 7) === "\\begin") {
      const envMatch = raw.slice(pos).match(/^\\begin\{(equation|align|aligned|gather|multline|cases)\*?}([\s\S]+?)\\end\{\1\*?}/);
      if (envMatch) {
        flush(pos);
        segments.push({ kind: "block", formula: envMatch[0].trim() });
        pos += envMatch[0].length;
        textStart = pos;
        continue;
      }
    }

    pos++;
  }

  flush(raw.length);
  return segments;
}

// ── KaTeX inline component ────────────────────────────────────────────────
function KaTeXInline({ formula }: { formula: string }) {
  return (
    <span
      className="[&_.katex]:text-sm"
      dangerouslySetInnerHTML={{ __html: renderKatex(formula, false) }}
    />
  );
}

// ── KaTeX block component ─────────────────────────────────────────────────
function KaTeXBlock({ formula }: { formula: string }) {
  return (
    <div
      className="my-4 overflow-x-auto text-center [&_.katex-display]:my-0"
      dangerouslySetInnerHTML={{ __html: renderKatex(formula, true) }}
    />
  );
}

// ── Mermaid diagram ───────────────────────────────────────────────────────
function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            background: "#0f0f1a",
            primaryColor: "#7c3aed",
            primaryTextColor: "#e2e8f0",
            lineColor: "#6366f1",
            secondaryColor: "#1e1b4b",
            tertiaryColor: "#1e1e2e",
          },
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
        });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, code.trim());
        if (!cancelled) setSvg(rendered);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Ошибка рендера диаграммы");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) return (
    <div className="my-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400">
      <p className="font-semibold mb-1">Ошибка диаграммы</p>
      <pre className="whitespace-pre-wrap font-mono opacity-70">{error}</pre>
    </div>
  );

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-violet-500/70" />
        <span className="text-xs text-slate-500 font-mono">diagram</span>
      </div>
      {svg ? (
        <div
          ref={ref}
          className="p-4 overflow-x-auto flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="p-6 flex items-center justify-center text-slate-500 text-sm">
          Строю диаграмму…
        </div>
      )}
    </div>
  );
}

// ── Chart colours ─────────────────────────────────────────────────────────
const CHART_COLORS = ["#7c3aed", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

// ── JSON chart block ──────────────────────────────────────────────────────
function ChartBlock({ code }: { code: string }) {
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setParsed(JSON.parse(code.trim()));
    } catch (e: any) {
      setError("Неверный JSON графика");
    }
  }, [code]);

  if (error) return (
    <div className="my-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400">{error}</div>
  );
  if (!parsed) return null;

  const { type, title, data, xKey, yKeys = [], labels, values } = parsed;

  const renderChart = () => {
    const commonProps = { data, margin: { top: 5, right: 20, left: 0, bottom: 5 } };
    const axisStyle = { style: { fontSize: 11, fill: "#94a3b8" } };
    const gridStyle = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.08)" };

    if (type === "line") return (
      <LineChart {...commonProps}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} />
        <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
        <Legend />
        {(yKeys as string[]).map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    );

    if (type === "bar") return (
      <BarChart {...commonProps}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} />
        <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
        <Legend />
        {(yKeys as string[]).map((k, i) => (
          <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    );

    if (type === "area") return (
      <AreaChart {...commonProps}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} />
        <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
        <Legend />
        {(yKeys as string[]).map((k, i) => (
          <Area key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length] + "33"} strokeWidth={2} />
        ))}
      </AreaChart>
    );

    if (type === "pie") {
      const pieData = labels.map((l: string, i: number) => ({ name: l, value: values[i] }));
      return (
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {pieData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      );
    }

    return <div className="text-sm text-slate-500 p-4">Неизвестный тип графика: {type}</div>;
  };

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-blue-500/70" />
        <span className="text-xs text-slate-500 font-mono">chart</span>
        {title && <span className="text-xs text-slate-400 ml-1">— {title}</span>}
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Detect if raw text in code block is LaTeX math ────────────────────────
function isLatexContent(code: string): boolean {
  const t = code.trim();
  if (t.startsWith("\\[") || t.startsWith("$$") || t.startsWith("\\begin{")) return true;
  const cmds = (t.match(/\\(?:frac|sum|int|prod|lim|infty|sqrt|partial|nabla|Delta|alpha|beta|gamma|theta|lambda|sigma|pi|mu|omega|phi|psi|epsilon|delta|times|cdot|leq|geq|neq|mathbf|mathrm|text|boxed)\b/g) || []).length;
  return cmds >= 2;
}

// ── Terminal-style code block ─────────────────────────────────────────────
function CodeBlock({ lang, value }: { lang: string; value: string }) {
  if (lang === "mermaid") return <MermaidDiagram code={value} />;
  if (lang === "chart") return <ChartBlock code={value} />;
  if (lang === "math" || lang === "latex" || lang === "tex") {
    return <KaTeXBlock formula={value.trim()} />;
  }
  if (!lang && isLatexContent(value)) {
    return <RenderMessage content={value.trim()} />;
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-red-500/70" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
        <div className="w-2 h-2 rounded-full bg-green-500/70" />
        <span className="ml-1 text-xs text-slate-500 font-mono">{lang || "code"}</span>
      </div>
      <pre className="bg-black/50 p-3 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-white mt-4 mb-1.5 leading-snug">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-white mt-3 mb-1 leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold text-white mt-2.5 mb-1 leading-snug">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-bold text-white mt-2 mb-0.5">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-1 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-300">{children}</em>
  ),
  ul: ({ children }) => (
    <OrderedCtx.Provider value={false}>
      <ul className="my-1.5 space-y-0.5 list-none pl-0">{children}</ul>
    </OrderedCtx.Provider>
  ),
  ol: ({ children, node }) => {
    const start = (node as any)?.properties?.start ?? 1;
    return (
      <OrderedCtx.Provider value={true}>
        <ol
          start={start}
          className="my-1.5 space-y-0.5 list-decimal pl-5 marker:text-primary marker:font-semibold"
        >
          {children}
        </ol>
      </OrderedCtx.Provider>
    );
  },
  li: ({ children }) => {
    const ordered = useContext(OrderedCtx);
    if (ordered) {
      return (
        <li className="my-0.5 pl-1">
          <span className="flex-1">{children}</span>
        </li>
      );
    }
    return (
      <li className="flex items-start gap-1.5 my-0.5">
        <span className="text-primary mt-1 shrink-0 leading-none">•</span>
        <span className="flex-1">{children}</span>
      </li>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary pl-3 text-muted-foreground italic my-1.5">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-white/10 my-3" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse border border-white/15 rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/8">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-white/10">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-white border-r border-white/10 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 border-r border-white/10 last:border-r-0">{children}</td>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ children, className }) => {
    const match = /language-(\w+)/.exec(className || "");
    if (match || className?.startsWith("language-")) {
      return (
        <CodeBlock
          lang={match?.[1] || ""}
          value={String(children).replace(/\n$/, "")}
        />
      );
    }
    const str = String(children);
    if (str.includes("\n")) {
      return <CodeBlock lang="" value={str.replace(/\n$/, "")} />;
    }
    return (
      <code className="bg-white/10 rounded px-1 py-0.5 font-mono text-xs text-emerald-300">
        {children}
      </code>
    );
  },
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    const isPlaceholder = !src || src.includes("placeholder.com") || src.includes("via.placeholder") || src.includes("placehold.it");
    if (isPlaceholder) {
      return (
        <span className="flex items-center gap-2 my-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          <span>⚠️</span>
          <span>ИИ сгенерировал ссылку-заглушку вместо диаграммы. При регенерации раздела диаграмма появится корректно.</span>
        </span>
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        className="my-3 rounded-xl border border-white/10 max-w-full h-auto"
      />
    );
  },
};

// ── Main export ───────────────────────────────────────────────────────────
export function RenderMessage({ content }: { content: string }) {
  const segments = segmentContent(content);

  return (
    <div className="text-sm leading-relaxed text-foreground">
      {segments.map((seg, idx) => {
        if (seg.kind === "block") {
          return <KaTeXBlock key={idx} formula={seg.formula} />;
        }
        if (seg.kind === "inline") {
          return <KaTeXInline key={idx} formula={seg.formula} />;
        }
        // Plain text segment → ReactMarkdown for markdown features
        return (
          <ReactMarkdown
            key={idx}
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {seg.value}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
