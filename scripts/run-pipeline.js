#!/usr/bin/env node

/**
 * Manual pipeline runner - runs all tasks sequentially
 * Usage: npm run pipeline:test or node scripts/run-pipeline.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Logger utility
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Execute command with error handling
async function runCommand(command, name) {
  log(`\n${'='.repeat(50)}`);
  log(`Starting ${name}...`);
  log(`${'='.repeat(50)}`);

  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: __dirname + '/..',
      timeout: 600000, // 10 minutes timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    log(`✓ ${name} completed successfully in ${duration}s`);
    return { success: true, duration };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`✗ ${name} failed after ${duration}s`);
    console.error(`Error: ${error.message}`);

    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);

    return { success: false, duration, error: error.message };
  }
}

// Main pipeline function
async function runPipeline() {
  console.log('\n' + '='.repeat(60));
  console.log('  KPOP METRICS PIPELINE - MANUAL RUN');
  console.log('='.repeat(60));
  log('Starting manual pipeline execution...\n');

  const pipelineStartTime = Date.now();
  const results = {};

  // Define tasks
  const tasks = [
    { name: 'TikTok', command: 'npm run tiktok' },
    { name: 'Facebook', command: 'npm run fb' },
    { name: 'SNS Followers', command: 'npm run sns:followers' },
    { name: 'Zalo', command: 'npm run zalo' }
  ];

  // Run tasks sequentially
  for (const task of tasks) {
    results[task.name] = await runCommand(task.command, task.name);
  }

  // Summary
  const totalDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);
  const successCount = Object.values(results).filter(r => r.success).length;
  const failCount = tasks.length - successCount;

  console.log('\n' + '='.repeat(60));
  console.log('  PIPELINE SUMMARY');
  console.log('='.repeat(60));

  tasks.forEach(task => {
    const result = results[task.name];
    const status = result.success ? '✓ SUCCESS' : '✗ FAILED';
    const statusColor = result.success ? '\x1b[32m' : '\x1b[31m'; // Green or Red
    const resetColor = '\x1b[0m';

    console.log(`${statusColor}${status}${resetColor} | ${task.name.padEnd(20)} | ${result.duration}s`);
  });

  console.log('='.repeat(60));
  console.log(`Total: ${successCount} succeeded, ${failCount} failed`);
  console.log(`Total duration: ${totalDuration}s`);
  console.log('='.repeat(60) + '\n');

  // Exit with error code if any task failed
  if (failCount > 0) {
    process.exit(1);
  }
}

// Run pipeline
runPipeline().catch(error => {
  console.error('Pipeline execution failed:', error);
  process.exit(1);
});
