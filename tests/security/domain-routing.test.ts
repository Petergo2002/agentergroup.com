import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadModule(path: string, globals: Record<string, unknown> = {}) {
  const source = readFileSync(path, "utf8").replaceAll("import.meta.env", "__viteEnv");
  const exports: Record<string, (...args: (string | null | undefined)[]) => string> = {};
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, URL, ...globals });
  return exports;
}

function loadWidgets(appUrl: string, widgetUrl: string) {
  const env = loadModule("src/lib/env.ts", {
    process: { env: { NEXT_PUBLIC_APP_URL: appUrl, NEXT_PUBLIC_WIDGET_APP_URL: widgetUrl } },
    require: () => ({}),
  });
  return loadModule("src/lib/widgets.ts", {
    require: (id: string) => id === "@/lib/env" ? env : {},
  });
}

// Execute the real static loader with DOM initialization deferred. Expose only
// its bootstrap function to exercise URL resolution without network or UI mocks.
async function loaderBootstrap(options: {
  page?: string;
  script?: string;
  api?: string;
  globalApi?: string;
} = {}) {
  const requests: string[] = [];
  const context = {
    URL,
    console,
    window: {
      location: new URL(options.page ?? "https://customer.example/contact"),
      AG_WIDGET_API_URL: options.globalApi,
      addEventListener() {},
    },
    document: {
      readyState: "loading",
      currentScript: {
        src: options.script ?? "https://widget.avenro.se/loader.js",
        getAttribute: (name: string) => ({
          "data-widget": "existing-public-key",
          "data-api-url": options.api,
        })[name],
      },
      addEventListener() {},
    },
    fetch: async (url: string) => {
      requests.push(url);
      return { ok: true, json: async () => ({}) };
    },
    __bootstrap: async () => {},
    __widgetOrigin: "",
  };
  const code = readFileSync("apps/widget-v2/public/loader.js", "utf8");
  const end = code.lastIndexOf("})();");
  assert.ok(end > 0);
  runInNewContext(
    code.slice(0, end) + "globalThis.__bootstrap = fetchBootstrap; globalThis.__widgetOrigin = widgetBaseUrl;" + code.slice(end),
    context,
  );
  await context.__bootstrap();
  return { requests, widgetOrigin: context.__widgetOrigin };
}

test("generated embeds route the existing widget key to the configured API and widget deployment", () => {
  const widgets = loadWidgets("https://avenro.se/", "https://widget.avenro.se/");
  assert.equal(
    widgets.buildWidgetEmbedSnippet("existing-public-key"),
    '<script src="https://widget.avenro.se/loader.js" data-widget="existing-public-key" data-api-url="https://avenro.se"></script>',
  );
  assert.match(widgets.buildWidgetEmbedSnippet('key"<&'), /data-widget="key&quot;&lt;&amp;"/);
});

test("preview/local embed generation preserves its configured API instead of using production", () => {
  const widgets = loadWidgets("http://localhost:3000", "http://localhost:5173");
  assert.match(widgets.buildWidgetEmbedSnippet("key"), /data-api-url="http:\/\/localhost:3000"/);
  assert.equal(widgets.buildHostedWidgetUrl("key"), "http://localhost:5173/?widget=key");
});

test("static loader defaults to avenro API on a customer website", async () => {
  const result = await loaderBootstrap();
  assert.deepEqual(result.requests, ["https://avenro.se/api/public/widgets/existing-public-key/bootstrap"]);
  assert.equal(result.widgetOrigin, "https://widget.avenro.se");
});

test("static loader honors explicit API and derives iframe origin from its deployed script", async () => {
  const result = await loaderBootstrap({
    api: "https://app-preview.example/",
    globalApi: "https://other.example",
    script: "https://widget-preview.example/loader.js",
  });
  assert.deepEqual(result.requests, ["https://app-preview.example/api/public/widgets/existing-public-key/bootstrap"]);
  assert.equal(result.widgetOrigin, "https://widget-preview.example");
});

test("static loader retains local development and runtime override support", async () => {
  assert.match((await loaderBootstrap({ page: "http://localhost:3000" })).requests[0], /^http:\/\/localhost:3000\//);
  assert.match((await loaderBootstrap({ globalApi: "https://custom-api.example" })).requests[0], /^https:\/\/custom-api.example\//);
  assert.match((await loaderBootstrap({ api: "javascript:alert(1)" })).requests[0], /^https:\/\/avenro.se\//);
});

test("hosted Widget V2 resolves production, build, runtime and local API origins", () => {
  const resolve = (env = {}, window?: Record<string, unknown>) => loadModule(
    "apps/widget-v2/src/lib/api.ts", { __viteEnv: env, ...(window ? { window } : {}) },
  ).resolveWidgetApiBase();
  assert.equal(resolve(), "https://avenro.se");
  assert.equal(resolve({ VITE_API_BASE: "https://build-api.example" }), "https://build-api.example");
  assert.equal(resolve({}, { AG_WIDGET_API_URL: "https://runtime-api.example" }), "https://runtime-api.example");
  assert.equal(resolve({}, { location: { hostname: "localhost" } }), "http://localhost:3000");
});

test("SEO origin defaults to avenro and still supports explicit deployment configuration", () => {
  const origin = (env = {}) => loadModule("src/lib/site-url.ts", { process: { env } }).getSiteOrigin();
  assert.equal(origin(), "https://avenro.se");
  assert.equal(origin({ NEXT_PUBLIC_APP_URL: "https://preview.example/path" }), "https://preview.example");
});

test("normalizePrivacyPolicyUrl rewrites legacy agentergroup.com domain to active origin", () => {
  const widgets = loadWidgets("https://avenro.se", "https://widget.avenro.se");
  const normalized = widgets.normalizePrivacyPolicyUrl("https://agentergroup.com/privacy-policy");
  assert.equal(normalized, "https://avenro.se/privacy-policy");

  const defaultUrl = widgets.normalizePrivacyPolicyUrl(null);
  assert.equal(defaultUrl, "https://avenro.se/privacy-policy");
});

test("Widget V2 localized privacy policy rewrites legacy agentergroup domain to avenro.se with language", () => {
  const loc = loadModule("apps/widget-v2/src/lib/localization.ts");
  const sv = loc.buildLocalizedPrivacyPolicyUrl("https://agentergroup.com/privacy-policy", "sv");
  assert.equal(sv, "https://avenro.se/privacy-policy?lang=sv");

  const en = loc.buildLocalizedPrivacyPolicyUrl("https://dashboard.agentergroup.com/privacy-policy", "en");
  assert.equal(en, "https://avenro.se/privacy-policy?lang=en");

  const fallback = loc.buildLocalizedPrivacyPolicyUrl(null, "sv");
  assert.equal(fallback, "https://avenro.se/privacy-policy?lang=sv");
});

