'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetTrigger, SheetContent } from '@pow/ui/components/ui/sheet';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { NewTimeOffRequestForm } from './new/NewTimeOffRequestForm';

// Botón "Nueva solicitud" que abre el form en un Sheet (panel lateral),
// sin salir de la lista de Time Off. Patrón de creación del DS.
export function NewRequestButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={buttonVariants({ variant: 'primary' })}>Nueva solicitud</SheetTrigger>
      <SheetContent
        title="Nueva solicitud"
        description="Solicita vacaciones, días Pow, trabajo remoto u otras licencias"
        className="sm:max-w-xl"
      >
        <NewTimeOffRequestForm
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
