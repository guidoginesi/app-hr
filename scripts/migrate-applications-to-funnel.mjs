#!/usr/bin/env node

/**
 * Script de migración para actualizar aplicaciones existentes al nuevo modelo de funnel
 * 
 * Este script:
 * 1. Actualiza todas las aplicaciones existentes para usar el nuevo modelo
 * 2. Mapea el campo 'status' legacy a current_stage y current_stage_status
 * 3. Crea registros iniciales en stage_history
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mapeo de status legacy a nuevo modelo
const statusMapping = {
	'Recibido': { stage: 'CV_RECEIVED', status: 'PENDING' },
	'Analizado por IA': { stage: 'CV_RECEIVED', status: 'PENDING' },
	'Pendiente de Revisión HR': { stage: 'HR_REVIEW', status: 'PENDING' },
	'Descartado': { stage: 'CLOSED', status: 'DISCARDED_IN_STAGE', final_outcome: 'REJECTED_BY_POW' }
};

async function migrateApplications() {
	console.log('🔄 Iniciando migración de aplicaciones al nuevo modelo de funnel...\n');

	// Obtener todas las aplicaciones que no tienen current_stage
	const { data: applications, error: fetchError } = await supabase
		.from('applications')
		.select('id, status, created_at')
		.is('current_stage', null);

	if (fetchError) {
		console.error('❌ Error fetching applications:', fetchError);
		process.exit(1);
	}

	if (!applications || applications.length === 0) {
		console.log('✅ No hay aplicaciones para migrar');
		return;
	}

	console.log(`📊 Encontradas ${applications.length} aplicaciones para migrar\n`);

	let migrated = 0;
	let errors = 0;

	for (const app of applications) {
		try {
			const legacyStatus = app.status || 'Recibido';
			const mapping = statusMapping[legacyStatus] || statusMapping['Recibido'];

			// Actualizar la aplicación
			const updateData = {
				current_stage: mapping.stage,
				current_stage_status: mapping.status,
				updated_at: new Date().toISOString()
			};

			if (mapping.final_outcome) {
				updateData.final_outcome = mapping.final_outcome;
			}

			const { error: updateError } = await supabase
				.from('applications')
				.update(updateData)
				.eq('id', app.id);

			if (updateError) {
				console.error(`❌ Error updating application ${app.id}:`, updateError);
				errors++;
				continue;
			}

			// Crear registro en stage_history
			const { error: historyError } = await supabase
				.from('stage_history')
				.insert({
					application_id: app.id,
					from_stage: null,
					to_stage: mapping.stage,
					status: mapping.status,
					changed_by_user_id: null,
					notes: `Migrado automáticamente desde status legacy: ${legacyStatus}`,
					changed_at: app.created_at
				});

			if (historyError) {
				console.error(`⚠️  Error creating history for ${app.id}:`, historyError);
				// No fallamos si el historial falla, pero lo registramos
			}

			migrated++;
			if (migrated % 10 === 0) {
				console.log(`  ✅ Migradas ${migrated}/${applications.length} aplicaciones...`);
			}
		} catch (error) {
			console.error(`❌ Error processing application ${app.id}:`, error);
			errors++;
		}
	}

	console.log(`\n✅ Migración completada:`);
	console.log(`   - Migradas: ${migrated}`);
	console.log(`   - Errores: ${errors}`);
	console.log(`   - Total: ${applications.length}`);
}

migrateApplications()
	.then(() => {
		console.log('\n✨ Proceso finalizado');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Error fatal:', error);
		process.exit(1);
	});

