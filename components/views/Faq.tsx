"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { FaqSection } from "@/lib/faq";

/* ---------- Frequently asked questions ----------
   Shared by the team app and the sponsor portal; each passes its own
   questions (lib/faq.ts) and its own words for the chrome around them.
   Questions are native <details>, so they open with keyboard and screen
   readers without any state of ours. A search opens every match. */

export interface FaqLabels {
  title: string;
  intro: string;
  search: string;
  noResults: string;
}

/* **label** → <strong>label</strong> */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/* Blank line = paragraph; "- " lines = bullets; "1. " lines = steps. A list
   may follow its lead-in sentence directly, without a blank line between. */
function Answer({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  for (const [b, block] of text.split(/\n\s*\n/).entries()) {
    const lines = block.split("\n");
    let para: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    const flush = () => {
      if (para.length) blocks.push(<p key={`${b}p${blocks.length}`}>{inline(para.join(" "))}</p>);
      if (list) {
        const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
        blocks.push(list.ordered ? <ol key={`${b}o${blocks.length}`}>{items}</ol> : <ul key={`${b}u${blocks.length}`}>{items}</ul>);
      }
      para = [];
      list = null;
    };
    for (const line of lines) {
      const bullet = /^- (.*)$/.exec(line);
      const step = /^\d+\. (.*)$/.exec(line);
      if (bullet || step) {
        const ordered = !!step;
        if (para.length || (list && list.ordered !== ordered)) flush();
        list ??= { ordered, items: [] };
        list.items.push((step || bullet)![1]);
      } else {
        if (list) flush();
        para.push(line);
      }
    }
    flush();
  }
  return <div className="gr-faq-a">{blocks}</div>;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\*\*/g, "");

export default function Faq({ sections, labels }: { sections: FaqSection[]; labels: FaqLabels }) {
  const [query, setQuery] = useState("");
  const words = norm(query).split(/\s+/).filter(Boolean);
  const matches = (q: string, a: string) => {
    const hay = norm(`${q} ${a}`);
    return words.every((w) => hay.includes(w));
  };
  const shown = sections
    .map((s) => ({ ...s, entries: s.entries.filter((e) => matches(e.q, e.a)) }))
    .filter((s) => s.entries.length > 0);

  return (
    <section className="gr-faq">
      <h2 className="gr-h2">{labels.title}</h2>
      <p className="gr-muted">{labels.intro}</p>
      <div className="gr-toolbar" style={{ marginTop: 16 }}>
        <input
          className="gr-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
        />
      </div>
      {shown.length === 0 && <p className="gr-muted">{labels.noResults}</p>}
      {shown.map((s) => (
        <div key={s.title} className="gr-faq-section">
          <h3 className="gr-subhead">{s.title}</h3>
          {s.entries.map((e) => (
            /* Keyed on the search too, so clearing it closes what the search opened. */
            <details key={`${e.q}|${words.length > 0}`} className="gr-faq-item" open={words.length > 0 || undefined}>
              <summary>{e.q}</summary>
              <Answer text={e.a} />
            </details>
          ))}
        </div>
      ))}
    </section>
  );
}
