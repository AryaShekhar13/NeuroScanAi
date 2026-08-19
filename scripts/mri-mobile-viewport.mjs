import http from "node:http";

const mode = process.argv[2] || "mobile";
const readJson = (url) => new Promise((resolve, reject) => http.get(url, (response) => {
  let body = "";
  response.setEncoding("utf8");
  response.on("data", (chunk) => { body += chunk; });
  response.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
}).on("error", reject));

const pages = await readJson("http://localhost:9222/json");
const page = pages.find((target) => target.type === "page" && target.url.includes("/studies/30001"));
if (!page?.webSocketDebuggerUrl) throw new Error("The authenticated MRI viewer page is not open for viewport verification.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let nextId = 1;
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  const onMessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== id) return;
    socket.removeEventListener("message", onMessage);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  };
  socket.addEventListener("message", onMessage);
  socket.send(JSON.stringify({ id, method, params }));
});

if (mode === "mobile") {
  await call("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await call("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 1500));
} else {
  await call("Emulation.clearDeviceMetricsOverride");
  await call("Page.reload", { ignoreCache: true });
}

await new Promise((resolve) => setTimeout(resolve, 1000));
const viewport = await call("Runtime.evaluate", { expression: "JSON.stringify({ width: window.innerWidth, height: window.innerHeight, sliceControlColumns: getComputedStyle(document.querySelector('.slice-controls')).gridTemplateColumns })", returnByValue: true });
console.log(JSON.stringify(viewport));
socket.close();
