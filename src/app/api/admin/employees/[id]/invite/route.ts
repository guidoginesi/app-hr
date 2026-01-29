import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail } from '@/lib/emailService';
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

    // Check if already has user
    if (employee.user_id) {
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

    // If new user, generate password reset token and send welcome email via Resend
    if (isNewUser) {
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
        // Non-fatal, user was created but email won't be sent
      } else {
        // Build setup URL (uses same reset-password page)
        // APP_URL for server-side (runtime), NEXT_PUBLIC_APP_URL for client (build time)
        const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
        const setupUrl = `${baseUrl}/auth/reset-password?token=${token}`;

        // Send welcome email via Resend
        const { success, error: emailError } = await sendSimpleEmail({
          to: email,
          subject: 'Bienvenido al Portal HR - Configura tu contraseña',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido/a al Portal HR!</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
                <p>Hola <strong>${employee.first_name}</strong>,</p>
                <p>Se ha creado tu cuenta en el Portal HR. Para comenzar a usarlo, necesitás configurar tu contraseña.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${setupUrl}" style="background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                    Configurar mi contraseña
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">Este enlace expira en 7 días.</p>
                <p style="color: #666; font-size: 14px;">Una vez configurada tu contraseña, podrás ingresar al portal con tu email: <strong>${email}</strong></p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">
                  Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
                  <a href="${setupUrl}" style="color: #7c3aed; word-break: break-all;">${setupUrl}</a>
                </p>
              </div>
            </body>
            </html>
          `,
        });

        if (!success) {
          console.error('Error sending invite email:', emailError);
          // Non-fatal, user was created
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: existingUser 
        ? 'Empleado vinculado al portal exitosamente' 
        : 'Invitación enviada exitosamente'
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/employees/[id]/invite:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
