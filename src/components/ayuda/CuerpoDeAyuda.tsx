/**
 * El cuerpo de un contenido de Ayuda, con estilos de lectura.
 *
 * Recibe HTML ya limpio (ver ayudaContenidosHtml.ts): el portal lo limpia al
 * mostrar y el admin lo usa para la vista previa del propio editor.
 *
 * Misma escala que el resto del portal: el texto en text-sm, como los
 * mensajes, y los títulos se distinguen por peso y color, no por tamaño —lo
 * que pide el DS—. Más grandes quedaban por encima del título del panel
 * lateral en el que se leen.
 *
 * Los estilos van acá y no con la clase `prose`: el plugin de tipografía no está
 * instalado, y sumarlo cambiaría también cómo se ven los mensajes ya enviados.
 */
export function CuerpoDeAyuda({ html }: { html: string }) {
  return (
    <div
      className={[
        'text-sm leading-relaxed text-secondary-foreground',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground',
        '[&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground',
        '[&_p]:my-2.5 [&_p:empty]:hidden',
        '[&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1',
        '[&_li>p]:my-0',
        '[&_a]:font-medium [&_a]:text-[var(--brand-strong)] [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs',
        '[&_hr]:my-5 [&_hr]:border-[var(--border)]',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
