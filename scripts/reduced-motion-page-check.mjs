import http from "node:http";

const readJson = (url) => new Promise((resolve, reject) => http.get(url, (response) => {
  let body = ""; response.setEncoding("utf8"); response.on("data", (chunk) => { body += chunk; }); response.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
}).on("error", reject));
const pages = await readJson("http://localhost:9222/json");
const page = pages.find((target) => target.type === "page" && target.url.includes("3000-i0noj5lrfhn1d4puauzrl"));
if (!page?.webSocketDebuggerUrl) throw new Error("No active NeuroScan browser page was found.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let nextId = 1;
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; const onMessage = (event) => { const message = JSON.parse(event.data); if (message.id !== id) return; socket.removeEventListener("message", onMessage); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }; socket.addEventListener("message", onMessage); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await call("Runtime.evaluate", { expression, returnByValue: true })).result.value;

try {
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await call("Page.reload", { ignoreCache: true });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await evaluate("Boolean(document.querySelector('.demo-page > .study-form, .auth-main > .auth-form, .clinical-main > section, .app-main > section, .dashboard-main > *'))")) break;
  }
  const result = await evaluate("(() => { const page = document.querySelector('.page-motion'); const target = document.querySelector('.demo-page > .study-form, .auth-main > .auth-form, .clinical-main > section, .app-main > section, .dashboard-main > *'); return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, pageTransition: page ? getComputedStyle(page).transitionDuration : null, targetTransition: target ? getComputedStyle(target).transitionDuration : null, opacity: target ? getComputedStyle(target).opacity : null }; })()");
  if (!result?.reduced || Number.parseFloat(result.pageTransition) > 0.00002 || Number.parseFloat(result.targetTransition) > 0.00002 || result.opacity !== "1") throw new Error(`Reduced-motion verification failed: ${JSON.stringify(result)}`);
  console.log(JSON.stringify(result));
} finally {
  await call("Emulation.setEmulatedMedia", { features: [] });
  await call("Page.reload", { ignoreCache: true });
  socket.close();
}
