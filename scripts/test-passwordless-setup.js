/**
 * Test script to check passwordless auth setup
 * Run with: node scripts/test-passwordless-setup.js
 */

console.log('Checking environment variables...\n');

const required = {
  NINOX_API_KEY: process.env.NINOX_API_KEY,
  NINOX_TEAM_ID: process.env.NINOX_TEAM_ID,
  NINOX_DATABASE_ID: process.env.NINOX_DATABASE_ID,
};

let allPresent = true;

for (const [key, value] of Object.entries(required)) {
  const present = !!value;
  const icon = present ? '[ok]' : '[missing]';
  const display = present ? `${value.substring(0, 10)}...` : 'MISSING';
  console.log(`${icon} ${key}: ${display}`);

  if (!present) {
    allPresent = false;
  }
}

console.log(`\n${'='.repeat(60)}`);

if (!allPresent) {
  console.log('Some environment variables are missing.');
  console.log('\nFor local development, create a .env file with:');
  console.log(`
NINOX_API_KEY=your_key_here
NINOX_TEAM_ID=your_team_id
NINOX_DATABASE_ID=your_db_id
  `);
  process.exit(1);
}

console.log('All environment variables present.');
console.log('\nNext steps:');
console.log('1. Create Ninox fields in Gebruikers (P) table:');
console.log('   - Logincode (Text field)');
console.log('   - Logincode aangemaakt (Text field)');
console.log('2. Verify Azure mail settings in Ninox Configuratie are filled in');
console.log('3. Start dev server: npm run dev');
console.log('4. Try logging in with a test user');
console.log('\nSee docs/PASSWORDLESS_AUTH_SETUP.md for full instructions.');
