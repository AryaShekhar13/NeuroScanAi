import { randomBytes } from "node:crypto";

const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url.startsWith("https://dalaconst-nebdzrfc.manus.space/"));
if (!target?.webSocketDebuggerUrl) throw new Error("The live NeuroScan browser page is not open.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let nextId = 1;
function command(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", listener);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    };
    socket.addEventListener("message", listener);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

const token = randomBytes(32).toString("base64url");
const qaUserAgent = `Mozilla/5.0 NeuroScanQA/${randomBytes(6).toString("hex")}`;
await command("Network.setUserAgentOverride", { userAgent: qaUserAgent });
const cookieResult = await command("Network.setCookie", { name: "neuroscan_demo_visitor", value: token, url: "https://dalaconst-nebdzrfc.manus.space/", httpOnly: true, secure: true, sameSite: "Lax" });
const cookies = await command("Network.getCookies", { urls: ["https://dalaconst-nebdzrfc.manus.space/"] });
const identity = await command("Runtime.evaluate", { expression: "navigator.userAgent", returnByValue: true });
if (!cookieResult.success || !cookies.cookies.some((cookie) => cookie.name === "neuroscan_demo_visitor") || identity.result.value !== qaUserAgent) throw new Error("The QA browser identity could not be established.");
await command("Page.navigate", { url: "https://dalaconst-nebdzrfc.manus.space/demo?qa=real-inference" });
socket.close();
console.log("Isolated live QA demo identity established and verified.");
