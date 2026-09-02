import { execFile as execFileCallback } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const image = "wsr-ui-panel-benchmark-v1:local";
const repositoryRoot = process.cwd();
const results = resolve("qualification/panel-benchmark/v1/results");
await mkdir(results, { recursive: true });
await execFile(
  "docker",
  [
    "build",
    "--platform",
    "linux/arm64",
    "--tag",
    image,
    "--file",
    "qualification/panel-benchmark/v1/Dockerfile",
    ".",
  ],
  { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 },
);
const inspected = await execFile("docker", [
  "image",
  "inspect",
  image,
  "--format",
  "{{.Id}}",
]);
const provider = process.env.WSR_BENCHMARK_PROVIDER_COMMIT ?? "working-tree";
const run = await execFile(
  "docker",
  [
    "run",
    "--rm",
    "--platform",
    "linux/arm64",
    "--cpus",
    "4",
    "--env",
    `WSR_BENCHMARK_PROVIDER_COMMIT=${provider}`,
    "--env",
    `WSR_BENCHMARK_RUNNER_IMAGE=${inspected.stdout.trim()}`,
    "--volume",
    `${results}:/workspace/qualification/panel-benchmark/v1/results`,
    image,
    "node",
    "qualification/panel-benchmark/v1/run.mjs",
    "--mode=full",
    ...process.argv.slice(2),
  ],
  { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 },
);
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);
