'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetTrigger, SheetContent } from '@pow/ui/components/ui/sheet';
import { buttonVariants } from '@pow/ui/components/ui/button';
import type { LeaveBalanceWithDetails, LeaveType } from '@/types/time-off';
import { NewTimeOffRequestForm } from './new/NewTimeOffRequestForm';

// Botón "Nueva solicitud" que abre el form en un Sheet (panel lateral),
// sin salir de la lista de Time Off. Patrón de creación del DS.
//
// Si la página le pasa los tipos y los saldos que ya leyó, el form abre listo
// en vez de esperar dos APIs con el spinner (igual las pide en segundo plano
// para refrescar). Sin ellos, como en Mi equipo, los pide como siempre.
export function NewRequestButton({
  initialLeaveTypes,
  initialBalances,
}: {
  initialLeaveTypes?: LeaveType[];
  initialBalances?: LeaveBalanceWithDetails[];
} = {}) {
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
        {/* px-1: aire para que el ring de foco de los inputs no se corte contra el overflow del Sheet */}
        <div className="px-1">
          <NewTimeOffRequestForm
            initialLeaveTypes={initialLeaveTypes}
            initialBalances={initialBalances}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
