# Automation selectors

`wsr-ui-core` exposes stable automation selectors only where Playwright, test
code, or development agents repeatedly need to locate an element.

## Rules

1. Prefer an accessible role and name for unique, user-facing controls.
2. Use `data-testid` for component boundaries and non-semantic visual or
   interaction elements that automation locates repeatedly.
3. Use a fixed `data-testid` for repeated elements and pair it with a stable
   domain identity such as `data-trace-node-id`.
4. Use lowercase kebab-case names scoped by component, for example
   `trace-waterfall-data-zoom`.
5. Do not add a selector when tests can locate the element reliably without
   one. Text, CSS classes, and DOM nesting are not stable selector contracts.
6. Keep existing selectors when adding a replacement until their current
   consumers have migrated.

## Trace view contract

The first selector set covers the trace views used by Issue 178:

| Element                | `data-testid`                      | Repeated identity                         |
| ---------------------- | ---------------------------------- | ----------------------------------------- |
| Waterfall root         | `trace-waterfall`                  | —                                         |
| Data zoom input        | `trace-waterfall-data-zoom`        | —                                         |
| Data zoom window       | `trace-waterfall-data-zoom-window` | —                                         |
| Span tree              | `trace-waterfall-span-tree`        | —                                         |
| Span row               | `trace-waterfall-row`              | `data-trace-node-id`                      |
| Span selection control | `trace-waterfall-node`             | `data-trace-node-id`                      |
| Span timeline bar      | `trace-waterfall-bar`              | `data-trace-node-id`                      |
| Collapse control       | `trace-waterfall-collapse`         | `data-trace-node-id`                      |
| Indent guide           | `trace-waterfall-indent-guide`     | `data-guide-owner-id`, `data-trace-depth` |
| Span passport          | `span-passport`                    | —                                         |
| Trace tree root        | `trace-tree`                       | —                                         |
| Trace tree node        | `trace-tree-node`                  | `data-trace-node-id`                      |
| Trace statistics root  | `trace-statistics`                 | —                                         |

Search inputs, named action buttons, headings, statistics text, decorative
icons, and layout wrappers do not receive test IDs unless repeated automation
usage later demonstrates a need.
