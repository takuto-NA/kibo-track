/**
 * Vite configuration for the kibo-tag AprilCube browser example.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";
import { createServeRepositoryExamplesDataPlugin } from "./vite-plugin-serve-examples-data.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRootDirectory = path.resolve(currentDirectory, "../..");
const DEMO_LAN_VITE_MODE = "lan";

export default defineConfig(({ mode }) => {
  const isDemoLanMode = mode === DEMO_LAN_VITE_MODE;

  return {
    resolve: {
      alias: {
        "kibo-track": path.resolve(repositoryRootDirectory, "src/index.ts"),
      },
    },
    plugins: [
      createServeRepositoryExamplesDataPlugin(repositoryRootDirectory),
      ...(isDemoLanMode ? [basicSsl()] : []),
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(currentDirectory, "index.html"),
          staticImageVerify: path.resolve(currentDirectory, "static-image-verify.html"),
        },
      },
    },
    server: {
      host: isDemoLanMode,
      port: 5173,
      strictPort: true,
      fs: {
        allow: [currentDirectory, repositoryRootDirectory],
      },
    },
    preview: {
      host: isDemoLanMode,
      port: 4173,
      strictPort: true,
    },
  };
});
