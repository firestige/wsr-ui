import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

import {
  buildReleaseMetadata,
  verifyReleaseEvidence,
} from "../release/cli/release.mjs";

const sha256 = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

test("candidate metadata binds a stable package to an rc tag and exact commit", () => {
  const archive = Buffer.from("exact npm tarball");
  const metadata = buildReleaseMetadata({
    packageManifest: { name: "wsr-ui-core", version: "0.1.0" },
    archiveName: "wsr-ui-core-0.1.0.tgz",
    archiveBytes: archive,
    commit: "a".repeat(40),
    candidateTag: "0.1.0-rc.2",
  });

  assert.equal(metadata.package.sha256, sha256(archive));
  assert.equal(metadata.commit, "a".repeat(40));
  assert.equal(metadata.candidateTag, "0.1.0-rc.2");
});

test("candidate metadata rejects prerelease package bytes that cannot become a stable npm coordinate", () => {
  assert.throws(
    () =>
      buildReleaseMetadata({
        packageManifest: { name: "wsr-ui-core", version: "0.1.0-rc.1" },
        archiveName: "wsr-ui-core-0.1.0-rc.1.tgz",
        archiveBytes: Buffer.from("prerelease"),
        commit: "a".repeat(40),
        candidateTag: "0.1.0-rc.2",
      }),
    /stable package version/,
  );
});

test("qualified evidence fails closed when candidate artifact bytes drift", () => {
  const archive = Buffer.from("qualified bytes");
  const metadata = buildReleaseMetadata({
    packageManifest: { name: "wsr-ui-core", version: "0.1.0" },
    archiveName: "wsr-ui-core-0.1.0.tgz",
    archiveBytes: archive,
    commit: "b".repeat(40),
    candidateTag: "0.1.0-rc.3",
  });
  const metadataBytes = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`);
  const qualification = {
    schemaVersion: "wsr-ui.release-qualification@1.0.0",
    candidateTag: metadata.candidateTag,
    commit: metadata.commit,
    releaseMetadataSha256: sha256(metadataBytes),
    packageSha256: metadata.package.sha256,
    componentGates: { status: "PASS" },
    remoteArtifactVerification: { status: "PASS" },
  };

  assert.doesNotThrow(() =>
    verifyReleaseEvidence({
      metadata,
      metadataBytes,
      qualification,
      archiveBytes: archive,
    }),
  );
  assert.throws(
    () =>
      verifyReleaseEvidence({
        metadata,
        metadataBytes,
        qualification,
        archiveBytes: Buffer.from("drift"),
      }),
    /package digest/,
  );
});

test("candidate and promotion workflows preserve the rc/GA authority boundary", async () => {
  const candidate = await readFile(
    new URL("../.github/workflows/release-candidate.yml", import.meta.url),
    "utf8",
  );
  const promote = await readFile(
    new URL("../.github/workflows/release-promote.yml", import.meta.url),
    "utf8",
  );

  assert.match(candidate, /branches:\s*\n\s*- release\/next/);
  assert.match(candidate, /authority_ref/);
  assert.match(candidate, /ls-tree HEAD wsr-ui/);
  assert.match(candidate, /RELEASE_TARGET/);
  assert.match(candidate, /--prerelease/);
  assert.doesNotMatch(candidate, /npm publish/);
  assert.match(promote, /^on:\s*\n\s*workflow_dispatch:/m);
  assert.doesNotMatch(promote, /^\s+push:/m);
  assert.match(promote, /release\.mjs verify .*--qualified/);
  assert.match(
    promote,
    /npm publish "\$PACKAGE_ARCHIVE" --provenance --access public/,
  );
  assert.ok(
    promote.indexOf("npm publish") < promote.lastIndexOf("gh release create"),
  );
});

test("the publishable package declares the stable bytes that promotion will publish", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../packages/bi/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.version, "0.1.0");
});
