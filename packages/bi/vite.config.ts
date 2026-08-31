import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      cssFileName: "styles",
      entry: "src/public.ts",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["d3", "react", "react-dom", "react/jsx-runtime"],
    },
  },
  plugins: [react(), tailwindcss()],
});
