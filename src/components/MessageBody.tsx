import { looksLikeHtml } from '@/lib/messageBody';

type Props = {
  body: string;
  className?: string;
};

export function MessageBody({ body, className = '' }: Props) {
  if (looksLikeHtml(body)) {
    return (
      <div
        className={`prose prose-sm max-w-none leading-relaxed text-secondary-foreground [&_a]:text-cat-violet [&_a]:underline hover:[&_a]:text-cat-violet ${className}`}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    );
  }

  return (
    <div className={`whitespace-pre-wrap text-sm leading-relaxed text-secondary-foreground ${className}`}>
      {body}
    </div>
  );
}
