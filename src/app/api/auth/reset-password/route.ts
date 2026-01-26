import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find and validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'El enlace no es válido o ya fue utilizado' },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'El enlace ha expirado. Solicitá uno nuevo.' },
        { status: 400 }
      );
    }

    // Find user by email
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const user = usersData?.users?.find(
      u => u.email?.toLowerCase() === tokenData.email.toLowerCase()
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 400 }
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar la contraseña' },
        { status: 500 }
      );
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in reset-password:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
