// Enterprise Automated Test Runner
// Remediates DEV-01: Native TypeScript test execution with node:test & node:assert

const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// 1. Load .env.local if present
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// 2. Register TypeScript loader
require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  });
  module._compile(compiled.outputText, filename);
};

// 2. Discover all *.test.ts files in tests directory
const testsDir = path.join(__dirname, '..', 'tests');
const testFiles = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => path.join(testsDir, f));

console.log(`\n======================================================`);
console.log(`ENTERPRISE TEST SUITE RUNNER (DEV-01)`);
console.log(`Discovered ${testFiles.length} test suites in tests/`);
console.log(`======================================================\n`);

// 3. Execute all test suites
for (const file of testFiles) {
  console.log(`▶ Executing: ${path.basename(file)}`);
  require(file);
}
