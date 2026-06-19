import { looksLikeHtml } from '@/lib/messageBody';

type Props = {
  body: string;
  className?: string;
};

export function MessageBody({ body, className = '' }: Props) {
  if (looksLikeHtml(body)) {
    return (
      <div
        className={`prose prose-sm max-w-none leading-relaxed text-zinc-700 [&_a]:text-violet-600 [&_a]:underline hover:[&_a]:text-violet-800 ${className}`}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    );
  }

  return (
    <div className={`whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 ${className}`}>
      {body}
    </div>
  );
}
