import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail } from '@/lib/email/layout';
import crypto from 'crypto';

const RequestResetSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestResetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const { email } = parsed.data;

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user exists in auth.users
    const { data: allUsers, error: userError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const user = allUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    console.log('[Password Reset] User lookup for:', email, {
      found: !!user,
      totalUsers: allUsers?.users?.length || 0,
      error: userError?.message || null
    });

    if (!user) {
      // Don't reveal if user exists - always return success
      console.log('[Password Reset] User not found, returning silent success');
      return NextResponse.json({ success: true });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate previous tokens for this email
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', email.toLowerCase())
      .is('used_at', null);

    // Store new token
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing reset token:', insertError);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    // Build reset URL - APP_URL for server-side (runtime), NEXT_PUBLIC_APP_URL for client (build time)
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    console.log('[Password Reset] Base URL:', baseUrl, {
      APP_URL: process.env.APP_URL || 'NOT SET',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
      origin: request.headers.get('origin') || 'NOT SET',
    });
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // Send email via Resend
    console.log('[Password Reset] Attempting to send email to:', email);
    console.log('[Password Reset] RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'NOT SET (using fallback)');
    
    const { success, error } = await sendSimpleEmail({
      to: email,
      subject: 'Restablecé tu contraseña',
      html: renderEmail({
        title: 'Restablecé tu contraseña',
        contextLabel: 'Portal · Seguridad',
        preheader: 'El enlace para restablecer tu contraseña vence en 1 hora.',
        intro:
          'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Hacé clic en el botón para crear una nueva. El enlace vence en 1 hora.',
        cta: { label: 'Restablecer contraseña', url: resetUrl },
        outro:
          'Si no solicitaste este cambio, ignorá este mail: tu contraseña actual sigue siendo válida.',
      }),
    });

    if (!success) {
      console.error('Error sending reset email:', error);
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in request-reset:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
