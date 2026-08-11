'use client';

import { useState } from 'react';
import { buttonVariants } from '@pow/ui/components/ui/button';

/**
 * Campo de archivo con la piel del DS.
 *
 * El `<input type="file">` nativo se ve distinto en cada navegador y su botón
 * viene en el idioma del sistema: en el portal público aparecía un "Choose File"
 * en inglés en medio de un formulario en castellano, y con 42px de alto contra
 * los 32 del resto de los campos.
 *
 * El input real sigue estando (sr-only), así que el archivo viaja en el
 * FormData como siempre; lo que se ve es un label con estilo de botón. Un label
 * SÍ reenvía el clic a un input, a diferencia de un button.
 *
 * No lleva `required`: el navegador no puede enfocar un campo oculto para
 * mostrar su mensaje. La validación la hace el submit del formulario, que además
 * avisa mejor.
 */
export function FileField({
  id,
  name,
  label,
  accept,
  helper,
  required,
}: {
  id: string;
  name: string;
  label: string;
  accept: string;
  helper?: string;
  required?: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-secondary-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="flex items-center gap-3">
        <label
          htmlFor={id}
          className={buttonVariants({ variant: 'outline', className: 'cursor-pointer' })}
        >
          {fileName ? 'Cambiar archivo' : 'Elegir archivo'}
        </label>
        <span className={`min-w-0 truncate text-sm ${fileName ? 'text-foreground' : 'text-muted-foreground'}`}>
          {fileName ?? 'Ningún archivo elegido'}
        </span>
      </div>

      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />

      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
