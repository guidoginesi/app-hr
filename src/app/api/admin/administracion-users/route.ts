import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl } from '@/lib/email/layout';
import crypto from 'crypto';

const Schema = z.object({ email: z.string().email('Email inválido') });

// POST /api/admin/administracion-users  { email }
// Crea (o vincula) un usuario con perfil Administración (aprobador de adelantos)
// y le envía un link para configurar la contraseña. Solo admins completos.
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = Schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Buscar o crear el usuario de auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email);

    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createErr || !newUser?.user) {
        console.error('Error creating administracion user:', createErr);
        return NextResponse.json({ error: createErr?.message ?? 'No se pudo crear el usuario' }, { status: 500 });
      }
      userId = newUser.user.id;
    }

    // Asignar rol administracion
    const supabase = getSupabaseServer();
    const { error: roleErr } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'administracion' }, { onConflict: 'user_id,role' });
    if (roleErr) {
      console.error('Error assigning administracion role:', roleErr);
      return NextResponse.json({ error: roleErr.message }, { status: 500 });
    }

    // Token para configurar contraseña (7 días)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await supabaseAdmin.from('password_reset_tokens').delete().eq('email', email).is('used_at', null);
    const { error: tokenErr } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({ email, token, expires_at: expiresAt.toISOString() });
    if (tokenErr) {
      console.error('Error storing invite token:', tokenErr);
      return NextResponse.json({ error: `Usuario creado pero falló el token: ${tokenErr.message}` }, { status: 500 });
    }

    const setupUrl = `${getAppUrl()}/auth/reset-password?token=${token}`;
    const { success, error: emailErr } = await sendSimpleEmail({
      to: email,
      subject: 'Acceso a POW — Administración de Adelantos',
      html: renderEmail({
        title: 'Te dieron acceso a POW',
        contextLabel: 'Portal · Acceso',
        badge: { tone: 'success', label: 'Perfil Administración' },
        preheader: 'Configurá tu contraseña para aprobar adelantos.',
        intro:
          'Te crearon un acceso con perfil Administración para gestionar los adelantos de sueldo. Configurá tu contraseña para empezar. El enlace vence en 7 días.',
        cta: { label: 'Configurar mi contraseña', url: setupUrl },
        outro: `Vas a ingresar con tu email: ${email}`,
      }),
    });

    if (!success) {
      return NextResponse.json({ error: `Usuario y rol creados, pero el email no se envió: ${emailErr}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST /api/admin/administracion-users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
