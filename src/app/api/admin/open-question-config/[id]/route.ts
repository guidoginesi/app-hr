import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/checkAuth';

const UpdateOpenQuestionSchema = z.object({
  question_key: z.string().min(1).max(50).regex(/^[a-z_]+$/, 'Solo letras minúsculas y guiones bajos').optional(),
  label_self: z.string().min(1).optional(),
  label_leader: z.string().min(1).optional(),
  description: z.union([z.string(), z.null()]).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// GET - Get single open question config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();
    
    const { data, error } = await supabase
      .from('evaluation_open_question_config')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching open question config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update open question config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateOpenQuestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('evaluation_open_question_config')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una pregunta con esa clave' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating open question config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete open question config
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from('evaluation_open_question_config')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting open question config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
