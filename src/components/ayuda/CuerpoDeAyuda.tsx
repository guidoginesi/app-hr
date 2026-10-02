/**
 * El cuerpo de un contenido de Ayuda, con estilos de lectura.
 *
 * Recibe HTML ya limpio (ver ayudaContenidosHtml.ts): el portal lo limpia al
 * mostrar y el admin lo usa para la vista previa del propio editor.
 *
 * Los estilos van acá y no con la clase `prose`: el plugin de tipografía no está
 * instalado, y sumarlo cambiaría también cómo se ven los mensajes ya enviados.
 */
export function CuerpoDeAyuda({ html }: { html: string }) {
  return (
    <div
      className={[
        'text-[15px] leading-relaxed text-secondary-foreground',
        '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground first:[&_h2]:mt-0',
        '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground',
        '[&_p]:my-3 [&_p:empty]:hidden',
        '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
        '[&_li>p]:my-0',
        '[&_a]:font-medium [&_a]:text-[var(--brand-strong)] [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]',
        '[&_hr]:my-6 [&_hr]:border-[var(--border)]',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
