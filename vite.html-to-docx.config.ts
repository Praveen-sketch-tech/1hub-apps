import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/shared/html-to-docx/index.ts",
      name: "HubHtmlToDocx",
      formats: ["iife"],
      fileName: () => "html-to-docx.js",
    },
    outDir: "public/shared",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
