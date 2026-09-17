import type { ReactNode } from 'react';

/**
 * A small Markdown renderer for model output.
 *
 * WHY NOT A LIBRARY. The full ones exist to render Markdown written by people,
 * where the long tail — reference links, footnotes, tables, HTML passthrough —
 * is the point. This renders what a chat model emits: paragraphs, fenced code,
 * lists, headings, and inline emphasis. Six constructs, about a hundred lines,
 * against a dependency tree that ships a parser, a plugin system and an HTML
 * sanitiser we would then have to keep current.
 *
 * WHY IT IS SAFE. It never produces HTML. Every branch returns React elements
 * built from text, so there is no `dangerouslySetInnerHTML` anywhere and no
 * path by which a model — or someone who got a model to repeat their input —
 * can inject markup. That is a property of the construction, not of a filter
 * that has to be right every time.
 *
 * What it does NOT do: tables, images, blockquotes, and links. Links are left
 * as text ON PURPOSE for now — an assistant with no tools cannot have visited
 * a URL, so rendering one as clickable would dress a guess up as a source.
 * Research is where citations live, and those are checked.
 */

export function Markdown({ text }: { text: string }) {
  return <>{renderBlocks(text)}</>;
}

function renderBlocks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Split on fenced code first: everything inside a fence is literal, so it
  // must be carved out before any inline rule gets to look at it.
  const parts = text.split(/```/);

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const newline = part.indexOf('\n');
      const language = newline === -1 ? part.trim() : part.slice(0, newline).trim();
      const code = newline === -1 ? '' : part.slice(newline + 1).replace(/\n$/, '');
      out.push(
        <pre
          key={`code-${index}`}
          className="my-3 overflow-x-auto rounded-xl bg-ink/[0.04] p-3 text-[13px] leading-relaxed"
        >
          {language ? (
            <span className="mb-1.5 block text-[11px] tracking-wider text-muted uppercase">
              {language}
            </span>
          ) : null}
          <code className="font-mono">{code}</code>
        </pre>,
      );
      return;
    }
    out.push(...renderProse(part, index));
  });

  return out;
}

function renderProse(text: string, key: number): ReactNode[] {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = (at: number): void => {
    if (!list) return;
    const items = list.items.map((item, i) => (
      <li key={i} className="ml-5 list-outside">
        {renderInline(item)}
      </li>
    ));
    out.push(
      list.ordered ? (
        <ol key={`ol-${key}-${at}`} className="my-2 list-decimal space-y-1">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${key}-${at}`} className="my-2 list-disc space-y-1">
          {items}
        </ul>
      ),
    );
    list = null;
  };

  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);

    if (bullet) {
      if (list && list.ordered) flushList(i);
      list ??= { ordered: false, items: [] };
      list.items.push(bullet[1] ?? '');
      return;
    }
    if (numbered) {
      if (list && !list.ordered) flushList(i);
      list ??= { ordered: true, items: [] };
      list.items.push(numbered[1] ?? '');
      return;
    }

    flushList(i);

    if (heading) {
      out.push(
        <p key={`h-${key}-${i}`} className="mt-4 mb-1 font-semibold tracking-tight first:mt-0">
          {renderInline(heading[2] ?? '')}
        </p>,
      );
      return;
    }
    if (line.trim() === '') return;

    out.push(
      <p key={`p-${key}-${i}`} className="my-2 leading-relaxed first:mt-0">
        {renderInline(line)}
      </p>,
    );
  });

  flushList(lines.length);
  return out;
}

/** `code`, **bold**, *italic*. One pass, longest marker first. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith('`')) {
      out.push(
        <code
          key={match.index}
          className="rounded bg-ink/[0.06] px-1 py-0.5 font-mono text-[0.9em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      out.push(
        <strong key={match.index} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}
