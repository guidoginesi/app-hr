/**
 * Google Chat Webhook integration.
 * Requires GOOGLE_CHAT_WEBHOOK_URL env variable set to an Incoming Webhook URL
 * from a Google Chat Space (Space settings → Integrations → Webhooks).
 */

export async function sendGoogleChatMessage(text: string): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[GoogleChat] GOOGLE_CHAT_WEBHOOK_URL not configured, skipping.');
    return;
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Chat webhook failed (${res.status}): ${body}`);
  }
}
