/**
 * Vite plugin serving repository examples/data files at /examples/data/* for local demo assets.
 */
import fs from "node:fs";
import path from "node:path";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { resolveExamplesDataFilePath } from "./src/resolve-examples-data-file-path.js";

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".mtl": "text/plain",
  ".obj": "text/plain",
  ".png": "image/png",
};

function attachExamplesDataMiddleware(
  server: Pick<ViteDevServer | PreviewServer, "middlewares">,
  repositoryRootDirectory: string,
): void {
  server.middlewares.use((request, response, next) => {
    if (request.url === undefined) {
      next();
      return;
    }

    const requestUrl = new URL(request.url, "http://localhost");
    const resolvedFilePath = resolveExamplesDataFilePath(
      repositoryRootDirectory,
      requestUrl.pathname,
    );

    if (resolvedFilePath === null) {
      next();
      return;
    }

    if (!fs.existsSync(resolvedFilePath) || fs.statSync(resolvedFilePath).isDirectory()) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    const fileExtension = path.extname(resolvedFilePath).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXTENSION[fileExtension] ?? "application/octet-stream";
    response.setHeader("Content-Type", contentType);
    fs.createReadStream(resolvedFilePath).pipe(response);
  });
}

/** Creates a Vite plugin that exposes examples/data for local OBJ and photo assets. */
export function createServeRepositoryExamplesDataPlugin(
  repositoryRootDirectory: string,
): Plugin {
  return {
    name: "serve-repository-examples-data",
    configureServer(server) {
      attachExamplesDataMiddleware(server, repositoryRootDirectory);
    },
    configurePreviewServer(server) {
      attachExamplesDataMiddleware(server, repositoryRootDirectory);
    },
  };
}
