import "@testing-library/jest-dom/vitest";
import { TextDecoder, TextEncoder } from "node:util";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Object.assign(globalThis, { TextDecoder, TextEncoder });
afterEach(cleanup);
