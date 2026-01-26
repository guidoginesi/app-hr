import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { sendSimpleEmail } from '@/lib/emailService';
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

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // Send email via Resend
    console.log('[Password Reset] Attempting to send email to:', email);
    console.log('[Password Reset] RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'NOT SET (using fallback)');
    
    const { success, error } = await sendSimpleEmail({
      to: email,
      subject: 'Restablecer tu contraseña - HR App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Restablecer contraseña</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p>Hacé clic en el siguiente botón para crear una nueva contraseña:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                Restablecer contraseña
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Este enlace expira en 1 hora.</p>
            <p style="color: #666; font-size: 14px;">Si no solicitaste este cambio, podés ignorar este email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
              <a href="${resetUrl}" style="color: #7c3aed; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
        </body>
        </html>
      `,
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
