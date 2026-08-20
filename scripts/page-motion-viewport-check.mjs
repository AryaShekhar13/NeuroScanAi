import http from "node:http";

const sizes = { mobile: [375, 812], tablet: [768, 1024] };
const mode = process.argv[2] || "desktop";
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

if (mode in sizes) {
  const [width, height] = sizes[mode];
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: mode === "mobile" });
} else await call("Emulation.clearDeviceMetricsOverride");
await call("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1600));
const state = await call("Runtime.evaluate", { expression: "JSON.stringify({ url: location.pathname, width: innerWidth, height: innerHeight, pageVisible: document.querySelector('.page-motion')?.classList.contains('is-page-motion-visible'), revealed: document.querySelectorAll('.is-page-content-revealed').length })", returnByValue: true });
console.log(state.result.value);
socket.close();
