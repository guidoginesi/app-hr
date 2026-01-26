import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Leer el archivo de migración
const migrationPath = join(__dirname, '..', 'db', 'migration-people-module.sql');
const migrationSql = readFileSync(migrationPath, 'utf-8');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           MIGRACIÓN: MÓDULO PEOPLE                             ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('\n📋 Copia el siguiente SQL y pégalo en Supabase SQL Editor:\n');
console.log('🔗 https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new\n');
console.log('═'.repeat(70));
console.log(migrationSql);
console.log('═'.repeat(70));
console.log('\n✅ Esta migración crea:');
console.log('   • Tabla legal_entities (Sociedades)');
console.log('   • Tabla departments (Departamentos)');
console.log('   • Tabla user_roles (Roles de usuario: admin, employee, leader)');
console.log('   • Tabla employees (Empleados)');
console.log('   • Vista employees_with_details');
console.log('   • Migra admins existentes a user_roles\n');
