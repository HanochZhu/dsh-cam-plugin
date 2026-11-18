import { spawn } from "node:child_process";

function abortError(signal) {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error(typeof reason === "string" && reason ? reason : "The operation was aborted");
  error.name = "AbortError";
  return error;
}

export function runProcess(bin, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(bin, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });

    if (options.stdin !== undefined && child.stdin) {
      child.stdin.on("error", () => {});
      child.stdin.end(options.stdin);
    }

    const stdout = [];
    const stderr = [];
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => stdout.push(chunk));
    child.stderr?.on("data", (chunk) => stderr.push(chunk));

    const stopChild = () => {
      child.kill();
      child.stdin?.destroy();
      child.stdout?.destroy();
      child.stderr?.destroy();
    };

    const timer = setTimeout(() => {
      stopChild();
      fail(new Error(`cam timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const onAbort = () => {
      stopChild();
      fail(abortError(options.signal));
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) onAbort();

    child.on("error", (error) => {
      if (error?.code === "ENOENT") {
        fail(
          new Error(
            `cam binary not found (${bin}). Install cam and put it on PATH, or set the plugin camBin.`,
          ),
        );
        return;
      }
      fail(error);
    });

    child.on("close", (code) => {
      const out = stdout.join("").trim();
      const err = stderr.join("").trim();
      let payload;
      if (out) {
        try {
          payload = JSON.parse(out);
        } catch {
          payload = undefined;
        }
      }
      if (code !== 0) {
        const camError = payload?.error;
        const message = camError?.message
          ? `${camError.code ? `${camError.code}: ` : ""}${camError.message}`
          : err || out || `cam exited ${code}`;
        fail(new Error(message));
        return;
      }
      if (payload === undefined) {
        fail(new Error(err || out || "cam returned no JSON"));
        return;
      }
      ok(payload);
    });

    function cleanup() {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
    function ok(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
