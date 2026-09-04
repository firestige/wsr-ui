# wsr-ui release path

The publishable package declares its stable npm version before candidate
qualification. The candidate tag adds the disposable ordinal
(`0.1.0-rc.2`), while the tarball already contains `wsr-ui-core@0.1.0`. This
lets promotion publish the exact bytes qualified at rc instead of rebuilding or
rewriting `package.json`.

Pushing `release/next` requires `release/request.json` with a `candidate_tag`
and a full `authority_ref` for the superproject commit that pins the intended
wsr-ui source commit. The candidate workflow verifies that pin, runs the full UI
qualification, and publishes an immutable GitHub prerelease plus qualification
evidence. It does not publish to npm.

The promotion workflow is manual-only. It downloads and verifies the candidate,
publishes the exact tarball through npm trusted publishing, and creates the
stable GitHub Release last. It requires the repository release App variables
used by the other WSR components and an npm trusted-publisher binding for the
promotion workflow.
