import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateLegalEntitySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  country: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

// GET /api/admin/legal-entities - List all legal entities
export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('legal_entities')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching legal entities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/legal-entities:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/legal-entities - Create a new legal entity
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateLegalEntitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('legal_entities')
      .select('id')
      .eq('name', parsed.data.name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una sociedad con este nombre' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('legal_entities')
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      console.error('Error creating legal entity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/legal-entities:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
