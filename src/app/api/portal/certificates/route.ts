import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CERTIFICATE_TYPES = ['exam', 'medical', 'travel_assistance'] as const;
type CertificateType = (typeof CERTIFICATE_TYPES)[number];

// GET /api/portal/certificates — list own certificates
export async function GET() {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('employee_certificates')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/certificates — upload a new certificate
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 });
    }

    if (!type || !CERTIFICATE_TYPES.includes(type as CertificateType)) {
      return NextResponse.json({ error: 'Tipo de certificado inválido' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const ext = file.name.split('.').pop() || 'pdf';
    const uniqueId = crypto.randomUUID();
    const storagePath = `${auth.employee.id}/${uniqueId}.${ext}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data, error: dbError } = await supabase
      .from('employee_certificates')
      .insert({
        employee_id: auth.employee.id,
        type,
        file_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        notes: notes?.trim() || null,
        uploaded_by: auth.user.id,
      })
      .select()
      .single();

    if (dbError) {
      // Try to clean up the uploaded file
      await supabase.storage.from('certificates').remove([storagePath]);
      console.error('DB insert error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/portal/certificates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
