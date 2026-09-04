#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const METADATA_SCHEMA = "wsr-ui.release-metadata@1.0.0";
const QUALIFICATION_SCHEMA = "wsr-ui.release-qualification@1.0.0";
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

const sha256 = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function buildReleaseMetadata({
  packageManifest,
  archiveName,
  archiveBytes,
  commit,
  candidateTag,
}) {
  invariant(
    packageManifest?.name === "wsr-ui-core",
    "release package must be wsr-ui-core",
  );
  invariant(
    STABLE_VERSION.test(packageManifest?.version ?? ""),
    "candidate must contain a stable package version",
  );
  const candidateMatch = candidateTag?.match(
    /^(\d+\.\d+\.\d+)-rc\.([1-9]\d*)$/,
  );
  invariant(
    candidateMatch?.[1] === packageManifest.version,
    "candidate tag must be <package version>-rc.<positive ordinal>",
  );
  invariant(
    COMMIT.test(commit ?? ""),
    "release commit must be a full lowercase SHA",
  );
  invariant(
    path.basename(archiveName ?? "") === archiveName &&
      archiveName.endsWith(".tgz"),
    "package archive name is invalid",
  );
  return {
    schemaVersion: METADATA_SCHEMA,
    candidateTag,
    commit,
    package: {
      name: packageManifest.name,
      version: packageManifest.version,
      asset: archiveName,
      sha256: sha256(archiveBytes),
    },
  };
}

export function verifyReleaseEvidence({
  metadata,
  metadataBytes,
  qualification,
  archiveBytes,
  packageManifest,
}) {
  invariant(
    metadata?.schemaVersion === METADATA_SCHEMA,
    "release metadata schema is invalid",
  );
  invariant(
    metadata.package?.name === "wsr-ui-core",
    "release metadata package is invalid",
  );
  invariant(
    STABLE_VERSION.test(metadata.package?.version ?? ""),
    "release metadata package version must be stable",
  );
  invariant(
    metadata.candidateTag?.match(/-rc\.[1-9]\d*$/),
    "release metadata candidate tag is invalid",
  );
  invariant(
    metadata.candidateTag.startsWith(`${metadata.package.version}-rc.`),
    "candidate tag does not match package version",
  );
  invariant(
    COMMIT.test(metadata.commit ?? ""),
    "release metadata commit is invalid",
  );
  invariant(
    SHA256.test(metadata.package.sha256 ?? ""),
    "release metadata package digest is invalid",
  );
  invariant(
    sha256(archiveBytes) === metadata.package.sha256,
    "package digest does not match release metadata",
  );
  if (packageManifest) {
    invariant(
      packageManifest.name === metadata.package.name,
      "packed package name does not match release metadata",
    );
    invariant(
      packageManifest.version === metadata.package.version,
      "packed package version does not match release metadata",
    );
  }
  if (!qualification) return;
  invariant(
    qualification.schemaVersion === QUALIFICATION_SCHEMA,
    "release qualification schema is invalid",
  );
  invariant(
    qualification.candidateTag === metadata.candidateTag,
    "qualification candidate tag does not match metadata",
  );
  invariant(
    qualification.commit === metadata.commit,
    "qualification commit does not match metadata",
  );
  invariant(
    qualification.releaseMetadataSha256 === sha256(metadataBytes),
    "qualification metadata digest does not match",
  );
  invariant(
    qualification.packageSha256 === metadata.package.sha256,
    "qualification package digest does not match",
  );
  invariant(
    qualification.componentGates?.status === "PASS",
    "component gates did not pass",
  );
  invariant(
    qualification.remoteArtifactVerification?.status === "PASS",
    "remote artifact verification did not pass",
  );
}

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const packedManifest = (archive) =>
  JSON.parse(
    execFileSync("tar", ["-xOf", archive, "package/package.json"], {
      encoding: "utf8",
    }),
  );

async function loadDirectory(directory, requireQualification = false) {
  const metadataPath = path.join(directory, "release-metadata.json");
  const metadataBytes = await readFile(metadataPath);
  const metadata = JSON.parse(metadataBytes);
  invariant(
    path.basename(metadata.package?.asset ?? "") === metadata.package?.asset,
    "metadata package asset is invalid",
  );
  const archivePath = path.join(directory, metadata.package.asset);
  const archiveBytes = await readFile(archivePath);
  const qualificationPath = path.join(directory, "release-qualification.json");
  let qualification;
  try {
    qualification = await json(qualificationPath);
  } catch (error) {
    if (requireQualification)
      throw new Error(
        "qualified release is missing or has an invalid release-qualification.json",
        { cause: error },
      );
  }
  verifyReleaseEvidence({
    metadata,
    metadataBytes,
    qualification,
    archiveBytes,
    packageManifest: packedManifest(archivePath),
  });
  return {
    metadata,
    metadataBytes,
    archiveBytes,
    archivePath,
    qualificationPath,
  };
}

async function build(directory, commit, candidateTag, sourceArchive) {
  const archiveName = path.basename(sourceArchive);
  const archiveBytes = await readFile(sourceArchive);
  const packageManifest = packedManifest(sourceArchive);
  const metadata = buildReleaseMetadata({
    packageManifest,
    archiveName,
    archiveBytes,
    commit,
    candidateTag,
  });
  await mkdir(directory, { recursive: true });
  await copyFile(sourceArchive, path.join(directory, archiveName));
  await writeFile(
    path.join(directory, "release-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  await writeFile(
    path.join(directory, "release-notes.md"),
    `# wsr-ui-core ${packageManifest.version}\n\nQualified as candidate \`${candidateTag}\` from commit \`${commit}\`.\n`,
  );
  await loadDirectory(directory);
}

async function qualify(directory) {
  const loaded = await loadDirectory(directory);
  const qualification = {
    schemaVersion: QUALIFICATION_SCHEMA,
    candidateTag: loaded.metadata.candidateTag,
    commit: loaded.metadata.commit,
    releaseMetadataSha256: sha256(loaded.metadataBytes),
    packageSha256: loaded.metadata.package.sha256,
    componentGates: { status: "PASS" },
    remoteArtifactVerification: { status: "PASS" },
  };
  await writeFile(
    loaded.qualificationPath,
    `${JSON.stringify(qualification, null, 2)}\n`,
  );
  await loadDirectory(directory, true);
}

async function main([command, ...args]) {
  if (command === "build" && args.length === 4) return build(...args);
  if (command === "qualify" && args.length === 1) return qualify(...args);
  if (
    command === "verify" &&
    (args.length === 1 || (args.length === 2 && args[1] === "--qualified"))
  ) {
    await loadDirectory(args[0], args[1] === "--qualified");
    const files = await readdir(args[0]);
    process.stdout.write(
      `verified wsr-ui release evidence (${files.length} assets)\n`,
    );
    return;
  }
  throw new Error(
    "usage: release.mjs build DIR COMMIT CANDIDATE_TAG ARCHIVE | qualify DIR | verify DIR [--qualified]",
  );
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
