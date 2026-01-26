import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/checkAuth';

const CreateOpenQuestionSchema = z.object({
  question_key: z.string().min(1).max(50).regex(/^[a-z_]+$/, 'Solo letras minúsculas y guiones bajos'),
  label_self: z.string().min(1),
  label_leader: z.string().min(1),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
});

// GET - List all open question configs
export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('evaluation_open_question_config')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching open question config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new open question config
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateOpenQuestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get max sort_order if not provided
    let sortOrder = parsed.data.sort_order;
    if (sortOrder === undefined) {
      const { data: maxData } = await supabase
        .from('evaluation_open_question_config')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      sortOrder = (maxData?.sort_order || 0) + 1;
    }

    const { data, error } = await supabase
      .from('evaluation_open_question_config')
      .insert({
        ...parsed.data,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una pregunta con esa clave' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating open question config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
