import React from 'react';

// =============================================================================
// MarkdownText — Lightweight inline markdown renderer (zero external deps)
// Supports: **bold**, *italic*, `code`, # headings, line breaks
// Designed for AI-generated clinical text — safe, no dangerouslySetInnerHTML.
// =============================================================================

interface MarkdownTextProps {
  content: string;
  className?: string;
}

// Parse a single line into React elements handling **bold**, *italic*, `code`
function parseLine(line: string, lineIdx: number): React.ReactNode {
  const segments: React.ReactNode[] = [];
  // Combined regex: **bold**, *italic*, `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segIdx = 0;

  while ((match = pattern.exec(line)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      segments.push(
        <span key={`${lineIdx}-t-${segIdx++}`}>
          {line.slice(lastIndex, match.index)}
        </span>
      );
    }

    if (match[2] !== undefined) {
      // **bold** — high-contrast slate-100 in dark, slate-900 in light
      segments.push(
        <strong
          key={`${lineIdx}-b-${segIdx++}`}
          className="font-semibold text-slate-900 dark:text-slate-100"
        >
          {match[2]}
        </strong>
      );
    } else if (match[3] !== undefined) {
      // *italic* — slate-700 light / slate-300 dark
      segments.push(
        <em
          key={`${lineIdx}-i-${segIdx++}`}
          className="italic text-slate-700 dark:text-slate-300"
        >
          {match[3]}
        </em>
      );
    } else if (match[4] !== undefined) {
      // `code`
      segments.push(
        <code
          key={`${lineIdx}-c-${segIdx++}`}
          className="font-mono text-[0.85em] bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded"
        >
          {match[4]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < line.length) {
    segments.push(
      <span key={`${lineIdx}-t-end`}>{line.slice(lastIndex)}</span>
    );
  }

  return segments.length > 0 ? segments : line;
}

export const MarkdownText: React.FC<MarkdownTextProps> = React.memo(({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');

  const nodes: React.ReactNode[] = [];
  let idx = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line → spacing
    if (trimmed === '') {
      nodes.push(<div key={`spacer-${idx}`} className="h-2" />);
      idx++;
      continue;
    }

    // Heading variants: ##, #
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    const hrMatch = trimmed.match(/^[-*_]{3,}$/);

    if (hrMatch) {
      nodes.push(
        <hr key={`hr-${idx}`} className="border-t border-slate-200 dark:border-white/10 my-2" />
      );
    } else if (h1Match) {
      nodes.push(
        <h4 key={`h1-${idx}`} className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider mt-3 mb-1 font-mono">
          {parseLine(h1Match[1], idx)}
        </h4>
      );
    } else if (h2Match) {
      nodes.push(
        <h5 key={`h2-${idx}`} className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-widest mt-2 mb-0.5 font-mono">
          {parseLine(h2Match[1], idx)}
        </h5>
      );
    } else if (bulletMatch) {
      nodes.push(
        <div key={`bullet-${idx}`} className="flex items-start gap-1.5 my-0.5">
          <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 dark:bg-indigo-500 shrink-0" />
          <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {parseLine(bulletMatch[1], idx)}
          </span>
        </div>
      );
    } else if (numberedMatch) {
      nodes.push(
        <div key={`num-${idx}`} className="flex items-start gap-2 my-0.5">
          <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 font-mono shrink-0 mt-0.5 w-4 text-right">
            {numberedMatch[1]}.
          </span>
          <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {parseLine(numberedMatch[2], idx)}
          </span>
        </div>
      );
    } else {
      // Regular paragraph line
      nodes.push(
        <p key={`p-${idx}`} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {parseLine(line, idx)}
        </p>
      );
    }

    idx++;
  }

  return (
    <div className={`markdown-text space-y-0.5 ${className}`}>
      {nodes}
    </div>
  );
});

MarkdownText.displayName = 'MarkdownText';
