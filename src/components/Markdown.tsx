'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return '';
}

function languageOf(node: React.ReactNode): string | null {
  const child = React.Children.toArray(node)[0];
  if (!React.isValidElement<{ className?: string }>(child)) return null;
  return /language-([\w+#-]+)/.exec(child.props.className ?? '')?.[1] ?? null;
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (e.g. insecure context)
    }
  };

  return (
    <div className='my-4 overflow-hidden rounded-sm border border-line bg-code text-code-ink'>
      <div className='flex items-center justify-between border-b border-line px-3 py-1 text-xs text-mute'>
        <span># {languageOf(children) ?? 'kode'}</span>
        <button
          type='button'
          onClick={copy}
          className='transition hover:text-accent'
        >
          [{copied ? 'tersalin' : 'salin'}]
        </button>
      </div>
      <pre className='overflow-x-auto p-3 text-[13px] leading-relaxed'>
        {children}
      </pre>
    </div>
  );
}

const heading = ({ children }: { children?: React.ReactNode }) => (
  <div
    role='heading'
    aria-level={3}
    className='mt-5 mb-1 font-semibold before:text-mute before:content-["##_"] first:mt-0'
  >
    {children}
  </div>
);

export default function Markdown({ children }: { children: string }) {
  return (
    <div className='text-[13.5px] leading-6 wrap-break-word [&_a]:text-info [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:text-mute [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:bg-line/60 [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:text-info [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_p]:first:mt-0 [&_p]:last:mb-0 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-ink/30 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          h1: heading,
          h2: heading,
          h3: heading,
          h4: heading,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
