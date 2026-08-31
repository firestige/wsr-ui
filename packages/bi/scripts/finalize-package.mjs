import { copyFile } from "node:fs/promises";

await copyFile("dist/public.d.ts", "dist/index.d.ts");
await copyFile("dist/public.d.ts.map", "dist/index.d.ts.map");
