'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetTrigger, SheetContent } from '@pow/ui/components/ui/sheet';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { CertificateUploadForm } from './CertificateUploadForm';

// "Cargar certificado" que abre el form en un Sheet (panel lateral), sin navegar.
// Mismo patrón que "Nueva solicitud" de Time Off.
export function UploadCertificateButton({
  variant = 'outline',
  label = 'Cargar certificado',
}: {
  variant?: 'primary' | 'outline';
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={buttonVariants({ variant })}>{label}</SheetTrigger>
      <SheetContent
        title="Cargar certificado"
        description="Subí certificados médicos, de exámen o comprobantes de viaje"
        className="sm:max-w-xl"
      >
        {/* px-1: aire para que el ring de foco de los inputs no se corte contra el overflow del Sheet */}
        <div className="px-1">
          <CertificateUploadForm
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
