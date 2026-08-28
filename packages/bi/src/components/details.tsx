import type {
  ResolvedEvaluationContext,
  TaskMembershipReference,
  WorkflowResolutionEntry,
} from "../domain/evolution/types";

function Coordinates({ values }: { values: Record<string, string> }) {
  const entries = Object.entries(values);
  return entries.length === 0 ? (
    <span>None</span>
  ) : (
    <span>{entries.map(([key, value]) => `${key}=${value}`).join(", ")}</span>
  );
}

function Membership({ membership }: { membership: TaskMembershipReference }) {
  return (
    <li>
      <code className="text-code">{membership.delivery_id}</code>
      <span>Recorded {membership.recorded_at}</span>
      <span>Observation profile {membership.profile_version}</span>
      <code className="text-code">Source {membership.source_identity}</code>
      <code className="text-code">Manifest {membership.manifest_digest}</code>
      <code className="text-code">Accepted {membership.accepted_digest}</code>
    </li>
  );
}

export function MetricExplanationView({
  metricCoordinate,
  definition,
  valueSemantics,
  eligibility,
  exclusions,
  limits,
}: {
  metricCoordinate: string;
  definition: string;
  valueSemantics: string;
  eligibility: string;
  exclusions: string[];
  limits: string;
}) {
  return (
    <section className="detail-view">
      <header>
        <p className="text-label text-content-muted">Catalog semantics</p>
        <h2 className="text-heading">Metric explanation</h2>
        <code className="text-code">{metricCoordinate}</code>
      </header>
      <dl className="detail-list">
        <div>
          <dt>Definition</dt>
          <dd>{definition}</dd>
        </div>
        <div>
          <dt>Value semantics</dt>
          <dd>{valueSemantics}</dd>
        </div>
        <div>
          <dt>Eligible population</dt>
          <dd>{eligibility}</dd>
        </div>
        <div>
          <dt>Exclusions</dt>
          <dd>
            {exclusions.length === 0 ? (
              "None"
            ) : (
              <ul>
                {exclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt>Interpretation limits</dt>
          <dd>{limits}</dd>
        </div>
      </dl>
    </section>
  );
}

function TaskPopulation({
  population,
}: {
  population: ResolvedEvaluationContext["task_population"];
}) {
  return (
    <section>
      <h3 className="text-heading">Task population</h3>
      <ul className="detail-rows">
        {population.map((task) => {
          const displayName = task.display_name?.trim();
          return (
            <li key={task.task_id}>
              <strong>{displayName || task.task_id}</strong>
              {displayName ? (
                <code className="text-code">{task.task_id}</code>
              ) : null}
              <span>{task.memberships.length} Delivery memberships</span>
              <span>
                Cohort: <Coordinates values={task.cohort_coordinates} />
              </span>
              {task.terminal_reading === undefined ? null : (
                <span>Terminal reading: {task.terminal_reading}</span>
              )}
              {task.exclusions.length === 0 ? null : (
                <span>Exclusions: {task.exclusions.join(", ")}</span>
              )}
              {task.memberships.length === 0 ? null : (
                <ul className="detail-rows">
                  {task.memberships.map((membership) => (
                    <Membership
                      key={membership.delivery_id}
                      membership={membership}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WorkflowResolution({
  resolution,
}: {
  resolution: WorkflowResolutionEntry;
}) {
  return (
    <li>
      <span>{resolution.state}</span>
      <code className="text-code">
        {resolution.package_name}@{resolution.exact_package_version}
      </code>
      <span>
        Workflow {resolution.workflow_id}@{resolution.workflow_version}
      </span>
      <span>Snapshot {resolution.snapshot_id}</span>
      <code className="text-code">
        Snapshot digest {resolution.snapshot_digest}
      </code>
      <code className="text-code">
        Package digest {resolution.package_digest}
      </code>
      <code className="text-code">Manifest {resolution.manifest_digest}</code>
      <code className="text-code">
        Manifest projection {resolution.manifest_projection_digest}
      </code>
      <code className="text-code">Accepted {resolution.accepted_digest}</code>
      <span>Observation profile {resolution.profile_version}</span>
      <code className="text-code">Source {resolution.source_identity}</code>
      {resolution.matched_source_id === undefined ? null : (
        <span>{resolution.matched_source_id}</span>
      )}
      {resolution.matched_source_index === undefined ? null : (
        <span>Matched source index {resolution.matched_source_index}</span>
      )}
      {resolution.matched_repository === undefined ? null : (
        <code className="text-code">{resolution.matched_repository}</code>
      )}
      {resolution.validated_archive_digest === undefined ? null : (
        <code className="text-code">
          Validated archive {resolution.validated_archive_digest}
        </code>
      )}
      {resolution.validated_package_digest === undefined ? null : (
        <code className="text-code">
          Validated package {resolution.validated_package_digest}
        </code>
      )}
      {resolution.validated_snapshot_digest === undefined ? null : (
        <code className="text-code">
          Validated snapshot {resolution.validated_snapshot_digest}
        </code>
      )}
      {resolution.attempts.length === 0 ? null : (
        <ul className="detail-rows">
          {resolution.attempts.map((attempt, index) => (
            <li
              key={`${attempt.source_id ?? "unknown"}:${attempt.code}:${index}`}
            >
              <span>{attempt.code}</span>
              {attempt.source_id === undefined ? null : (
                <span>{attempt.source_id}</span>
              )}
              {attempt.source_index === undefined ? null : (
                <span>Source index {attempt.source_index}</span>
              )}
              {attempt.message === undefined ? null : (
                <span>{attempt.message}</span>
              )}
              {attempt.omitted_count === undefined ? null : (
                <span>Omitted attempts {attempt.omitted_count}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ReceiptView({
  receipt,
  side,
}: {
  receipt: ResolvedEvaluationContext;
  side: "single" | "left" | "right";
}) {
  return (
    <section className="detail-view">
      <header>
        <p className="text-label text-content-muted">{side} result</p>
        <h2 className="text-heading">Evaluation receipt</h2>
        <p className="text-body">
          This response audit record describes Evolution’s resolved read set. It
          is not proof of causation and is not a pre-created manifest.
        </p>
      </header>
      <dl className="detail-list">
        <div>
          <dt>Context / selection versions</dt>
          <dd>
            {receipt.context_version} / {receipt.selection.selection_version}
          </dd>
        </div>
        <div>
          <dt>Canonical task selection</dt>
          <dd className="numeric-exact">
            {receipt.selection.task_ids.join(", ")}
          </dd>
        </div>
        <div>
          <dt>Population state</dt>
          <dd>{receipt.population_state}</dd>
        </div>
        <div>
          <dt>Logical cutoff</dt>
          <dd className="numeric-exact">{receipt.as_of}</dd>
        </div>
        <div>
          <dt>Resolved at</dt>
          <dd className="numeric-exact">{receipt.resolved_at}</dd>
        </div>
        <div>
          <dt>Catalog</dt>
          <dd className="numeric-exact">
            {receipt.catalog.catalog_id}@{receipt.catalog.version}
          </dd>
        </div>
        <div>
          <dt>Catalog semantic digest</dt>
          <dd className="numeric-exact">{receipt.catalog.semantic_digest}</dd>
        </div>
        <div>
          <dt>Catalog observation profile</dt>
          <dd>{receipt.catalog.observation_profile}</dd>
        </div>
      </dl>
      <TaskPopulation population={receipt.task_population} />
      <section>
        <h3 className="text-heading">Evidence bindings</h3>
        <ul className="detail-rows">
          {receipt.evidence_bindings.map((binding) => (
            <li key={`${binding.route}:${binding.route_snapshot}`}>
              <code className="text-code">{binding.route}</code>
              <span>
                Filter: <Coordinates values={binding.canonical_filter} />
              </span>
              <span>Contract revision {binding.contract_revision}</span>
              <span>Observation profile {binding.observation_profile}</span>
              <span>Read model revision {binding.read_model_revision}</span>
              <span>{binding.completion_state}</span>
              {binding.error_state === undefined ? null : (
                <span>{binding.error_state}</span>
              )}
              <code className="text-code">{binding.route_snapshot}</code>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-heading">Resolved input references</h3>
        {receipt.input_refs.length === 0 ? (
          <p className="text-body">No input references.</p>
        ) : (
          <ul className="detail-rows">
            {receipt.input_refs.map((reference) => (
              <li key={`${reference.kind}:${reference.identity}`}>
                <span>{reference.kind}</span>
                <code className="text-code">{reference.identity}</code>
                <code className="text-code">{reference.provenance_ref}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="text-heading">Workflow resolutions</h3>
        {receipt.workflow_resolutions.length === 0 ? (
          <p className="text-body">No Workflow resolutions.</p>
        ) : (
          <ul className="detail-rows">
            {receipt.workflow_resolutions.map((resolution) => (
              <WorkflowResolution
                key={resolution.manifest_digest}
                resolution={resolution}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
