"use client";

/**
 * Página de PRUEBA del POW Design System en app-hr.
 * No toca ninguna pantalla existente. Renderiza un cross-section de componentes
 * + tokens para validar que el DS (instalado desde @guidoginesi/pow-ui, GitHub Packages) funciona acá.
 *
 * Las vars --background/--foreground se fijan inline en el wrapper para forzar
 * el look claro del DS aunque el SO esté en dark mode (app-hr define un @media dark).
 */

import { useState } from "react";
import { Button } from "@pow/ui/components/ui/button";
import { Badge } from "@pow/ui/components/ui/badge";
import { Stat } from "@pow/ui/components/ui/stat";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@pow/ui/components/ui/card";
import { PageHeader } from "@pow/ui/components/ui/page-header";
import { Dialog } from "@pow/ui/components/ui/dialog";
import { Input } from "@pow/ui/components/ui/input";
import { Select } from "@pow/ui/components/ui/select";
import { Checkbox } from "@pow/ui/components/ui/checkbox";
import { Switch } from "@pow/ui/components/ui/switch";
import { TabNav } from "@pow/ui/components/ui/tab-nav";
import { SegmentedControl } from "@pow/ui/components/ui/segmented-control";

export default function DsTestPage() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"resumen" | "detalle">("resumen");
  const [scale, setScale] = useState<"mes" | "trimestre" | "año">("mes");
  const [check, setCheck] = useState(true);
  const [sw, setSw] = useState(true);

  function fakeSave() {
    setSaving(true);
    setTimeout(() => setSaving(false), 1500);
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="POW Design System — prueba en app-hr"
          description="Componentes y tokens del paquete @pow/ui renderizados en HR. Si esto se ve bien, el DS es portable."
          actions={<Button variant="brand" onClick={() => setOpen(true)}>Abrir modal</Button>}
        />

        {/* KPIs / Stat */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Empleados activos" value="128" sub="+4 este mes" />
          <Stat label="Onboarding al día" value="92%" tone="success" trend={<Badge variant="success">OK</Badge>} />
          <Stat label="Evaluaciones por vencer" value="7" tone="warning" />
          <Stat label="Ausencias sin aprobar" value="3" tone="danger" onClick={() => setTab("detalle")} />
        </div>

        {/* Botones + Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Botones</CardTitle>
            <CardDescription>Variantes del DS. El primary es tinta; brand (naranja) es acento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="brand">Brand</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Eliminar</Button>
              <Button variant="primary" loading={saving} onClick={fakeSave}>Guardar</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="success">Aprobado</Badge>
              <Badge variant="warning">Pendiente</Badge>
              <Badge variant="destructive">Rechazado</Badge>
              <Badge variant="secondary">Borrador</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Navegación */}
        <Card>
          <CardHeader>
            <CardTitle>Navegación / toggles</CardTitle>
            <CardDescription>TabNav (subrayado naranja) y SegmentedControl (cápsula).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TabNav
              value={tab}
              onChange={setTab}
              options={[
                { value: "resumen", label: "Resumen" },
                { value: "detalle", label: "Detalle" },
              ]}
              aria-label="Vista"
            />
            <SegmentedControl
              value={scale}
              onChange={setScale}
              options={[
                { value: "mes", label: "Mes" },
                { value: "trimestre", label: "Trimestre" },
                { value: "año", label: "Año" },
              ]}
              aria-label="Escala"
            />
            <p className="text-sm text-muted-foreground">
              Tab activa: <strong className="text-foreground">{tab}</strong> · Escala: <strong className="text-foreground">{scale}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Controles de formulario</CardTitle>
            <CardDescription>Inputs, select y controles marcados en tinta (no el azul del SO).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Nombre del empleado" placeholder="Ej. Ana Pérez" helperText="Nombre y apellido." />
              <Select
                label="Departamento"
                placeholder="Seleccioná…"
                options={[
                  { value: "eng", label: "Ingeniería" },
                  { value: "people", label: "People" },
                  { value: "sales", label: "Ventas" },
                ]}
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={check} onCheckedChange={(v) => setCheck(Boolean(v))} />
                Contrato firmado
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={sw} onCheckedChange={setSw} />
                Notificaciones activas
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Modal del DS"
        description="Entrada/salida animadas, foco atrapado, cierre con afordancia — todo heredado del componente Dialog."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Este modal viene del paquete @pow/ui sin ninguna config extra en app-hr.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="brand" onClick={() => setOpen(false)}>Entendido</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
