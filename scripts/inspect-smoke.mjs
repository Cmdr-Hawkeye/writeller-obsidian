// Read-only debugging of the generated test profile. Never attaches to a personal vault.
const pages = await (await globalThis.fetch('http://127.0.0.1:9223/json/list')).json();
const page = pages.find(p => p.type === 'page' && p.title.includes('Writeller-Testvault'));
if (!page) throw new Error('Isoliertes Testprofil nicht gefunden');
const socket = new globalThis.WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
const response = new Promise(resolve => socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id === 1) resolve(data); }));
socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'JSON.stringify({title:document.title,body:document.body.innerText,pluginIds:Object.keys(app.plugins.plugins)})', returnByValue: true } }));
console.log(JSON.stringify(await response, null, 2)); socket.close();
