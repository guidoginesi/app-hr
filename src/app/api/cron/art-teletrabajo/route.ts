import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import {
  findDeparturesStartingOn,
  findReturnsEndingOn,
} from '@/lib/artTeletrabajo/roster';
import { sendArtTeletrabajoNotification } from '@/lib/artTeletrabajo/sendNotification';
import { addDaysToDateString, getArgentinaDateString } from '@/lib/artTeletrabajo/timezone';

// Vercel Cron: 7:00 AM Argentina (UTC-3) → 10:00 UTC
// vercel.json: { "path": "/api/cron/art-teletrabajo", "schedule": "0 10 * * *" }

function authorizeCron(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET?.trim();
  // Falla cerrado: sin secreto configurado el endpoint queda expuesto a internet
  // (y estos crons mandan mails), así que preferimos no ejecutar.
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET no está configurado: se rechaza la ejecución.');
    return false;
  }
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const today = getArgentinaDateString();
  const tomorrow = addDaysToDateString(today, 1);
  const yesterday = addDaysToDateString(today, -1);

  const results: Record<string, unknown> = {
    ok: true,
    today,
    sent: [] as unknown[],
    skipped: [] as unknown[],
    errors: [] as string[],
  };

  try {
    const departures = await findDeparturesStartingOn(supabase, tomorrow);
    if (departures.length > 0) {
      try {
        const result = await sendArtTeletrabajoNotification({
          supabase,
          notificationType: 'pre_departure',
          triggerDate: today,
          rosterDate: tomorrow,
          triggers: departures,
        });
        if (result.skipped) {
          (results.skipped as unknown[]).push({ type: 'pre_departure', ...result });
        } else {
          (results.sent as unknown[]).push({ type: 'pre_departure', ...result, triggers: departures });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        (results.errors as string[]).push(`pre_departure: ${message}`);
      }
    }

    const returns = await findReturnsEndingOn(supabase, yesterday);
    if (returns.length > 0) {
      try {
        const result = await sendArtTeletrabajoNotification({
          supabase,
          notificationType: 'post_return',
          triggerDate: today,
          rosterDate: today,
          triggers: returns,
        });
        if (result.skipped) {
          (results.skipped as unknown[]).push({ type: 'post_return', ...result });
        } else {
          (results.sent as unknown[]).push({ type: 'post_return', ...result, triggers: returns });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        (results.errors as string[]).push(`post_return: ${message}`);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    (results.errors as string[]).push(message);
    results.ok = false;
  }

  return NextResponse.json(results);
}
