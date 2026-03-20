// Script to run the currency constraint fix migration
// This script will execute the SQL to fix the merchant_products currency constraint

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the migration file
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260226000000_relax_currency_constraints.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('Currency Constraint Fix Script');
console.log('=============================');
console.log('');
console.log('This script will fix the merchant_products currency constraint to allow OUSD (4 characters).');
console.log('');
console.log('The migration SQL to be executed:');
console.log('---------------------------------');
console.log(migrationSQL);
console.log('');
console.log('To apply this fix:');
console.log('1. Make sure Docker is running');
console.log('2. Run: supabase start');
console.log('3. Run: supabase db push');
console.log('');
console.log('Or run the SQL directly against your database using:');
console.log('- psql command line tool');
console.log('- Supabase Dashboard SQL Editor');
console.log('- Any other PostgreSQL client');
console.log('');
console.log('The key changes:');
console.log('- Drops existing merchant_products_currency_check constraint');
console.log('- Adds new constraint allowing 2-10 character currency codes');
console.log('- This will allow OUSD (4 characters) to be used in merchant_products');
