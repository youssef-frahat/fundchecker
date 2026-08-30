/**
 * Deployment Checker for Vercel
 * Runs ESLint check, TypeScript compilation check, and Next.js production build.
 */

const { spawnSync } = require('child_process');

function logStep(stepName) {
  console.log('\n====================================================');
  console.log(`STEP: ${stepName}`);
  console.log('====================================================');
}

function runCommand(command, args) {
  // Use shell: true to handle command routing properly across different platforms (Windows/Linux/macOS)
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  return result.status === 0;
}

function main() {
  console.log('🚀 Starting Vercel Deployment Checker...');
  console.log('----------------------------------------------------');

  // Step 1: ESLint Checks
  logStep('Running ESLint checks...');
  const eslintPassed = runCommand('npm', ['run', 'lint']);
  if (!eslintPassed) {
    console.error('\n❌ Deployment check failed at ESLint checks step!');
    process.exit(1);
  }
  console.log('✅ ESLint checks passed successfully!');

  // Step 1b: Automated Unit & Integration Tests (DEV-01)
  logStep('Running Automated Enterprise Test Suite...');
  const testsPassed = runCommand('node', ['scripts/run-tests.js']);
  if (!testsPassed) {
    console.error('\n❌ Deployment check failed at Automated Tests step!');
    process.exit(1);
  }
  console.log('✅ All 14 Automated Test Suites passed successfully!');

  // Step 2: TypeScript Checks
  logStep('Running TypeScript type checking...');
  const tscPassed = runCommand('npx', ['tsc', '--noEmit']);
  if (!tscPassed) {
    console.error('\n❌ Deployment check failed at TypeScript verification step!');
    process.exit(1);
  }
  console.log('✅ TypeScript verification passed successfully!');

  // Step 3: Production Build Checks
  logStep('Running Next.js production build...');
  const buildPassed = runCommand('npm', ['run', 'build']);
  if (!buildPassed) {
    console.error('\n❌ Deployment check failed at Next.js build step!');
    process.exit(1);
  }
  console.log('✅ Next.js production build compiled successfully!');

  console.log('\n====================================================');
  console.log('🎉 ALL DEPLOYMENT CHECKS PASSED SUCCESSFULLY!');
  console.log('✨ Your codebase is 100% ready for Vercel deployment.');
  console.log('====================================================\n');
  process.exit(0);
}

main();
