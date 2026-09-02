import type { ReactNode } from "react";

import { BiSurface } from "../public";

export function TestHarness({ children }: { children: ReactNode }) {
  return (
    <BiSurface className="test-harness" density="comfortable" theme="dark">
      <main aria-label="WSR UI component test harness">
        <header className="test-harness__header">
          <div>
            <p className="test-harness__eyebrow">Persistent test asset</p>
            <h1>WSR UI Test Harness</h1>
          </div>
          <p>Replace the scenario when the component under test changes.</p>
        </header>
        <section
          aria-label="Active component scenario"
          className="test-harness__scenario"
        >
          {children}
        </section>
      </main>
    </BiSurface>
  );
}
