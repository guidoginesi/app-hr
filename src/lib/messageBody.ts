export function getMessageBodyPlainText(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isMessageBodyEmpty(body: string): boolean {
  return getMessageBodyPlainText(body).length === 0;
}

export function looksLikeHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body);
}
