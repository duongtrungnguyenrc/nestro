import { defineConfig, type Options } from "tsup";
import { copy, pathExists, remove } from "fs-extra";

import { name, version } from "./package.json";
import * as path from "path";

async function copyAssets() {
  try {
    const resourcesDir: string = path.resolve(__dirname, "./resources");

    const resourcesExists: boolean = await pathExists(resourcesDir);

    if (resourcesExists) {
      console.log("Copying resources directory...");
      await copy(resourcesDir, path.resolve(__dirname, "./dist/resources"));
      console.log("Views directory copied successfully");
    } else {
      console.warn("Views directory not found");
    }
  } catch (error) {
    console.error(error);
  }
}

async function cleanUnused() {
  await remove(path.resolve(__dirname, "./dist/types/index.js"));
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
    splitting: false,
    define: {
      PACKAGE_NAME: `"${name}"`,
      PACKAGE_VERSION: `"${version}"`,
      __DEV__: `${!isProd}`,
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
    dts: true,
    outDir: "./dist/types",
    async onSuccess() {
      await copyAssets();
      await cleanUnused();
    },
  };

  return [esm, cjs, dts];
});
