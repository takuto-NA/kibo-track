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
const DEMO_PAGES_VITE_MODE = "pages";
const GITHUB_PAGES_PROJECT_SITE_BASE_PATH = "/kibo-track/";

export default defineConfig(({ mode }) => {
  const isDemoLanMode = mode === DEMO_LAN_VITE_MODE;
  const isDemoPagesMode = mode === DEMO_PAGES_VITE_MODE;
  const pagesRollupInput: Record<string, string> = {
    main: path.resolve(currentDirectory, "index.html"),
    multiCube: path.resolve(currentDirectory, "multi-cube.html"),
  };
  const defaultRollupInput: Record<string, string> = {
    main: path.resolve(currentDirectory, "index.html"),
    multiCube: path.resolve(currentDirectory, "multi-cube.html"),
    staticImageVerify: path.resolve(currentDirectory, "static-image-verify.html"),
  };
  const rollupInput = isDemoPagesMode ? pagesRollupInput : defaultRollupInput;

  return {
    base: isDemoPagesMode ? GITHUB_PAGES_PROJECT_SITE_BASE_PATH : "/",
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
        input: rollupInput,
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
