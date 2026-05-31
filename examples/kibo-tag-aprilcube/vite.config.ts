/**
 * Vite configuration for the kibo-tag AprilCube browser example.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "kibo-track": path.resolve(currentDirectory, "../../src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(currentDirectory, "index.html"),
        staticImageVerify: path.resolve(currentDirectory, "static-image-verify.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [currentDirectory, path.resolve(currentDirectory, "../..")],
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
