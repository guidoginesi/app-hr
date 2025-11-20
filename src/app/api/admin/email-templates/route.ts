import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAdmin';
import { getAllEmailTemplates, updateEmailTemplate } from '@/lib/emailService';
import { z } from 'zod';

const UpdateTemplateSchema = z.object({
	templateKey: z.string().min(1),
	subject: z.string().min(1),
	body: z.string().min(1),
	is_active: z.boolean().optional()
});

export async function GET() {
	try {
		const { isAdmin } = await requireAdmin();
		if (!isAdmin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const templates = await getAllEmailTemplates();
		return NextResponse.json({ templates });
	} catch (error: any) {
		console.error('Error fetching email templates:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to fetch email templates' },
			{ status: 400 }
		);
	}
}

export async function PUT(req: NextRequest) {
	try {
		const { isAdmin } = await requireAdmin();
		if (!isAdmin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const parsed = UpdateTemplateSchema.parse(body);

		const result = await updateEmailTemplate(parsed.templateKey, {
			subject: parsed.subject,
			body: parsed.body,
			is_active: parsed.is_active
		});

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		return NextResponse.json({ success: true });
	} catch (error: any) {
		console.error('Error updating email template:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to update email template' },
			{ status: 400 }
		);
	}
}

