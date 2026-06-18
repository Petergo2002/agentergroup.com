#!/usr/bin/env node

import { performance } from "node:perf_hooks";

const DEFAULT_CONCURRENCY = [20, 50, 100];
const DEFAULT_MESSAGE = "Hello! Please reply with one short sentence only.";

function printHelp() {
  console.log(`Usage:
  npm run widget:load-test -- --base-url <url> --widget-public-key <key> --widget-origin <origin> [options]

Required:
  --base-url <url>            Dashboard/API base URL, e.g. https://dashboard.agentergroup.com
  --widget-public-key <key>   Public widget key to test
  --widget-origin <origin>    Widget runtime origin, e.g. https://widget.agentergroup.com

Mode:
  --mode hosted|embedded      Test mode (default: hosted)
  --embed-origin <origin>     Required for embedded bootstrap mode

Options:
  --profiles <list>           Concurrency profile, e.g. 20,50,100
  --message <text>            Chat message used for each turn
  --with-events               Send /events before each chat turn
  --help                      Show this message
`);
}

function parseArgs(argv) {
  const options = {
    mode: "hosted",
    profiles: [...DEFAULT_CONCURRENCY],
    withEvents: false,
    message: DEFAULT_MESSAGE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];

    if (!raw.startsWith("--")) {
      continue;
    }

    const [flag, inlineValue] = raw.split("=", 2);
    const value =
      inlineValue !== undefined
        ? inlineValue
        : argv[index + 1] && !argv[index + 1].startsWith("--")
          ? argv[++index]
          : undefined;

    switch (flag) {
      case "--help":
        options.help = true;
        break;
      case "--base-url":
        options.baseUrl = value;
        break;
      case "--widget-public-key":
        options.widgetPublicKey = value;
        break;
      case "--widget-origin":
        options.widgetOrigin = value;
        break;
      case "--embed-origin":
        options.embedOrigin = value;
        break;
      case "--mode":
        options.mode = value ?? options.mode;
        break;
      case "--profiles":
        options.profiles = (value ?? "")
          .split(",")
          .map((item) => Number.parseInt(item.trim(), 10))
          .filter((item) => Number.isFinite(item) && item > 0);
        break;
      case "--message":
        options.message = value ?? DEFAULT_MESSAGE;
        break;
      case "--with-events":
        options.withEvents = true;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  return options;
}

function ensureOrigin(value, name) {
  if (!value) {
    throw new Error(`Missing required option: ${name}`);
  }

  const parsed = new URL(value);
  return parsed.origin;
}

function buildUrl(baseUrl, widgetPublicKey, path) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}/api/public/widgets/${encodeURIComponent(widgetPublicKey)}${path}`;
}

function createSessionId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value) {
  if (value === null || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

function incrementCounter(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function parseJsonSafe(response) {
  return response.json().catch(() => null);
}

async function bootstrapWidget({
  baseUrl,
  widgetPublicKey,
  origin,
}) {
  const startedAt = performance.now();
  const response = await fetch(buildUrl(baseUrl, widgetPublicKey, "/bootstrap"), {
    headers: {
      Origin: origin,
    },
  });
  const durationMs = performance.now() - startedAt;

  if (!response.ok) {
    const payload = await parseJsonSafe(response);
    return {
      ok: false,
      status: response.status,
      code: typeof payload?.code === "string" ? payload.code : null,
      error:
        typeof payload?.error === "string"
          ? payload.error
          : `Bootstrap failed with ${response.status}.`,
      durationMs,
    };
  }

  const payload = await response.json();
  return {
    ok: true,
    durationMs,
    accessToken: typeof payload.accessToken === "string" ? payload.accessToken : null,
    source: payload.source ?? null,
  };
}

async function sendWidgetEvent({
  baseUrl,
  widgetPublicKey,
  runtimeOrigin,
  accessToken,
  sessionId,
}) {
  const response = await fetch(buildUrl(baseUrl, widgetPublicKey, "/events"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: runtimeOrigin,
      "x-ag-widget-access-token": accessToken,
    },
    body: JSON.stringify({
      sessionId,
      event: "load_test_presence",
      occurredAt: new Date().toISOString(),
      pageUrl: `${runtimeOrigin}/load-test`,
      referrer: runtimeOrigin,
    }),
  });

  if (response.ok) {
    return { ok: true, status: response.status, code: null };
  }

  const payload = await parseJsonSafe(response);
  return {
    ok: false,
    status: response.status,
    code: typeof payload?.code === "string" ? payload.code : null,
    error:
      typeof payload?.error === "string"
        ? payload.error
        : `Events request failed with ${response.status}.`,
  };
}

async function runChatTurn({
  baseUrl,
  widgetPublicKey,
  runtimeOrigin,
  accessToken,
  sessionId,
  message,
}) {
  const requestStartedAt = performance.now();
  const response = await fetch(buildUrl(baseUrl, widgetPublicKey, "/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: runtimeOrigin,
      "x-ag-widget-access-token": accessToken,
    },
    body: JSON.stringify({
      sessionId,
      message,
      language: "en",
      pageUrl: `${runtimeOrigin}/load-test`,
      referrer: runtimeOrigin,
    }),
  });

  if (!response.ok) {
    const payload = await parseJsonSafe(response);
    return {
      ok: false,
      status: response.status,
      code: typeof payload?.code === "string" ? payload.code : null,
      error:
        typeof payload?.error === "string"
          ? payload.error
          : `Chat request failed with ${response.status}.`,
      durationMs: performance.now() - requestStartedAt,
      firstChunkMs: null,
      streamError: null,
      assistantChars: 0,
    };
  }

  if (!response.body) {
    return {
      ok: false,
      status: response.status,
      code: "CHAT_NO_BODY",
      error: "Chat response body was missing.",
      durationMs: performance.now() - requestStartedAt,
      firstChunkMs: null,
      streamError: null,
      assistantChars: 0,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstChunkMs = null;
  let assistantContent = "";
  let streamError = null;
  let done = false;
  let receivedDoneEvent = false;

  while (!done) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex !== -1) {
      const eventBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      for (const line of eventBlock.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          receivedDoneEvent = true;
          done = true;
          break;
        }

        try {
          const parsed = JSON.parse(data);
          if (
            firstChunkMs === null &&
            (typeof parsed?.delta === "string" || typeof parsed?.content === "string")
          ) {
            firstChunkMs = performance.now() - requestStartedAt;
          }
          if (typeof parsed?.delta === "string") {
            assistantContent += parsed.delta;
          }
          if (typeof parsed?.content === "string") {
            assistantContent = parsed.content;
          }
          if (typeof parsed?.error === "string") {
            streamError = parsed.error;
            done = true;
            break;
          }
        } catch {
          streamError = "The chat stream contained malformed data.";
          done = true;
          break;
        }
      }

      if (done) {
        break;
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  if (!streamError && !receivedDoneEvent) {
    streamError = "The chat stream ended before the [DONE] event.";
  } else if (!streamError && assistantContent.trim().length === 0) {
    streamError = "The chat stream completed without assistant content.";
  }

  return {
    ok: streamError === null,
    status: response.status,
    code: streamError ? "STREAM_ERROR" : null,
    error: streamError,
    durationMs: performance.now() - requestStartedAt,
    firstChunkMs,
    streamError,
    assistantChars: assistantContent.length,
  };
}

async function runScenario({
  baseUrl,
  widgetPublicKey,
  bootstrapOrigin,
  runtimeOrigin,
  message,
  withEvents,
  scenarioKey,
  index,
}) {
  const sessionId = createSessionId(`${scenarioKey}_${index}`);
  const bootstrap = await bootstrapWidget({
    baseUrl,
    widgetPublicKey,
    origin: bootstrapOrigin,
  });

  if (!bootstrap.ok) {
    return {
      bootstrap,
      event: null,
      chat: null,
    };
  }

  let event = null;
  if (withEvents && bootstrap.accessToken) {
    event = await sendWidgetEvent({
      baseUrl,
      widgetPublicKey,
      runtimeOrigin,
      accessToken: bootstrap.accessToken,
      sessionId,
    });
  }

  const chat = await runChatTurn({
    baseUrl,
    widgetPublicKey,
    runtimeOrigin,
    accessToken: bootstrap.accessToken,
    sessionId,
    message,
  });

  return {
    bootstrap,
    event,
    chat,
  };
}

function summarizeEndpointFailures(results, endpoint) {
  const counts = new Map();

  for (const result of results) {
    const value = result[endpoint];
    if (!value || value.ok) continue;
    const key = `${value.status}:${value.code ?? "NO_CODE"}`;
    incrementCounter(counts, key);
  }

  return Object.fromEntries(counts.entries());
}

function summarizeBatch(results) {
  const bootstrapLatencies = results
    .map((result) => result.bootstrap?.durationMs)
    .filter((value) => typeof value === "number");
  const firstChunkLatencies = results
    .map((result) => result.chat?.firstChunkMs)
    .filter((value) => typeof value === "number");
  const fullTurnDurations = results
    .map((result) => result.chat?.durationMs)
    .filter((value) => typeof value === "number");

  return {
    totalSessions: results.length,
    bootstrapFailures: summarizeEndpointFailures(results, "bootstrap"),
    chatFailures: summarizeEndpointFailures(results, "chat"),
    eventFailures: summarizeEndpointFailures(results, "event"),
    bootstrap: {
      averageMs: roundMetric(average(bootstrapLatencies)),
      p95Ms: roundMetric(percentile(bootstrapLatencies, 0.95)),
    },
    chat: {
      firstChunkAverageMs: roundMetric(average(firstChunkLatencies)),
      firstChunkP95Ms: roundMetric(percentile(firstChunkLatencies, 0.95)),
      fullTurnAverageMs: roundMetric(average(fullTurnDurations)),
      fullTurnP95Ms: roundMetric(percentile(fullTurnDurations, 0.95)),
    },
  };
}

async function runDoubleSubmitScenario({
  baseUrl,
  widgetPublicKey,
  bootstrapOrigin,
  runtimeOrigin,
  message,
}) {
  const bootstrap = await bootstrapWidget({
    baseUrl,
    widgetPublicKey,
    origin: bootstrapOrigin,
  });

  if (!bootstrap.ok || !bootstrap.accessToken) {
    return {
      bootstrap,
      anomaly: true,
      summary: "Double-submit bootstrap failed before chat.",
      results: [],
    };
  }

  const sessionId = createSessionId("double_submit");
  const [first, second] = await Promise.all([
    runChatTurn({
      baseUrl,
      widgetPublicKey,
      runtimeOrigin,
      accessToken: bootstrap.accessToken,
      sessionId,
      message,
    }),
    runChatTurn({
      baseUrl,
      widgetPublicKey,
      runtimeOrigin,
      accessToken: bootstrap.accessToken,
      sessionId,
      message,
    }),
  ]);

  const busyCount = [first, second].filter(
    (result) => !result.ok && result.code === "SESSION_BUSY",
  ).length;
  const successCount = [first, second].filter((result) => result.ok).length;
  const anomaly = !(successCount === 1 && busyCount === 1);

  return {
    bootstrap,
    anomaly,
    summary: anomaly
      ? "Expected one success and one SESSION_BUSY response."
      : "Observed one success and one SESSION_BUSY response.",
    results: [first, second],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.baseUrl || !options.widgetPublicKey || !options.widgetOrigin) {
    printHelp();
    throw new Error("Missing required options.");
  }

  if (!["hosted", "embedded"].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  const widgetOrigin = ensureOrigin(options.widgetOrigin, "--widget-origin");
  const bootstrapOrigin =
    options.mode === "embedded"
      ? ensureOrigin(options.embedOrigin, "--embed-origin")
      : widgetOrigin;

  const runtimeOrigin = widgetOrigin;
  const summary = {
    config: {
      baseUrl: options.baseUrl,
      widgetPublicKey: options.widgetPublicKey,
      mode: options.mode,
      bootstrapOrigin,
      runtimeOrigin,
      profiles: options.profiles,
      withEvents: options.withEvents,
    },
    batches: [],
    doubleSubmit: null,
  };

  for (const concurrency of options.profiles) {
    console.log(`Running ${options.mode} batch at concurrency ${concurrency}...`);
    const startedAt = performance.now();
    const results = await Promise.all(
      Array.from({ length: concurrency }, (_, index) =>
        runScenario({
          baseUrl: options.baseUrl,
          widgetPublicKey: options.widgetPublicKey,
          bootstrapOrigin,
          runtimeOrigin,
          message: options.message,
          withEvents: options.withEvents,
          scenarioKey: `batch_${concurrency}`,
          index,
        }),
      ),
    );

    summary.batches.push({
      concurrency,
      elapsedMs: roundMetric(performance.now() - startedAt),
      ...summarizeBatch(results),
    });
  }

  console.log("Running same-session double-submit scenario...");
  summary.doubleSubmit = await runDoubleSubmitScenario({
    baseUrl: options.baseUrl,
    widgetPublicKey: options.widgetPublicKey,
    bootstrapOrigin,
    runtimeOrigin,
    message: options.message,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
