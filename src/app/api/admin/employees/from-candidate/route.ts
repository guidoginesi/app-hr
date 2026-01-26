import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, addUserRole } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const ConvertCandidateSchema = z.object({
  application_id: z.string().uuid('ID de aplicación inválido'),
  legal_entity_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  hire_date: z.string().optional().nullable(),
  work_email: z.string().email().optional().nullable(),
  create_user_account: z.boolean().default(false),
});

// POST /api/admin/employees/from-candidate - Convert a hired candidate to employee
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ConvertCandidateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get the application with candidate info
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select(`
        id,
        final_outcome,
        candidate:candidates(
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', parsed.data.application_id)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Verify the candidate was hired
    if (application.final_outcome !== 'HIRED') {
      return NextResponse.json(
        { error: 'Solo se pueden convertir candidatos con estado HIRED' },
        { status: 400 }
      );
    }

    const candidateData = application.candidate as unknown as {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    }[] | { id: string; name: string; email: string; phone: string | null };
    
    const candidate = Array.isArray(candidateData) ? candidateData[0] : candidateData;

    // Check if an employee already exists for this application
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('application_id', parsed.data.application_id)
      .maybeSingle();

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Este candidato ya fue convertido a empleado' },
        { status: 400 }
      );
    }

    // Also check by email
    const { data: existingByEmail } = await supabase
      .from('employees')
      .select('id')
      .eq('personal_email', candidate.email)
      .maybeSingle();

    if (existingByEmail) {
      return NextResponse.json(
        { error: 'Ya existe un empleado con este email' },
        { status: 400 }
      );
    }

    // Parse candidate name into first/last name
    const nameParts = candidate.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create the employee record
    const employeeData = {
      first_name: firstName,
      last_name: lastName,
      personal_email: candidate.email,
      work_email: parsed.data.work_email || null,
      legal_entity_id: parsed.data.legal_entity_id || null,
      department_id: parsed.data.department_id || null,
      manager_id: parsed.data.manager_id || null,
      application_id: parsed.data.application_id,
      status: 'active' as const,
      hire_date: parsed.data.hire_date || new Date().toISOString().split('T')[0],
    };

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single();

    if (empError) {
      console.error('Error creating employee:', empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    // Optionally create a user account for the employee
    if (parsed.data.create_user_account) {
      try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: candidate.email,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        });

        if (authError) {
          console.error('Error creating user account:', authError);
          // Don't fail the whole operation, just log the error
        } else if (authData.user) {
          // Update employee with user_id
          await supabase
            .from('employees')
            .update({ user_id: authData.user.id })
            .eq('id', employee.id);

          // Add employee role
          await addUserRole(authData.user.id, 'employee');

          // Send password reset email so user can set their password
          await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: candidate.email,
          });
        }
      } catch (authErr) {
        console.error('Error in auth setup:', authErr);
        // Continue without failing
      }
    }

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/employees/from-candidate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
