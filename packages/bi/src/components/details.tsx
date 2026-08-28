import type { ResolvedEvaluationContext } from "../domain/evolution/types";

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
              {task.exclusions.length === 0 ? null : (
                <span>Exclusions: {task.exclusions.join(", ")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
      </dl>
      <TaskPopulation population={receipt.task_population} />
      <section>
        <h3 className="text-heading">Evidence bindings</h3>
        <ul className="detail-rows">
          {receipt.evidence_bindings.map((binding) => (
            <li key={`${binding.route}:${binding.route_snapshot}`}>
              <code className="text-code">{binding.route}</code>
              <span>{binding.completion_state}</span>
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
              <li key={resolution.manifest_digest}>
                <span>{resolution.state}</span>
                <code className="text-code">
                  {resolution.package_name}@{resolution.exact_package_version}
                </code>
                <code className="text-code">{resolution.snapshot_digest}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
