import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { calculateEmployeeBonus } from '@/lib/calculateBonus';

type RouteContext = { params: Promise<{ employeeId: string }> };

// GET /api/admin/objectives/[employeeId]/bonus - Calculate bonus for an employee (admin view)
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employeeId } = await context.params;
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear() - 1;

    const supabase = getSupabaseServer();
    const result = await calculateEmployeeBonus(supabase, employeeId, year);

    if (!result) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Reshape to match original API response shape (backwards compatibility)
    return NextResponse.json({
      member: {
        id: result.member.id,
        name: result.member.name,
        seniority_level: result.member.seniority_level,
        effective_seniority_level: result.member.effective_seniority_level,
        hire_date: result.member.hire_date,
      },
      year: result.year,
      isCurrentYear: result.isCurrentYear,
      weights: result.weights,
      proRata: result.proRata,
      corporate: result.corporate,
      personal: result.personal,
      bonus: {
        companyComponent: result.bonus.companyComponent,
        personalComponent: result.bonus.personalComponent,
        totalPercentage: result.bonus.base,
        gateMet: result.bonus.gateMet,
        finalPercentage: result.bonus.final,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/objectives/[employeeId]/bonus:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
