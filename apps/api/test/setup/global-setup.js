const { execSync } = require('node:child_process');
const path = require('node:path');

/** Applies migrations to the test database once per run. */
module.exports = async function globalSetup() {
  require('./env');
  execSync('yarn prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
  });
};
