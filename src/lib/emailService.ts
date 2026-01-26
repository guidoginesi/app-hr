import { Resend } from 'resend';
import { getSupabaseServer } from './supabaseServer';

// Lazy initialization: solo crear la instancia cuando se use
let resendInstance: Resend | null = null;

function getResend(): Resend {
	if (!resendInstance) {
		const apiKey = process.env.RESEND_API_KEY;
		if (!apiKey) {
			throw new Error('RESEND_API_KEY is not configured');
		}
		resendInstance = new Resend(apiKey);
	}
	return resendInstance;
}

type EmailTemplate = {
	id: string;
	template_key: string;
	subject: string;
	body: string;
	variables: string[];
	is_active: boolean;
};

type SendEmailParams = {
	templateKey: string;
	to: string;
	variables: Record<string, string>;
	applicationId: string;
};

/**
 * Reemplaza variables en el template con valores reales
 */
function replaceVariables(text: string, variables: Record<string, string>): string {
	let result = text;
	for (const [key, value] of Object.entries(variables)) {
		const regex = new RegExp(`{{${key}}}`, 'g');
		result = result.replace(regex, value || '');
	}
	return result;
}

/**
 * Verifica si ya se envió un email con este template para esta aplicación
 */
async function hasEmailBeenSent(applicationId: string, templateKey: string): Promise<boolean> {
	const supabase = getSupabaseServer();
	const { data } = await supabase
		.from('email_logs')
		.select('id')
		.eq('application_id', applicationId)
		.eq('template_key', templateKey)
		.maybeSingle();
	
	return !!data;
}

/**
 * Registra el envío de un email en la base de datos
 */
async function logEmail(params: {
	applicationId: string;
	candidateEmail: string;
	templateKey: string;
	subject: string;
	body: string;
	error?: string;
	metadata?: Record<string, any>;
}) {
	const supabase = getSupabaseServer();
	await supabase.from('email_logs').insert({
		application_id: params.applicationId,
		candidate_email: params.candidateEmail,
		template_key: params.templateKey,
		subject: params.subject,
		body: params.body,
		error: params.error || null,
		metadata: params.metadata || {}
	});
}

/**
 * Obtiene una plantilla de email desde la base de datos
 */
async function getEmailTemplate(templateKey: string): Promise<EmailTemplate | null> {
	const supabase = getSupabaseServer();
	const { data, error } = await supabase
		.from('email_templates')
		.select('*')
		.eq('template_key', templateKey)
		.single();
	
	if (error || !data) {
		console.error('Error fetching email template:', error);
		return null;
	}
	
	return data as EmailTemplate;
}

/**
 * Envía un email usando una plantilla
 */
export async function sendTemplatedEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
	try {
		// Verificar si ya se envió este email
		const alreadySent = await hasEmailBeenSent(params.applicationId, params.templateKey);
		if (alreadySent) {
			console.log(`Email ${params.templateKey} already sent for application ${params.applicationId}`);
			return { success: true, error: 'Email already sent' };
		}

		// Obtener la plantilla
		const template = await getEmailTemplate(params.templateKey);
		if (!template) {
			const error = `Template ${params.templateKey} not found`;
			console.error(error);
			await logEmail({
				applicationId: params.applicationId,
				candidateEmail: params.to,
				templateKey: params.templateKey,
				subject: 'Error',
				body: '',
				error
			});
			return { success: false, error };
		}

		// Verificar si el template está activo
		if (!template.is_active) {
			console.log(`Email ${params.templateKey} is disabled, skipping send`);
			return { success: true, error: 'Email template disabled' };
		}

		// Reemplazar variables en subject y body
		const subject = replaceVariables(template.subject, params.variables);
		const body = replaceVariables(template.body, params.variables);

		// Enviar email con Resend
		const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
		const resend = getResend();
		
		const { data, error } = await resend.emails.send({
			from: fromEmail,
			to: params.to,
			subject,
			html: body,
		});

		if (error) {
			console.error('Error sending email with Resend:', error);
			await logEmail({
				applicationId: params.applicationId,
				candidateEmail: params.to,
				templateKey: params.templateKey,
				subject,
				body,
				error: error.message
			});
			return { success: false, error: error.message };
		}

		// Registrar envío exitoso
		await logEmail({
			applicationId: params.applicationId,
			candidateEmail: params.to,
			templateKey: params.templateKey,
			subject,
			body,
			metadata: { resend_id: data?.id }
		});

		console.log(`Email sent successfully: ${params.templateKey} to ${params.to}`);
		return { success: true };

	} catch (error: any) {
		console.error('Error in sendTemplatedEmail:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Obtiene todas las plantillas disponibles
 */
export async function getAllEmailTemplates(): Promise<EmailTemplate[]> {
	const supabase = getSupabaseServer();
	const { data, error } = await supabase
		.from('email_templates')
		.select('*')
		.order('template_key');
	
	if (error) {
		console.error('Error fetching email templates:', error);
		return [];
	}
	
	return (data || []) as EmailTemplate[];
}

/**
 * Actualiza una plantilla de email
 */
export async function updateEmailTemplate(
	templateKey: string,
	updates: { subject?: string; body?: string; is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
	try {
		const supabase = getSupabaseServer();
		const { error } = await supabase
			.from('email_templates')
			.update({
				...updates,
				updated_at: new Date().toISOString()
			})
			.eq('template_key', templateKey);
		
		if (error) {
			console.error('Error updating email template:', error);
			return { success: false, error: error.message };
		}
		
		return { success: true };
	} catch (error: any) {
		console.error('Error in updateEmailTemplate:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Envía un email simple (sin template de BD)
 */
export async function sendSimpleEmail(params: {
	to: string;
	subject: string;
	html: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
		const resend = getResend();
		
		console.log('[sendSimpleEmail] Sending email:', {
			from: fromEmail,
			to: params.to,
			subject: params.subject,
		});
		
		const { data, error } = await resend.emails.send({
			from: fromEmail,
			to: params.to,
			subject: params.subject,
			html: params.html,
		});

		if (error) {
			console.error('[sendSimpleEmail] Error sending email with Resend:', error);
			return { success: false, error: error.message };
		}

		console.log('[sendSimpleEmail] Email sent successfully, Resend ID:', data?.id);
		return { success: true };
	} catch (error: any) {
		console.error('[sendSimpleEmail] Exception:', error);
		return { success: false, error: error.message };
	}
}

