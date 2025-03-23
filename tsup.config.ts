import { defineConfig, Options } from "tsup";

import { name, version } from "./package.json";

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

export default defineConfig((overrideOptions) => {
  const isProd = overrideOptions.env?.NODE_ENV === "production";

  const common: Options = {
    entry: ["./src/**/*.{ts,js}", "./src/**/*.d.ts", "!./src/**/*.test.{ts,js}"],
    clean: true,
    minify: false,
    sourcemap: true,
    legacyOutput: true,
    bundle: false,
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
    dts: {
      resolve: true,
    },
    outDir: "./dist/types",
  };

  return [esm, cjs, dts];
});
