import { spawnSync } from 'node:child_process';

type Options = {
  annotateRuns: boolean;
  datasetName: string;
  experimentName: string;
  limit?: number;
  publish: boolean;
  scenarioIds: string;
  seed: boolean;
  space: string;
};

const DEFAULT_DATASET_NAME = 'operio-scenario-baseline';

/**
 * Parses CLI flags for the local eval orchestration flow.
 */
function parseArgs(argv: string[]): Options {
  const options: Options = {
    annotateRuns: true,
    datasetName: DEFAULT_DATASET_NAME,
    experimentName: `operio-scenario-baseline-${timestampSlug()}`,
    publish: false,
    scenarioIds: '',
    seed: true,
    space: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--':
        break;
      case '--publish':
        options.publish = true;
        break;
      case '--no-seed':
        options.seed = false;
        break;
      case '--no-annotate-runs':
        options.annotateRuns = false;
        break;
      case '--space':
        options.space = requireValue(arg, next);
        index += 1;
        break;
      case '--dataset-name':
        options.datasetName = requireValue(arg, next);
        index += 1;
        break;
      case '--experiment-name':
        options.experimentName = requireValue(arg, next);
        index += 1;
        break;
      case '--limit':
        options.limit = Number.parseInt(requireValue(arg, next), 10);
        index += 1;
        break;
      case '--scenario-ids':
        options.scenarioIds = requireValue(arg, next);
        index += 1;
        break;
      case '--help':
      case '-h':
        printHelpAndExit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.publish && !options.space) {
    throw new Error('--space is required when --publish is set.');
  }

  if (options.limit !== undefined && Number.isNaN(options.limit)) {
    throw new Error('--limit must be an integer.');
  }

  return options;
}

/**
 * Exits with usage instructions.
 */
function printHelpAndExit(exitCode: number): never {
  console.log(`Usage: pnpm run eval:flow -- [options]

Options:
  --publish                 Publish the run to Arize AX.
  --space SPACE             Arize AX space name or ID. Required with --publish.
  --dataset-name NAME       AX dataset name. Default: ${DEFAULT_DATASET_NAME}
  --experiment-name NAME    AX experiment name. Default: generated timestamp.
  --limit N                 Run only the first N scenarios.
  --scenario-ids IDS        Comma-separated scenario IDs to run.
  --no-seed                 Skip the seed step.
  --no-annotate-runs        Skip db_correctness run annotations in AX.
  --help, -h                Show this help.
`);
  process.exit(exitCode);
}

/**
 * Runs a child process and fails fast if it exits non-zero.
 */
function runStep(stepName: string, command: string, args: string[]): void {
  console.log(`\n[eval-flow] ${stepName}`);
  console.log(`[eval-flow] $ ${[command, ...args].join(' ')}`);

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Builds common scenario filter flags shared by all Python entrypoints.
 */
function buildScenarioArgs(options: Options): string[] {
  const args: string[] = [];
  if (options.limit !== undefined) {
    args.push('--limit', String(options.limit));
  }
  if (options.scenarioIds) {
    args.push('--scenario-ids', options.scenarioIds);
  }
  return args;
}

/**
 * Ensures a required flag has a following value.
 */
function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

/**
 * Builds a compact timestamp for experiment names.
 */
function timestampSlug(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const scenarioArgs = buildScenarioArgs(options);

  if (options.seed) {
    runStep('Seeding Mongo fixtures', 'pnpm', ['run', 'seed']);
  }

  runStep('Running local scenario baseline', 'pnpm', [
    'exec',
    'env',
    'PYTHONPATH=agents',
    'uv',
    'run',
    '--project',
    'agents',
    'python',
    'agents/scripts/run_scenario_baseline.py',
    ...scenarioArgs,
  ]);

  runStep('Exporting AX dataset artifact', 'pnpm', [
    'exec',
    'env',
    'PYTHONPATH=agents',
    'uv',
    'run',
    '--project',
    'agents',
    'python',
    'agents/scripts/export_ax_eval_dataset.py',
    ...scenarioArgs,
  ]);

  if (!options.publish) {
    return;
  }

  const publishArgs = [
    'exec',
    'env',
    'PYTHONPATH=agents',
    'uv',
    'run',
    '--project',
    'agents',
    'python',
    'agents/scripts/publish_ax_scenario_baseline.py',
    '--space',
    options.space,
    '--dataset-name',
    options.datasetName,
    '--experiment-name',
    options.experimentName,
    ...scenarioArgs,
  ];

  if (!options.annotateRuns) {
    publishArgs.push('--skip-annotations');
  }

  runStep('Publishing scenario baseline to Arize AX', 'pnpm', publishArgs);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[eval-flow] ${message}`);
  printHelpAndExit(1);
}
