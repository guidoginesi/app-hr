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

/**
 * Convierte el HTML del editor al subconjunto que acepta un textParagraph de
 * una tarjeta de Chat (<b>, <i>, <u>, <a>, <br>): párrafos separados por una
 * línea en blanco, ítems de lista con viñeta y subtítulos en negrita.
 */
export function htmlToChatCardText(html: string): string {
  return (html ?? '')
    .replace(/<h[1-3][^>]*>/gi, '<b>')
    .replace(/<\/h[1-3]>/gi, '</b><br>')
    .replace(/<strong[^>]*>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    .replace(/<em[^>]*>/gi, '<i>')
    .replace(/<\/em>/gi, '</i>')
    .replace(/<li[^>]*>\s*(<p[^>]*>)?/gi, '• ')
    .replace(/(<\/p>)?\s*<\/li>/gi, '<br>')
    .replace(/<\/?(ul|ol|blockquote)[^>]*>/gi, '<br>')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '<br><br>')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>/gi, '<a href="$1">')
    // Fuera todo lo que Chat no reconoce (se mostraría como texto).
    .replace(/<(?!\/?(b|i|u|br|a)\b)[^>]+>/gi, '')
    .replace(/(<br>\s*){3,}/gi, '<br><br>')
    .replace(/^(\s*<br>)+|(<br>\s*)+$/gi, '')
    .trim();
}

/**
 * Mensaje con tarjeta: título, imagen (URL pública https) y texto. El webhook
 * no puede subir archivos adjuntos, pero sí mostrar una imagen por URL; las
 * carátulas de Comunicaciones viven en el bucket público message-images.
 * Va con `text` además de la tarjeta para que la notificación muestre algo.
 */
export async function sendGoogleChatCard(card: {
  title: string;
  imageUrl: string;
  imageAlt?: string;
  html?: string;
  fallbackText: string;
}): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[GoogleChat] GOOGLE_CHAT_WEBHOOK_URL not configured, skipping.');
    return;
  }
  const widgets: Record<string, unknown>[] = [
    { image: { imageUrl: card.imageUrl, altText: card.imageAlt ?? card.title } },
  ];
  if (card.html) widgets.push({ textParagraph: { text: card.html } });

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: card.fallbackText,
      cardsV2: [{ cardId: 'comunicado', card: { header: { title: card.title }, sections: [{ widgets }] } }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Chat webhook failed (${res.status}): ${body}`);
  }
}
