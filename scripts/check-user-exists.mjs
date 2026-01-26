#!/usr/bin/env node

/**
 * Script para verificar si un usuario existe en Supabase Auth
 * Uso: node scripts/check-user-exists.mjs agustina.marques@pow.la
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const email = process.argv[2];

if (!email) {
  console.error('Uso: node scripts/check-user-exists.mjs <email>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUser() {
  console.log(`\nBuscando usuario: ${email}\n`);
  
  // Buscar en auth.users
  const { data: allUsers, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  
  if (error) {
    console.error('Error al buscar usuarios:', error);
    process.exit(1);
  }
  
  const user = allUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (user) {
    console.log('✅ Usuario ENCONTRADO en Supabase Auth:');
    console.log({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
    });
  } else {
    console.log('❌ Usuario NO ENCONTRADO en Supabase Auth');
    console.log(`\nTotal de usuarios en auth: ${allUsers?.users?.length || 0}`);
    
    // Buscar usuarios similares
    const similar = allUsers?.users?.filter(u => 
      u.email?.toLowerCase().includes('agustina') || 
      u.email?.toLowerCase().includes('marques')
    );
    
    if (similar && similar.length > 0) {
      console.log('\nUsuarios con nombre similar:');
      similar.forEach(u => console.log(`  - ${u.email}`));
    }
  }
  
  // También verificar en la tabla employees
  console.log('\n--- Verificando en tabla employees ---');
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, email, name, auth_user_id')
    .ilike('email', email)
    .maybeSingle();
  
  if (empError) {
    console.error('Error al buscar en employees:', empError);
  } else if (employee) {
    console.log('✅ Empleado ENCONTRADO en tabla employees:');
    console.log(employee);
    
    if (!employee.auth_user_id) {
      console.log('\n⚠️  PROBLEMA: El empleado NO tiene auth_user_id vinculado');
      console.log('   Esto significa que no puede hacer login ni recuperar contraseña.');
    }
  } else {
    console.log('❌ Empleado NO ENCONTRADO en tabla employees');
  }
}

checkUser();
