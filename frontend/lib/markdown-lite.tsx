"use client";

import * as React from "react";
import Link from "next/link";

function renderBold(text: string, key: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}
    </React.Fragment>
  );
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length > 0) {
    const m = LINK_RE.exec(rest);
    if (!m || m.index === undefined) {
      nodes.push(renderBold(rest, `${keyPrefix}-${i++}`));
      break;
    }
    if (m.index > 0) nodes.push(renderBold(rest.slice(0, m.index), `${keyPrefix}-${i++}`));
    const [full, label, target] = m;
    const href = /^https?:\/\//.test(target) ? target : `/knowledge/${target}`;
    nodes.push(
      <Link
        key={`${keyPrefix}-${i++}`}
        href={href}
        className="text-brand-green underline underline-offset-2 hover:text-brand-green-hover"
      >
        {label}
      </Link>
    );
    rest = rest.slice(m.index + full.length);
  }
  return nodes;
}

/** Renders the markdown-lite body used by KnowledgeItem.body: "## " headers,
 * "- " bullets, ```fenced``` blocks, [SCREENSHOT: caption] placeholders,
 * [text](slug) internal links and **bold**. Pass `renderBullet` to swap
 * plain bullets for something else (e.g. an interactive checklist item). */
export function MarkdownLite({
  text,
  renderBullet,
}: {
  text: string;
  renderBullet?: (content: string, index: number) => React.ReactNode;
}) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let codeBuffer: string[] | null = null;
  let bulletIndex = 0;

  function flushBullets() {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-3 space-y-2 pl-1">
        {items.map((b, i) =>
          renderBullet ? (
            <li key={i} className="list-none">
              {renderBullet(b, bulletIndex++)}
            </li>
          ) : (
            <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-fg">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink" />
              <span>{renderInline(b, `b${i}`)}</span>
            </li>
          )
        )}
      </ul>
    );
    bulletBuffer = [];
  }

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (line.startsWith("```")) {
      if (codeBuffer === null) {
        flushBullets();
        codeBuffer = [];
      } else {
        blocks.push(
          <pre
            key={`code-${idx}`}
            className="my-3 overflow-x-auto rounded-control bg-bg px-4 py-3 text-[13px] text-fg"
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = null;
      }
      return;
    }
    if (codeBuffer !== null) {
      codeBuffer.push(raw);
      return;
    }
    if (!line) return;
    if (line.startsWith("## ")) {
      flushBullets();
      blocks.push(
        <h2 key={`h-${idx}`} className="mt-6 text-[19px] font-bold text-ink first:mt-0">
          {line.slice(3)}
        </h2>
      );
      return;
    }
    if (line.startsWith("- ")) {
      bulletBuffer.push(line.slice(2));
      return;
    }
    const shot = line.match(/^\[SCREENSHOT:\s*(.+)\]$/);
    if (shot) {
      flushBullets();
      blocks.push(
        <div
          key={`shot-${idx}`}
          className="my-3 flex h-40 items-center justify-center rounded-control border-2 border-dashed border-border bg-bg px-4 text-center text-[13px] text-muted"
        >
          {shot[1]}
        </div>
      );
      return;
    }
    flushBullets();
    blocks.push(
      <p key={`p-${idx}`} className="mt-3 text-[14px] leading-relaxed text-fg first:mt-0">
        {renderInline(line, `p${idx}`)}
      </p>
    );
  });
  flushBullets();

  return <div>{blocks}</div>;
}
