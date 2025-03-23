import { defineConfig, type Options } from "tsup";
import { copy, remove, pathExists } from "fs-extra";

import { name, version } from "./package.json";
import * as path from "path";

export const runAfterLast =
  (commands: Array<string | false>) =>
  (...configs: Options[]) => {
    const [last, ...rest] = configs.reverse();
    return [
      ...rest.reverse(),
      {
        ...last,
        onSuccess: [last.onSuccess, ...commands].filter(Boolean).join(" && "),
      },
    ];
  };

async function copyAssets() {
  try {
    const viewsDir = path.resolve(__dirname, "./views");
    const publicDir = path.resolve(__dirname, "./public");
    const distViewsDir = path.resolve(__dirname, "./dist/views");
    const distPublicDir = path.resolve(__dirname, "./dist/public");

    const viewsExists = await pathExists(viewsDir);
    const publicExists = await pathExists(publicDir);

    if (viewsExists) {
      console.log("Copying views directory...");
      await copy(viewsDir, distViewsDir);
      console.log("Views directory copied successfully");
    } else {
      console.warn("Views directory not found");
    }

    if (publicExists) {
      console.log("Copying public directory...");
      await copy(publicDir, distPublicDir);
      console.log("Public directory copied successfully");
    } else {
      console.warn("Public directory not found");
    }
  } catch (error) {
    console.error(error);
  }
}

export default defineConfig((overrideOptions) => {
  const isProd = overrideOptions.env?.NODE_ENV === "production";

  const common: Options = {
    entry: ["./src/**/*.{ts,js}", "!./src/**/*.test.{ts,js}"],
    clean: true,
    minify: isProd,
    sourcemap: !isProd,
    legacyOutput: true,
    bundle: false,
    define: {
      PACKAGE_NAME: `"${name}"`,
      PACKAGE_VERSION: `"${version}"`,
      __DEV__: `${!isProd}`,
    },
    async onSuccess() {
      await copyAssets();
    },
  };

  const esm: Options = {
    ...common,
    format: "esm",
  };

  const cjs: Options = {
    ...common,
    format: "cjs",
    outDir: "./dist/cjs",
  };

  const dts: Options = {
    entry: ["src/index.ts"],
    clean: false,
    dts: {
      resolve: true,
    },
    outDir: "./dist/types",
  };

  return [esm, cjs, dts];
});
