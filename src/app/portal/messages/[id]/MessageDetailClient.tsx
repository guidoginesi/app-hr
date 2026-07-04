'use client';

import { useRouter } from 'next/navigation';
import { MessageView, type PortalMessage } from '@/components/messages/MessageView';

type Props = {
  recipientId: string;
  messageId: string;
  message: PortalMessage;
  initialReadAt: string | null;
  initialConfirmedAt: string | null;
};

export function MessageDetailClient({ messageId, message, initialConfirmedAt }: Props) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </button>

      <MessageView message={message} messageId={messageId} initialConfirmedAt={initialConfirmedAt} />
    </div>
  );
}
