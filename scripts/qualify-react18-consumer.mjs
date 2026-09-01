import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function assertReact18Markup(markup) {
  if (!markup.includes('class="wsr-bi"')) {
    throw new Error("React 18 consumer did not render the scoped BI surface");
  }
  if (!markup.includes('aria-label="Ratio bar"')) {
    throw new Error(
      "React 18 consumer did not render the AVAILABLE ratio chart",
    );
  }
  if (
    !markup.includes("Unavailable") ||
    !markup.includes("Reason: MISSING_INPUT")
  ) {
    throw new Error(
      "React 18 consumer did not render the UNAVAILABLE semantic state",
    );
  }
  if (markup.includes("<pre>")) {
    throw new Error(
      "React 18 consumer rendered JSON as the primary product surface",
    );
  }
}

const renderSource = `
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BiSurface, MetricPanel } from "@wsr/bi";

const base = {
  slice_key: {},
  measures: {},
  coverage: null,
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: [],
};
const available = {
  metric_id: "delivery-success-rate",
  metric_version: "2.0.0",
  slices: [{ ...base, state: "AVAILABLE", value: { kind: "RATIO", value: "3/4", unit: "ratio" } }],
};
const unavailable = {
  metric_id: "workflow-resolution-rate",
  metric_version: "2.0.0",
  slices: [{ ...base, state: "UNAVAILABLE", withholding_reason: "MISSING_INPUT", missing_inputs: ["workflow_snapshot"] }],
};

process.stdout.write(renderToStaticMarkup(
  React.createElement(BiSurface, null,
    React.createElement(MetricPanel, { result: available, visualizer: "ratio-bar@1" }),
    React.createElement(MetricPanel, { result: unavailable, visualizer: "numeric-card@1" }),
  ),
));
`;

export async function qualifyReact18Consumer() {
  const workspace = await mkdtemp(join(tmpdir(), "wsr-bi-react18-"));
  try {
    const packed = await execFile(
      "npm",
      [
        "pack",
        "--silent",
        "--pack-destination",
        workspace,
        "--workspace",
        "@wsr/bi",
      ],
      { cwd: repositoryRoot },
    );
    const tarball = resolve(workspace, packed.stdout.trim().split("\n").at(-1));
    const metadata = {
      name: "wsr-bi-react18-clean-consumer",
      private: true,
      type: "module",
      dependencies: {
        "@wsr/bi": `file:./${basename(tarball)}`,
        react: "18.3.1",
        "react-dom": "18.3.1",
      },
    };
    await writeFile(
      join(workspace, "package.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
    await writeFile(join(workspace, "render.mjs"), renderSource);
    await execFile(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      { cwd: workspace },
    );
    const rendered = await execFile("node", ["render.mjs"], { cwd: workspace });
    assertReact18Markup(rendered.stdout);
    const lock = JSON.parse(
      await readFile(join(workspace, "package-lock.json"), "utf8"),
    );
    const result = {
      package: lock.packages["node_modules/@wsr/bi"].version,
      react: lock.packages["node_modules/react"].version,
      reactDom: lock.packages["node_modules/react-dom"].version,
      hasAvailableSvg: rendered.stdout.includes('aria-label="Ratio bar"'),
      hasUnavailableSemanticState: rendered.stdout.includes(
        "Reason: MISSING_INPUT",
      ),
      sourcePathDependency: false,
    };
    return result;
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.stdout.write(
    `${JSON.stringify(await qualifyReact18Consumer(), null, 2)}\n`,
  );
}
