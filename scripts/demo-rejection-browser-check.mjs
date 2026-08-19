import http from "node:http";

const baseUrl = "https://3000-i0noj5lrfhn1d4puauzrl-51195bad.sg1.manus.computer";
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
const cookies = (await call("Network.getAllCookies")).cookies;
const originalDemoCookie = cookies.find((cookie) => cookie.name === "neuroscan_demo_visitor" && cookie.domain.includes("3000-i0noj5lrfhn1d4puauzrl"));
const originalUserAgent = await evaluate("navigator.userAgent");
try {
  await call("Network.setUserAgentOverride", { userAgent: `${originalUserAgent} NeuroScanDemoRejectionQA/1.0` });
  await call("Network.deleteCookies", { name: "neuroscan_demo_visitor", url: baseUrl });
  await call("Page.navigate", { url: `${baseUrl}/demo` });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await evaluate("Boolean(document.querySelector('input[type=\\\"file\\\"]'))")) break;
  }
  const result = await evaluate(`(() => {
    const input = document.querySelector('input[type="file"]');
    if (!input) return { error: 'demo input unavailable' };
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([77, 90])], 'unsupported.nii', { type: 'application/octet-stream' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes('Run AI analysis'));
    return { ignored: document.body.textContent?.includes('No supported compressed NIfTI MRI files were detected.') === true, disabled: button?.disabled === true };
  })()`);
  if (!result?.ignored || !result?.disabled) throw new Error(`Unsupported upload was not rejected in the browser: ${JSON.stringify(result)}`);
  console.log(JSON.stringify(result));
} finally {
  await call("Network.setUserAgentOverride", { userAgent: originalUserAgent });
  await call("Network.deleteCookies", { name: "neuroscan_demo_visitor", url: baseUrl });
  if (originalDemoCookie) await call("Network.setCookie", { name: originalDemoCookie.name, value: originalDemoCookie.value, domain: originalDemoCookie.domain, path: originalDemoCookie.path, secure: originalDemoCookie.secure, httpOnly: originalDemoCookie.httpOnly, sameSite: originalDemoCookie.sameSite, expires: originalDemoCookie.expires });
  await call("Page.navigate", { url: `${baseUrl}/studies/30001` });
  socket.close();
}
