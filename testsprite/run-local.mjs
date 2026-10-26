import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const configPath = join(resolve(import.meta.dirname, '..'), '.testsprite', 'config.json');
let fileConfig = {};
try {
  await access(configPath);
  fileConfig = JSON.parse(await readFile(configPath, 'utf8'));
} catch {
  // Environment variables are the preferred CI/local override.
}

const projectId = process.env.TESTSPRITE_PROJECT_ID || fileConfig.projectId;
const port = process.env.TESTSPRITE_PORT || String(fileConfig.port || 5173);

if (!projectId) {
  console.error('Missing TESTSPRITE_PROJECT_ID. Create a TestSprite frontend project first and export its ID.');
  process.exit(2);
}

const repoRoot = resolve(import.meta.dirname, '..');
const sourceDir = join(repoRoot, '.testsprite', 'plans');
const tempDir = await mkdtemp(join(tmpdir(), 'testsprite-plans-'));

try {
  const plans = ['guest-launch.json', 'private-room.json', 'skin-and-nickname.json'];
  for (const planName of plans) {
    const source = await readFile(join(sourceDir, planName), 'utf8');
    const hydrated = source.replaceAll('__TESTSPRITE_PROJECT_ID__', projectId);
    await writeFile(join(tempDir, planName), hydrated, 'utf8');
  }

  const command = process.platform === 'win32' ? 'testsprite.cmd' : 'testsprite';
  const shell = process.platform === 'win32';

  const runTests = (testIds) => {
    const runChild = spawn(
      command,
      ['test', 'run', ...testIds, '--local', port, '--local-host', 'localhost', '--wait', '--output', 'json'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        shell,
        env: process.env,
      },
    );

    runChild.on('exit', (runCode, runSignal) => {
      if (runSignal) {
        process.kill(process.pid, runSignal);
        return;
      }
      process.exit(runCode ?? 1);
    });
  };

  const savedTestIds = projectId === fileConfig.projectId && Array.isArray(fileConfig.testIds)
    ? fileConfig.testIds
    : [];
  if (savedTestIds.length > 0) {
    runTests(savedTestIds);
  } else {
    const createChild = spawn(
      command,
      ['test', 'create-batch', '--plan-from-dir', tempDir, '--output', 'json'],
      {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell,
        env: process.env,
      },
    );

    let createStdout = '';
    let createStderr = '';
    createChild.stdout.on('data', (chunk) => {
      createStdout += chunk.toString();
    });
    createChild.stderr.on('data', (chunk) => {
      createStderr += chunk.toString();
    });

    createChild.on('exit', async (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (createStderr) process.stderr.write(createStderr);
      if (code !== 0) {
        if (createStdout) process.stdout.write(createStdout);
        process.exit(code ?? 1);
      }

      const jsonStart = createStdout.indexOf('{');
      if (jsonStart < 0) {
        console.error('TestSprite create-batch did not return JSON.');
        process.stdout.write(createStdout);
        process.exit(1);
      }

      let batch;
      try {
        batch = JSON.parse(createStdout.slice(jsonStart));
      } catch (error) {
        console.error('Could not parse TestSprite create-batch response:', error);
        process.stdout.write(createStdout);
        process.exit(1);
      }

      const testIds = (batch.results || [])
        .filter((result) => result.status === 'created' && result.testId)
        .map((result) => result.testId);

      if (testIds.length === 0) {
        console.error('TestSprite did not create any tests.');
        process.stdout.write(JSON.stringify(batch, null, 2));
        process.exit(1);
      }

      await writeFile(
        configPath,
        `${JSON.stringify({ ...fileConfig, projectId, port: Number(port), testIds }, null, 2)}\n`,
        'utf8',
      );
      runTests(testIds);
    });
  }
} finally {
  process.on('exit', () => {
    rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });
}
