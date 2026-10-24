/* EcoMedianeira — service worker
   Versão: mude o número a cada publicação para forçar a atualização nos aparelhos. */
const CACHE = "ecomedianeira-v12";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/data.js",
  "./js/qr.js",
  "./js/app.js",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* Os arquivos do app são sempre buscados na rede primeiro (com o cache como
   reserva offline). Antes era cache-first, e uma versão antiga do app ficava
   presa no aparelho mesmo depois de publicada uma correção. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "./index.html" : req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});

/* ---------- Compartilhar do celular para o app ----------
   Quando alguém compartilha um texto/arquivo com o EcoMedianeira, o app abre
   no formulário já preenchido com o texto recebido. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "POST") return;
  const url = new URL(req.url);
  if (url.pathname.indexOf("share-target") < 0) return;
  event.respondWith((async () => {
    try {
      const form = await req.formData();
      const text = form.get("text") || "";
      const title = form.get("title") || "";
      const conteudo = [title, text].filter(Boolean).join(" — ");
      const cache = await caches.open(CACHE);
      await cache.put("./share-recebido.json", new Response(JSON.stringify({ conteudo, em: Date.now() }), {
        headers: { "Content-Type": "application/json" }
      }));
    } catch (e) { /* segue para o formulário mesmo assim */ }
    return Response.redirect("./#/solicitar?compartilhado=1", 303);
  })());
});
