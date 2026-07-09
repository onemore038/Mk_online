import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// shared パッケージはビルド出力を持たないため、Vite にソース(.ts)を直接読ませる。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@mk-online/shared": path.resolve(dirname, "../shared/src/index.ts"),
    },
  },
  server: { port: 5173 },
});
