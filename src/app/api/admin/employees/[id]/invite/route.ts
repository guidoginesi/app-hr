import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail } from '@/lib/email/layout';
import crypto from 'crypto';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/employees/[id]/invite - Invite employee to portal
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Get employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Parse body for optional force resend
    let forceResend = false;
    try {
      const body = await req.json();
      forceResend = body?.force === true;
    } catch { /* no body */ }

    // If already has user and not forcing resend, return error
    if (employee.user_id && !forceResend) {
      return NextResponse.json({ error: 'El empleado ya tiene acceso al portal' }, { status: 400 });
    }

    // Use email (preferably work email, fallback to personal)
    const email = employee.work_email || employee.personal_email;

    // Create Supabase Admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user with this email already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // User exists, just link them
      userId = existingUser.id;
    } else {
      // Create new user (without password - they'll set it via the invite link)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: employee.first_name,
          last_name: employee.last_name,
        },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      userId = newUser.user.id;
      isNewUser = true;
    }

    // Update employee with user_id
    const { error: updateError } = await supabase
      .from('employees')
      .update({ user_id: userId })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating employee:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Add employee role
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'employee' }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Error adding role:', roleError);
      // Non-fatal, continue
    }

    // Send welcome email for new users OR when force-resending
    if (isNewUser || forceResend) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for invitations

      // Invalidate previous tokens for this email
      await supabaseAdmin
        .from('password_reset_tokens')
        .delete()
        .eq('email', email.toLowerCase())
        .is('used_at', null);

      // Store new token
      const { error: tokenError } = await supabaseAdmin
        .from('password_reset_tokens')
        .insert({
          email: email.toLowerCase(),
          token,
          expires_at: expiresAt.toISOString(),
        });

      if (tokenError) {
        console.error('Error storing invite token:', tokenError);
        return NextResponse.json({ 
          error: `El usuario fue creado pero no se pudo generar el token de acceso: ${tokenError.message}` 
        }, { status: 500 });
      }

      // Build setup URL
      const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
      const setupUrl = `${baseUrl}/auth/reset-password?token=${token}`;

      // Send welcome email via Resend
      const { success, error: emailError } = await sendSimpleEmail({
        to: email,
        subject: 'Bienvenido/a al portal de Pow — configurá tu contraseña',
        html: renderEmail({
          title: `¡Hola ${employee.first_name}! Bienvenido/a a Pow`,
          contextLabel: 'Portal · Acceso',
          badge: { tone: 'success', label: 'Cuenta creada' },
          preheader: 'Configurá tu contraseña para empezar a usar el portal.',
          intro:
            'Creamos tu cuenta en el portal de Pow. Para empezar a usarlo, configurá tu contraseña haciendo clic en el botón. El enlace vence en 7 días.',
          cta: { label: 'Configurar mi contraseña', url: setupUrl },
          outro: `Vas a ingresar al portal con tu email: ${email}`,
        }),
      });

      if (!success) {
        console.error('Error sending invite email:', emailError);
        return NextResponse.json({ 
          error: `El usuario fue creado y el token generado, pero el email no se pudo enviar: ${emailError}` 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: forceResend
        ? 'Email de acceso reenviado exitosamente'
        : existingUser 
          ? 'Empleado vinculado al portal exitosamente' 
          : 'Invitación enviada exitosamente'
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/employees/[id]/invite:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
