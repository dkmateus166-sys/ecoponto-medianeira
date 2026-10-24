/* ============================================================
   app.js — EcoMedianeira
   Reciclagem e coleta de eletrônicos em Medianeira/PR.
   100% offline-first (localStorage + fila de sincronização).
   ============================================================ */
(function () {
  "use strict";

  const D = window.ECO_DATA;
  const $ = (s, r) => (r || document).querySelector(s);
  // querySelectorAll tolerante: sempre devolve um array (mesmo em navegadores antigos)
  const $$ = (s, r) => {
    const lista = (r || document).querySelectorAll(s);
    return lista ? Array.prototype.slice.call(lista) : [];
  };
  // Alterna a visibilidade do elemento e do seu contêiner .field, sem quebrar
  // quando o elemento ainda não existe (ex.: campo criado dinamicamente).
  function toggleField(id, visible) {
    const el = $(id);
    if (!el) return;
    el.hidden = !visible;
    const field = el.parentNode && el.parentNode.classList && el.parentNode.classList.contains("field")
      ? el.parentNode : null;
    if (field) field.hidden = !visible;
  }

  /* ---------- utilidades ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const fmtDateTime = (ts) => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
  const num = (v) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const fmtKg = (kg) => (kg >= 1000 ? (kg / 1000).toFixed(2).replace(".", ",") + " t" : kg.toFixed(kg < 10 ? 2 : 1).replace(".", ",") + " kg");
  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
  const fmtMoney = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const DAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  function toast(msg, kind) {
    const box = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3200);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      return true;
    } catch { return false; }
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  /* ---------- armazenamento ---------- */
  const K = {
    requests: "eco.requests.v1", profile: "eco.profile.v1", queue: "eco.queue.v1",
    theme: "eco.theme.v1", admin: "eco.admin.v1", log: "eco.log.v1", sync: "eco.sync.v1"
  };
  const store = {
    get(key, fallback) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
      catch { return fallback; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { toast("Armazenamento cheio — exporte um backup", "err"); return false; } },
    del(key) { try { localStorage.removeItem(key); } catch {} }
  };

  const state = {
    requests: [], profile: null, queue: [], admin: false,
    view: "inicio", filters: { cat: "", bairro: "", openNow: false, q: "" },
    lastSync: null, installing: false, lanIp: "", selectedPoint: "", mapType: "ruas"
  };

  /* ============================================================
     Regras de negócio (puras — testadas em tests/logic.test.js)
     ============================================================ */

  // Peso estimado em kg de uma lista de itens [{catId, qtd}]
  function estimateWeight(items) {
    return (items || []).reduce((sum, it) => {
      const c = D.CATEGORIES.find((x) => x.id === it.catId);
      return sum + (c ? c.peso * Math.max(0, num(it.qtd)) : 0);
    }, 0);
  }

  // Impacto ambiental a partir do peso (kg)
  function impactOf(kg) {
    const I = D.IMPACT;
    return {
      kg,
      co2: kg * I.co2PorKg,
      agua: kg * I.aguaPorKg,
      cobre: kg * I.cobrePorKg,
      ouro: kg * I.ouroPorGrama,
      aterro: kg * I.aterroPorKg,
      carroKm: kg * I.carroKmPorKg
    };
  }

  // Pontos que aceitam TODAS as categorias informadas
  function pointsFor(items) {
    const cats = (items || []).filter((i) => num(i.qtd) > 0).map((i) => i.catId);
    if (!cats.length) return D.POINTS.slice();
    return D.POINTS.filter((p) => cats.every((c) => p.aceita.indexOf(c) >= 0));
  }

  // Distância em km (Haversine)
  function distanceKm(a, b) {
    const R = 6371, toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function pointsSortedByDistance(from) {
    const origin = from && Number.isFinite(from.lat) ? from : D.CITY;
    return D.POINTS.map((p) => ({ ...p, dist: distanceKm(origin, p) })).sort((a, b) => a.dist - b.dist);
  }

  // Ponto aberto agora? (date = Date injetável para testes)
  function isOpen(point, date) {
    const d = date || new Date();
    const day = d.getDay();
    if (point.dias.indexOf(day) < 0) return false;
    const [h, m] = String(point.abre || "00:00").split(":").map(Number);
    const [h2, m2] = String(point.fecha || "23:59").split(":").map(Number);
    const now = d.getHours() * 60 + d.getMinutes();
    const start = h * 60 + (m || 0), end = h2 * 60 + (m2 || 0);
    if (start === 0 && end >= 23 * 60 + 59) return true; // 24h
    if (end < start) return now >= start || now <= end; // atravessa a meia-noite
    return now >= start && now <= end;
  }

  // Próximo dia de coleta para o bairro (dias: 0=dom..6=sáb)
  function nextPickupDate(bairro, from) {
    const days = D.PICKUP_DAYS[bairro] || D.PICKUP_DAYS["Outro"];
    const base = from ? new Date(from) : new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 1; i <= 14; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      if (days.indexOf(d.getDay()) >= 0) return isoOf(d);
    }
    return isoOf(new Date(base.getTime() + 86400000));
  }

  // Código de protocolo: MED-AAAA-XXXXXX (sem caracteres ambíguos)
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function makeProtocol(year, rand) {
    const r = rand || Math.random;
    let code = "";
    for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(r() * ALPHABET.length)];
    return `MED-${year}-${code}`;
  }

  function uniqueProtocol(existing) {
    const year = new Date().getFullYear();
    const used = new Set((existing || []).map((r) => r.protocolo));
    let code = makeProtocol(year);
    let guard = 0;
    while (used.has(code) && guard++ < 50) code = makeProtocol(year);
    return code;
  }

  // Validação do formulário de coleta
  function validateRequest(form) {
    const errors = {};
    if (!form.nome || form.nome.trim().length < 3) errors.nome = "Informe seu nome completo (mín. 3 letras).";
    const tel = onlyDigits(form.telefone);
    if (tel.length < 10 || tel.length > 11) errors.telefone = "Telefone com DDD, ex.: (45) 99999-9999.";
    else if (!/^45\d{8,9}$/.test(tel)) errors.telefone = "Use um número do DDD 45 (Medianeira).";
    if (!form.bairro) errors.bairro = "Escolha o bairro.";
    if (!form.endereco || form.endereco.trim().length < 5) errors.endereco = "Informe rua e número.";
    if (!form.itens || !form.itens.some((i) => num(i.qtd) > 0)) errors.itens = "Selecione ao menos um tipo de equipamento.";
    if (form.itens && form.itens.some((i) => i.catId === "grande" && num(i.qtd) > 0) && form.modalidade !== "ecoponto") {
      errors.itens = "Linha branca (geladeira, fogão) só é aceita no Ecoponto Municipal — mude a modalidade.";
    }
    const kg = estimateWeight(form.itens);
    if (kg > 20 && form.modalidade === "domiciliar") errors.itens = "Acima de 20 kg use o Ecoponto Municipal ou a cooperativa.";
    if (form.modalidade === "domiciliar" && !form.data) errors.data = "Escolha a data da coleta.";
    if (form.modalidade === "domiciliar" && form.data) {
      const d = new Date(form.data + "T12:00:00");
      const days = D.PICKUP_DAYS[form.bairro] || D.PICKUP_DAYS["Outro"];
      if (d < new Date(todayISO() + "T00:00:00")) errors.data = "A data não pode estar no passado.";
      else if (days.indexOf(d.getDay()) < 0) errors.data = `Neste bairro a coleta acontece: ${days.map((x) => DAY_NAMES[x]).join(", ")}.`;
    }
    return { ok: Object.keys(errors).length === 0, errors, kg };
  }

  function makeRequest(form, existing) {
    return {
      protocolo: uniqueProtocol(existing),
      criadoEm: Date.now(),
      nome: form.nome.trim(),
      telefone: onlyDigits(form.telefone),
      email: (form.email || "").trim(),
      bairro: form.bairro,
      endereco: form.endereco.trim(),
      complemento: (form.complemento || "").trim(),
      referencia: (form.referencia || "").trim(),
      itens: form.itens.filter((i) => num(i.qtd) > 0).map((i) => ({ catId: i.catId, qtd: Math.max(1, Math.round(num(i.qtd))) })),
      kg: estimateWeight(form.itens),
      modalidade: form.modalidade,
      pontoId: form.pontoId || "",
      data: form.data || "",
      janela: form.janela || "",
      obs: (form.obs || "").trim(),
      status: "pendente",
      historico: [{ status: "pendente", em: Date.now(), nota: "Solicitação registrada no app." }],
      sync: "local"
    };
  }

  const statusOf = (id) => D.STATUS.find((s) => s.id === id) || D.STATUS[0];
  function statusIndex(id) { return D.STATUS.findIndex((s) => s.id === id); }

  function setStatus(req, status, nota) {
    if (statusIndex(status) < 0) return false;
    req.status = status;
    req.historico = req.historico || [];
    req.historico.push({ status, em: Date.now(), nota: nota || statusOf(status).desc });
    return true;
  }

  function levelOf(count) {
    let lvl = D.LEVELS[0], next = null;
    for (let i = 0; i < D.LEVELS.length; i++) {
      if (count >= D.LEVELS[i].min) { lvl = D.LEVELS[i]; next = D.LEVELS[i + 1] || null; }
    }
    return { level: lvl, next, progress: next ? (count - lvl.min) / (next.min - lvl.min) : 1 };
  }

  // Estatísticas gerais (painel admin e perfil)
  function computeStats(list) {
    const active = (list || []).filter((r) => r.status !== "cancelada");
    const done = active.filter((r) => r.status === "reciclada");
    const kg = done.reduce((s, r) => s + num(r.kg), 0);
    const byCat = {};
    done.forEach((r) => (r.itens || []).forEach((it) => { byCat[it.catId] = (byCat[it.catId] || 0) + num(it.qtd); }));
    const byBairro = {};
    active.forEach((r) => { byBairro[r.bairro] = (byBairro[r.bairro] || 0) + 1; });
    const byStatus = {};
    D.STATUS.forEach((s) => { byStatus[s.id] = active.filter((r) => r.status === s.id).length; });
    return {
      total: active.length,
      pendentes: byStatus.pendente || 0,
      recicladas: done.length,
      kg,
      // o painel também mostra o peso já estimado de tudo que foi solicitado
    impact: impactOf(kg),
    kgSolicitado: active.reduce((s, r) => s + num(r.kg), 0),
      byCat, byBairro, byStatus,
      ultima: active.slice().sort((a, b) => b.criadoEm - a.criadoEm)[0] || null
    };
  }

  function filterRequests(list, f) {
    const q = (f.q || "").toLowerCase().trim();
    return (list || []).filter((r) => {
      if (f.status && r.status !== f.status) return false;
      if (f.bairro && r.bairro !== f.bairro) return false;
      if (!q) return true;
      const hay = [r.protocolo, r.nome, r.endereco, r.bairro, r.telefone].join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function exportCsv(list) {
    const head = ["protocolo", "criadoEm", "nome", "telefone", "bairro", "endereco", "itens", "kg", "modalidade", "data", "status"];
    const lines = [head.join(";")];
    (list || []).forEach((r) => {
      const itens = (r.itens || []).map((i) => `${i.catId}:${i.qtd}`).join("|");
      const row = [r.protocolo, new Date(r.criadoEm).toISOString(), r.nome, r.telefone, r.bairro, r.endereco, itens, num(r.kg).toFixed(2), r.modalidade, r.data, r.status];
      lines.push(row.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";"));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  /* ============================================================
     Persistência + fila de sincronização
     ============================================================ */
  function save() {
    store.set(K.requests, state.requests);
    store.set(K.queue, state.queue);
  }
  function load() {
    state.requests = store.get(K.requests, []);
    state.queue = store.get(K.queue, []);
    state.profile = store.get(K.profile, null);
    state.admin = store.get(K.admin, false) === true;
    state.lastSync = store.get(K.sync, null);
  }
  function enqueue(protocolo) {
    if (state.queue.indexOf(protocolo) < 0) state.queue.push(protocolo);
    save();
    renderSync();
  }
  function syncNow(silent) {
    if (!navigator.onLine) { if (!silent) toast("Sem internet — salvo no aparelho, enviamos depois.", "warn"); renderSync(); return; }
    const n = state.queue.length;
    state.queue.forEach((p) => {
      const r = state.requests.find((x) => x.protocolo === p);
      if (r) r.sync = "enviado";
    });
    state.queue = [];
    state.lastSync = Date.now();
    store.set(K.sync, state.lastSync);
    save();
    renderSync();
    if (!silent) toast(n ? `${n} solicitação(ões) sincronizada(s).` : "Tudo sincronizado.", "ok");
  }

  /* ============================================================
     QR Code (usa js/qr.js)
     ============================================================ */
  function requestUrl(protocolo) {
    const base = location.href.split("#")[0];
    return base + "#/protocolo?id=" + encodeURIComponent(protocolo);
  }
  function drawQr(canvas, text, size) {
    // QR desativado nesta versão (ver js/qr.js). Retorna false sem quebrar a tela.
    if (canvas) canvas.hidden = true;
    return false;
  }

  /* ============================================================
     Roteamento (#/rota)
     ============================================================ */
  const ROUTES = ["inicio", "solicitar", "pontos", "acompanhar", "impacto", "aprender", "instalar", "admin", "protocolo"];
  function parseHash() {
    const h = (location.hash || "#/inicio").replace(/^#\/?/, "");
    const [path, query] = h.split("?");
    const params = {};
    (query || "").split("&").forEach((kv) => { if (kv) { const [k, v] = kv.split("="); params[decodeURIComponent(k)] = decodeURIComponent(v || ""); } });
    const name = ROUTES.indexOf(path) >= 0 ? path : "inicio";
    return { name, params };
  }
  function go(name, params) {
    const q = params ? "?" + Object.keys(params).map((k) => k + "=" + encodeURIComponent(params[k])).join("&") : "";
    location.hash = "#/" + name + q;
  }

  /* ============================================================
     Render — Início
     ============================================================ */
  function renderHome() {
    const stats = computeStats(state.requests);
    const lvl = levelOf(stats.recicladas);
    const nextPickup = state.profile ? nextPickupDate(state.profile.bairro) : null;
    const impact = stats.impact;
    $("#home-stats").innerHTML = `
      <div class="stat"><span class="stat-num">${fmtInt(stats.total)}</span><span class="stat-label">solicitações</span></div>
      <div class="stat"><span class="stat-num">${fmtKg(stats.kg)}</span><span class="stat-label">reciclados</span></div>
      <div class="stat"><span class="stat-num">${fmtInt(impact.co2)} kg</span><span class="stat-label">CO₂ evitados</span></div>
      <div class="stat"><span class="stat-num">${D.POINTS.length}</span><span class="stat-label">pontos de coleta</span></div>`;
    $("#home-level").innerHTML = `
      <div class="level-badge">${lvl.level.emoji} <strong>${lvl.level.nome}</strong></div>
      <div class="progress"><span style="width:${Math.round(lvl.progress * 100)}%"></span></div>
      <p class="muted small">${lvl.next ? `${lvl.next.min - stats.recicladas} coleta(s) para ${lvl.next.nome} ${lvl.next.emoji}` : "Você chegou ao nível máximo! 🏆"}</p>`;
    $("#home-pickup").textContent = nextPickup
      ? `Próxima coleta no seu bairro (${state.profile.bairro}): ${fmtDate(nextPickup)}`
      : "Informe seu bairro em Perfil para ver o próximo dia de coleta.";
    $("#home-pontos").innerHTML = pointsSortedByDistance(state.profile).slice(0, 3).map(pointCard).join("");
  }

  // Origem das distâncias: coordenadas do morador (se houver) ou o centro da cidade.
  // O perfil pode existir sem coordenadas, por isso a validação do par lat/lng.
  function profileOrigin() {
    const pf = state.profile;
    if (pf && Number.isFinite(pf.lat) && Number.isFinite(pf.lng)) return { lat: pf.lat, lng: pf.lng };
    return { lat: D.CITY.lat, lng: D.CITY.lng };
  }

  function pointCard(p) {
    const open = isOpen(p);
    const sel = state.selectedPoint === p.id ? " selected" : "";
    return `<article class="card point${sel}" data-card="${esc(p.id)}">
      <div class="point-head">
        <h3>${esc(p.nome)}</h3>
        <span class="pill ${open ? "ok" : "off"}">${open ? "Aberto agora" : "Fechado"}</span>
      </div>
      <p class="muted small">${esc(p.endereco)}</p>
      <p class="small">🕒 ${esc(p.horario)} · ${p.abre === "00:00" && p.fecha === "23:59" ? "24h" : p.abre + "–" + p.fecha}
        ${Number.isFinite(p.dist) ? " · 📍 " + p.dist.toFixed(1).replace(".", ",") + " km do centro" : ""}</p>
      <div class="tags">${p.aceita.map((c) => {
        const cat = D.CATEGORIES.find((x) => x.id === c);
        return cat ? `<span class="tag">${cat.emoji} ${esc(cat.nome)}</span>` : "";
      }).join("")}</div>
      <div class="row-actions">
        <a class="btn ghost sm" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}" target="_blank" rel="noopener">Abrir no mapa</a>
        <a class="btn ghost sm" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">Rota</a>
        ${p.telefone ? `<a class="btn ghost sm" href="tel:${onlyDigits(p.telefone)}">Ligar</a>` : ""}
        <button class="btn sm" data-solicitar-ponto="${p.id}">Solicitar coleta</button>
      </div>
    </article>`;
  }

  /* ============================================================
     Render — Pontos
     ============================================================ */
  function renderPoints() {
    const list = D.POINTS.filter((p) => {
      if (state.filters.bairro && p.bairro !== state.filters.bairro) return false;
      if (state.filters.cat && p.aceita.indexOf(state.filters.cat) < 0) return false;
      if (state.filters.openNow && !isOpen(p)) return false;
      if (state.filters.q) {
        const hay = (p.nome + " " + p.endereco + " " + p.bairro).toLowerCase();
        if (hay.indexOf(state.filters.q.toLowerCase()) < 0) return false;
      }
      return true;
    });
    const origin = profileOrigin();
    const sorted = list.map((p) => ({ ...p, dist: distanceKm(origin, p) })).sort((a, b) => a.dist - b.dist);
    $("#pontos-count").textContent = `${sorted.length} ponto(s) encontrado(s)`;
    $("#pontos-list").innerHTML = sorted.length ? sorted.map(pointCard).join("")
      : `<p class="empty">Nenhum ponto com esses filtros. Tente ampliar a busca.</p>`;
    $("#pontos-map").innerHTML = mapSvg(sorted);
    bindMap();
    bindMapas();
    if (leafletDisponivel()) initLeaflet(sorted);
  }

  // ============================================================
  //  Mapa da cidade (SVG interativo, sem internet)
  //  - camadas: bairros, ruas principais, referências e pontos de coleta
  //  - zoom (roda/botões/pinça), arrastar, clique no pino e lista lateral
  //  - "Minha localização" usa o GPS do celular quando permitido
  // ============================================================
  const MAP = { W: 900, H: 620, pad: 34 };

  function mapProject(lat, lng) {
    const b = D.CITY.bbox;
    return {
      x: MAP.pad + ((lng - b.minLng) / (b.maxLng - b.minLng)) * (MAP.W - MAP.pad * 2),
      y: MAP.H - MAP.pad - ((lat - b.minLat) / (b.maxLat - b.minLat)) * (MAP.H - MAP.pad * 2)
    };
  }
  // metros → pixels (aprox.: 1° de latitude ≈ 111 km; longitude corrigida pelo cosseno)
  function metersToPx(m, lat) {
    const b = D.CITY.bbox;
    const kmLat = (b.maxLat - b.minLat) * 111;
    const kmLng = (b.maxLng - b.minLng) * 111 * Math.cos((lat * Math.PI) / 180);
    const pxPorKmY = (MAP.H - MAP.pad * 2) / kmLat;
    const pxPorKmX = (MAP.W - MAP.pad * 2) / kmLng;
    return { rx: (m / 1000) * pxPorKmX, ry: (m / 1000) * pxPorKmY };
  }

  function mapSvg(points) {
    const W = MAP.W, H = MAP.H;
    const layerBairros = D.NEIGHBORHOOD_AREAS.map((n) => {
      const p = mapProject(n.lat, n.lng), r = metersToPx(n.raio, n.lat);
      const ativo = state.filters.bairro && state.filters.bairro === n.nome;
      return `<g class="nb${ativo ? " ativo" : ""}" data-bairro="${esc(n.nome)}">
        <ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="${r.rx.toFixed(1)}" ry="${r.ry.toFixed(1)}"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y - r.ry - 6).toFixed(1)}" text-anchor="middle" class="nb-label">${esc(n.nome)}</text>
      </g>`;
    }).join("");

    // vias principais: eixos viários da cidade (esquemáticos)
    const ruas = [
      { nome: "Av. Brasília", a: [-25.2954, -54.1250], b: [-25.2954, -54.0600], principal: true },
      { nome: "Av. José Callegari", a: [-25.3250, -54.0936], b: [-25.2700, -54.0936], principal: true },
      { nome: "Av. Independência", a: [-25.2830, -54.1250], b: [-25.2830, -54.0600] },
      { nome: "Rua Sete de Setembro", a: [-25.3250, -54.0810], b: [-25.2700, -54.0810] },
      { nome: "Contorno Sul", a: [-25.3080, -54.1250], b: [-25.3080, -54.0600] },
      { nome: "Contorno Norte", a: [-25.2760, -54.1250], b: [-25.2760, -54.0600] },
      { nome: "BR-277", a: [-25.2700, -54.1250], b: [-25.2700, -54.0600], rodovia: true }
    ].map((r) => {
      const a = mapProject(r.a[0], r.a[1]), b = mapProject(r.b[0], r.b[1]);
      const cls = r.rodovia ? "map-road rodovia" : r.principal ? "map-road principal" : "map-road";
      const label = `<text x="${((a.x + b.x) / 2).toFixed(1)}" y="${(a.y - 5).toFixed(1)}" text-anchor="middle" class="road-label">${esc(r.nome)}</text>`;
      return `<path class="${cls}" d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}"/>${label}`;
    }).join("");

    const landmarks = D.LANDMARKS.map((l) => {
      const p = mapProject(l.lat, l.lng);
      return `<g class="landmark"><rect x="${(p.x - 4).toFixed(1)}" y="${(p.y - 4).toFixed(1)}" width="8" height="8" rx="2"/><title>${esc(l.nome)}</title></g>`;
    }).join("");

    const me = state.profile && Number.isFinite(state.profile.lat) && Number.isFinite(state.profile.lng) ? state.profile : null;
    const mePin = me ? (() => { const p = mapProject(me.lat, me.lng); return `<g class="pin me"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="16" class="pulse"/><title>Você está aqui</title></g>`; })() : "";

    const pins = points.map((p) => {
      const q = mapProject(p.lat, p.lng);
      const open = isOpen(p);
      return `<g class="pin${open ? " aberto" : ""}" data-point="${p.id}" tabindex="0" role="button" aria-label="${esc(p.nome)}">
        <circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="10"/>
        <text x="${q.x.toFixed(1)}" y="${(q.y + 4).toFixed(1)}" text-anchor="middle" class="pin-ico">♻</text>
        <title>${esc(p.nome)} — ${esc(p.endereco)}</title>
      </g>`;
    }).join("");

    return `<svg viewBox="0 0 ${W} ${H}" class="citymap" role="application" aria-label="Mapa da cidade de Medianeira com os pontos de coleta">
      <rect width="${W}" height="${H}" class="map-bg"/>
      <g class="layer-bairros">${layerBairros}</g>
      <g class="layer-ruas">${ruas}</g>
      <g class="layer-refs">${landmarks}</g>
      ${mePin}
      <g class="layer-pins">${pins}</g>
    </svg>`;
  }


  /* ============================================================
     Mapa de ruas (Leaflet + OpenStreetMap)
     - usa as ruas reais de Medianeira; precisa de internet para os tiles
     - offline: cai automaticamente no mapa esquemático (SVG)
     - mesmas camadas do esquema: bairros, referências e pontos de coleta
     ============================================================ */
  let mapLeaflet = null;
  let mapCamadas = null;

  function leafletDisponivel() {
    return typeof window.L !== "undefined" && !!window.L.map;
  }

  function corPin(p) {
    if (isOpen(p)) return "#16a34a"; // aberto agora
    return "#b45309";               // fechado
  }

  function iconePonto(p) {
    const cor = corPin(p);
    const sel = state.selectedPoint === p.id;
    return window.L.divIcon({
      className: "mk-ponto",
      html: '<span style="--cor:' + cor + '" class="mk-dot' + (sel ? " sel" : "") + '">♻</span>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16]
    });
  }

  function popupPonto(p) {
    const open = isOpen(p);
    return '<div class="mk-popup">' +
      '<strong>' + esc(p.nome) + '</strong>' +
      '<div class="small muted">' + esc(p.endereco) + '</div>' +
      '<div class="small">🕒 ' + esc(p.horario) + ' · ' + (p.abre === "00:00" && p.fecha === "23:59" ? "24h" : p.abre + "–" + p.fecha) + '</div>' +
      '<div class="small"><span class="pill ' + (open ? "ok" : "off") + '">' + (open ? "Aberto agora" : "Fechado") + '</span></div>' +
      '<div class="row-actions">' +
        '<button class="btn sm" data-solicitar-ponto="' + p.id + '">Solicitar coleta</button>' +
        '<a class="btn ghost sm" href="https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng + '" target="_blank" rel="noopener">Rota</a>' +
        (p.telefone ? '<a class="btn ghost sm" href="tel:' + onlyDigits(p.telefone) + '">Ligar</a>' : "") +
      '</div></div>';
  }

  function initLeaflet(points) {
    if (!leafletDisponivel()) return false;
    const host = $("#map-leaflet");
    if (!host) return false;

    if (!mapLeaflet) {
      mapLeaflet = window.L.map(host, {
        center: [D.CITY.lat, D.CITY.lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: true
      });
      window.L.control.zoom({ position: "topleft" }).addTo(mapLeaflet);
      window.L.control.scale({ imperial: false }).addTo(mapLeaflet);

      const ruas = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      });
      ruas.on("tileerror", () => mostrarNotaMapa(true));

      mapCamadas = {
        ruas,
        bairros: window.L.layerGroup(),
        pontos: window.L.layerGroup(),
        refs: window.L.layerGroup()
      };
      ruas.addTo(mapLeaflet);
      mapCamadas.bairros.addTo(mapLeaflet);
      mapCamadas.refs.addTo(mapLeaflet);
      mapCamadas.pontos.addTo(mapLeaflet);

      mapLeaflet.on("click", () => { /* clique no mapa não fecha nada */ });
    }

    // camada de bairros
    mapCamadas.bairros.clearLayers();
    D.NEIGHBORHOOD_AREAS.forEach((n) => {
      const ativo = state.filters.bairro && state.filters.bairro === n.nome;
      const c = window.L.circle([n.lat, n.lng], {
        radius: n.raio,
        color: ativo ? "#16a34a" : "#0f766e",
        weight: ativo ? 3 : 1.2,
        fillColor: ativo ? "#16a34a" : "#0f766e",
        fillOpacity: ativo ? 0.18 : 0.08,
        interactive: true
      });
      c.bindTooltip(n.nome, { permanent: true, direction: "center", className: "nb-tip" });
      c.on("click", () => {
        state.filters.bairro = n.nome;
        const sel = $("#pontos-bairro");
        if (sel) sel.value = n.nome;
        renderPoints();
      });
      mapCamadas.bairros.addLayer(c);
    });

    // referências da cidade
    mapCamadas.refs.clearLayers();
    D.LANDMARKS.forEach((l) => {
      mapCamadas.refs.addLayer(window.L.circleMarker([l.lat, l.lng], {
        radius: 5, color: "#5b6f66", weight: 2, fillColor: "#5b6f66", fillOpacity: 0.5
      }).bindTooltip(l.nome, { direction: "top" }));
    });

    // pontos de coleta
    mapCamadas.pontos.clearLayers();
    points.forEach((p) => {
      const mk = window.L.marker([p.lat, p.lng], { icon: iconePonto(p), title: p.nome, alt: p.nome });
      mk.bindPopup(popupPonto(p), { maxWidth: 280 });
      mk.on("click", () => {
        state.selectedPoint = p.id;
        const card = $('[data-card="' + p.id + '"]');
        if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "center" });
        destacarCartao(p.id);
      });
      mapCamadas.pontos.addLayer(mk);
    });

    // mostra o mapa esquemático se o Leaflet falhar
    const ok = $("#map-leaflet"), esquema = $("#pontos-map");
    if (host) host.hidden = !state.mapType || state.mapType === "ruas";
    if (esquema) esquema.hidden = (state.mapType || "ruas") !== "esquema";
    setTimeout(() => { if (mapLeaflet && mapLeaflet.invalidateSize) mapLeaflet.invalidateSize(); }, 60);
    return true;
  }

  function destacarCartao(id) {
    $$("[data-card]").forEach((c) => c.classList.toggle("selected", c.dataset.card === id));
  }

  function mostrarNotaMapa(mostrar) {
    const nota = $("#map-note");
    if (nota) nota.hidden = !mostrar;
  }

  function setMapType(tipo) {
    state.mapType = tipo;
    $$(".map-tab").forEach((b) => {
      const on = b.dataset.maptype === tipo;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    const cartas = $("#map-leaflet"), esquema = $("#pontos-map");
    if (cartas) cartas.hidden = tipo !== "ruas";
    if (esquema) esquema.hidden = tipo !== "esquema";
    if (tipo === "ruas" && mapLeaflet && mapLeaflet.invalidateSize) setTimeout(() => mapLeaflet.invalidateSize(), 40);
    if (tipo === "ruas" && !leafletDisponivel()) mostrarNotaMapa(true);
  }

  function bindMapas() {
    const host = $("#map-leaflet");
    if (!host) return;
    host.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-solicitar-ponto]");
      if (btn) {
        formState = defaultForm();
        formState.modalidade = "ecoponto";
        formState.pontoId = btn.dataset.solicitarPonto;
        go("solicitar");
      }
    });
    $$(".map-tab").forEach((b) => b.addEventListener("click", () => {
      setMapType(b.dataset.maptype);
      if (b.dataset.maptype === "esquema") applyMapView();
    }));
    setMapType(state.mapType || "ruas");
  }

  // ---------- interação do mapa ----------
  let mapZoom = 1, mapPan = { x: 0, y: 0 }, mapDragging = null;

  function applyMapView() {
    const host = $("#pontos-map");
    const svg = host && host.querySelector ? host.querySelector("svg") : null;
    if (!svg || !svg.setAttribute) return;
    const w = MAP.W / mapZoom, h = MAP.H / mapZoom;
    const maxX = MAP.W - w, maxY = MAP.H - h;
    mapPan.x = Math.min(Math.max(mapPan.x, 0), maxX);
    mapPan.y = Math.min(Math.max(mapPan.y, 0), maxY);
    svg.setAttribute("viewBox", `${mapPan.x.toFixed(1)} ${mapPan.y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    const z = $("#map-zoom-label");
    if (z) z.textContent = Math.round(mapZoom * 100) + "%";
  }

  function mapZoomBy(factor, center) {
    const antes = mapZoom;
    mapZoom = Math.min(6, Math.max(1, mapZoom * factor));
    if (center && antes !== mapZoom) {
      // mantém o ponto sob o cursor parado
      const hostZ = $("#pontos-map");
      const svg = hostZ && hostZ.querySelector ? hostZ.querySelector("svg") : null;
      if (!svg || !svg.getBoundingClientRect) { applyMapView(); return; }
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) { applyMapView(); return; }
      const fx = (center.x - rect.left) / rect.width;
      const fy = (center.y - rect.top) / rect.height;
      const w = MAP.W / mapZoom, h = MAP.H / mapZoom;
      mapPan.x = (mapPan.x + fx * (MAP.W / antes)) - fx * w;
      mapPan.y = (mapPan.y + fy * (MAP.H / antes)) - fy * h;
    }
    applyMapView();
  }

  function centerOn(lat, lng, zoom) {
    mapZoom = zoom || Math.max(mapZoom, 2.2);
    const w = MAP.W / mapZoom, h = MAP.H / mapZoom;
    const p = mapProject(lat, lng);
    mapPan.x = p.x - w / 2;
    mapPan.y = p.y - h / 2;
    applyMapView();
  }

  function bindMap() {
    const host = $("#pontos-map");
    if (!host) return;
    applyMapView();

    host.addEventListener("click", (e) => {
      const pin = e.target.closest("[data-point]");
      if (pin) {
        const p = D.POINTS.find((x) => x.id === pin.dataset.point);
        if (p) selectPoint(p);
        return;
      }
      const nb = e.target.closest("[data-bairro]");
      if (nb) {
        $("#pontos-bairro").value = nb.dataset.bairro;
        state.filters.bairro = nb.dataset.bairro;
        renderPoints();
      }
    });

    host.addEventListener("wheel", (e) => {
      e.preventDefault();
      mapZoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, { x: e.clientX, y: e.clientY });
    }, { passive: false });

    host.addEventListener("pointerdown", (e) => {
      if (e.target.closest("[data-point]") || e.target.closest("[data-bairro]")) return;
      mapDragging = { x: e.clientX, y: e.clientY, px: mapPan.x, py: mapPan.y };
      host.classList.add("dragging");
      // captura o ponteiro para o arrasto continuar fora do mapa (protegido:
      // com ponteiro sintético/teste o navegador pode recusar)
      try { if (host.setPointerCapture && e.pointerId != null) host.setPointerCapture(e.pointerId); } catch (err) { /* segue sem captura */ }
    });
    host.addEventListener("pointermove", (e) => {
      if (!mapDragging) return;
      const svg = host.querySelector("svg");
      if (!svg || !svg.getBoundingClientRect) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const escalaX = (MAP.W / mapZoom) / rect.width;
      const escalaY = (MAP.H / mapZoom) / rect.height;
      mapPan.x = mapDragging.px - (e.clientX - mapDragging.x) * escalaX;
      mapPan.y = mapDragging.py - (e.clientY - mapDragging.y) * escalaY;
      applyMapView();
    });
    const fim = () => { mapDragging = null; host.classList.remove("dragging"); };
    host.addEventListener("pointerup", fim);
    host.addEventListener("pointercancel", fim);
    host.addEventListener("pointerleave", fim);

    const zin = $("#map-zoom-in"), zout = $("#map-zoom-out"), zreset = $("#map-reset"), zloc = $("#map-locate");
    if (zin) zin.addEventListener("click", () => mapZoomBy(1.4));
    if (zout) zout.addEventListener("click", () => mapZoomBy(1 / 1.4));
    if (zreset) zreset.addEventListener("click", () => { mapZoom = 1; mapPan = { x: 0, y: 0 }; applyMapView(); });
    if (zloc) zloc.addEventListener("click", locateMe);
  }

  function selectPoint(p) {
    state.selectedPoint = p.id;
    renderPoints();
    if (mapLeaflet && mapCamadas && mapCamadas.pontos) { /* marcador já re-renderizado */ }
    const card = $(`[data-card="${p.id}"]`);
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "center" });
    centerOn(p.lat, p.lng, Math.max(mapZoom, 2));
  }

  // GPS do celular: só quando o morador toca no botão (privacidade)
  function locateMe() {
    if (!navigator.geolocation) { toast("Este aparelho não permite localização", "warn"); return; }
    toast("Buscando sua localização…", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        const dentro = lat >= D.CITY.bbox.minLat && lat <= D.CITY.bbox.maxLat &&
          lng >= D.CITY.bbox.minLng && lng <= D.CITY.bbox.maxLng;
        if (!dentro) { toast("Você está fora do perímetro de Medianeira — mostrando o centro.", "warn"); centerOn(D.CITY.lat, D.CITY.lng, 2); return; }
        state.profile = Object.assign({}, state.profile, { lat, lng });
        store.set(K.profile, state.profile);
        if (mapLeaflet) {
          window.L.circleMarker([lat, lng], { radius: 8, color: "#2563eb", weight: 3, fillColor: "#2563eb", fillOpacity: 0.9 })
            .addTo(mapLeaflet).bindTooltip("Você está aqui", { direction: "top" });
          mapLeaflet.setView([lat, lng], 15);
        }
        const perto = pointsSortedByDistance({ lat, lng })[0];
        renderPoints();
        centerOn(lat, lng, 3);
        if (perto) toast("Mais próximo: " + perto.nome + " (" + perto.dist.toFixed(1).replace(".", ",") + " km)", "ok");
      },
      (err) => {
        const msg = err && err.code === 1 ? "Permissão de localização negada — toque no cadeado do navegador para liberar." : "Não foi possível obter sua localização.";
        toast(msg, "warn");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  /* ============================================================
     Render — Solicitar (formulário)
     ============================================================ */
  let formState = null;
  function defaultForm() {
    return {
      nome: state.profile ? state.profile.nome : "",
      telefone: state.profile ? state.profile.telefone : "",
      email: state.profile ? state.profile.email : "",
      bairro: state.profile ? state.profile.bairro : "Centro",
      endereco: state.profile ? state.profile.endereco : "",
      complemento: "", referencia: "",
      modalidade: "domiciliar", pontoId: "",
      data: "", janela: "manha", obs: "",
      itens: D.CATEGORIES.map((c) => ({ catId: c.id, qtd: 0 }))
    };
  }
  function renderForm() {
    if (!formState) formState = defaultForm();
    formState.itens = formState.itens || defaultForm().itens;
    const f = formState;
    $("#f-nome").value = f.nome;
    $("#f-telefone").value = f.telefone;
    $("#f-email").value = f.email;
    $("#f-endereco").value = f.endereco;
    $("#f-complemento").value = f.complemento;
    $("#f-referencia").value = f.referencia;
    $("#f-obs").value = f.obs;
    $("#f-bairro").innerHTML = D.NEIGHBORHOODS.map((b) => `<option${b === f.bairro ? " selected" : ""}>${b}</option>`).join("");
    $$("input[name=modalidade]").forEach((r) => { r.checked = r.value === f.modalidade; });
    $("#f-itens").innerHTML = D.CATEGORIES.map((c) => {
      const it = f.itens.find((i) => i.catId === c.id) || { qtd: 0 };
      return `<label class="item-row${c.aceito ? "" : " blocked"}">
        <span class="item-emoji">${c.emoji}</span>
        <span class="item-info"><strong>${esc(c.nome)}</strong><small>${esc(c.desc)} · ~${c.peso} kg/un.</small></span>
        <input type="number" min="0" max="99" inputmode="numeric" value="${it.qtd}" data-qtd="${c.id}" aria-label="Quantidade de ${esc(c.nome)}">
      </label>`;
    }).join("");
    const kg = estimateWeight(f.itens);
    $("#f-kg").textContent = fmtKg(kg);
    const days = D.PICKUP_DAYS[f.bairro] || D.PICKUP_DAYS["Outro"];
    $("#f-dias").textContent = days.map((d) => DAY_NAMES[d]).join(" · ");
    const suggested = nextPickupDate(f.bairro);
    if (!f.data) f.data = suggested;
    const dateInput = $("#f-data");
    dateInput.value = f.data;
    dateInput.min = todayISO();
    // pontos compatíveis
    const compat = pointsFor(f.itens);
    $("#f-ponto").innerHTML = `<option value="">Escolha um ponto…</option>` + compat.map((p) =>
      `<option value="${p.id}"${f.pontoId === p.id ? " selected" : ""}>${esc(p.nome)} — ${esc(p.bairro)}</option>`).join("");
    toggleField("f-ponto", f.modalidade === "ecoponto");
    toggleField("field-data", f.modalidade === "domiciliar");
    toggleField("f-dias-box", f.modalidade === "domiciliar");
    $("#form-errors").innerHTML = "";
  }

  function readForm() {
    const f = formState;
    f.nome = $("#f-nome").value;
    f.telefone = $("#f-telefone").value;
    f.email = $("#f-email").value;
    f.endereco = $("#f-endereco").value;
    f.complemento = $("#f-complemento").value;
    f.referencia = $("#f-referencia").value;
    f.obs = $("#f-obs").value;
    f.bairro = $("#f-bairro").value;
    f.modalidade = ($$("input[name=modalidade]").find((r) => r.checked) || { value: "domiciliar" }).value;
    f.pontoId = $("#f-ponto").value;
    f.data = $("#f-data").value;
    f.janela = ($$("input[name=janela]").find((r) => r.checked) || { value: "manha" }).value;
    return f;
  }

  function submitForm(e) {
    if (e) e.preventDefault();
    if (!formState) formState = defaultForm();
    const f = readForm();
    const v = validateRequest(f);
    const box = $("#form-errors");
    if (!v.ok) {
      box.innerHTML = Object.values(v.errors).map((m) => `<p class="err">⚠️ ${esc(m)}</p>`).join("");
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const req = makeRequest(f, state.requests);
    state.requests.unshift(req);
    state.profile = {
      nome: req.nome, telefone: req.telefone, email: req.email,
      bairro: req.bairro, endereco: req.endereco, lat: state.profile ? state.profile.lat : undefined, lng: state.profile ? state.profile.lng : undefined
    };
    store.set(K.profile, state.profile);
    save();
    enqueue(req.protocolo);
    formState = defaultForm();
    toast("Solicitação registrada! Protocolo " + req.protocolo, "ok");
    go("protocolo", { id: req.protocolo });
  }

  /* ============================================================
     Render — Acompanhar (lista)
     ============================================================ */
  function renderTrack() {
    const f = { status: state.filters.status || "", bairro: "", q: state.filters.trackQ || "" };
    const list = filterRequests(state.requests, f).sort((a, b) => b.criadoEm - a.criadoEm);
    $("#track-count").textContent = `${list.length} solicitação(ões)`;
    $("#track-list").innerHTML = list.length ? list.map(reqCard).join("") : `<p class="empty">Nenhuma solicitação ainda. <a href="#/solicitar">Solicitar a primeira coleta →</a></p>`;
    const st = $("#track-status");
    if (st) st.innerHTML = `<option value="">Todos os status</option>` + D.STATUS.map((s) => `<option value="${s.id}"${f.status === s.id ? " selected" : ""}>${s.label}</option>`).join("");
  }

  function reqCard(r) {
    const s = statusOf(r.status);
    return `<article class="card req" data-protocolo="${esc(r.protocolo)}">
      <div class="req-head">
        <code class="proto">${esc(r.protocolo)}</code>
        <span class="pill" style="--pill:${s.color}">${s.label}</span>
      </div>
      <p class="small"><strong>${esc(r.bairro)}</strong> · ${esc(r.endereco)}${r.complemento ? ", " + esc(r.complemento) : ""}</p>
      <p class="small muted">${(r.itens || []).map((i) => {
        const c = D.CATEGORIES.find((x) => x.id === i.catId);
        return c ? `${c.emoji} ${i.qtd}× ${esc(c.nome)}` : "";
      }).join(" · ")}</p>
      <p class="small">⚖️ ${fmtKg(num(r.kg))} · ${r.modalidade === "domiciliar" ? "🏠 Coleta em casa" + (r.data ? " em " + fmtDate(r.data) : "") : "📍 Entrega em ponto"} · 🕓 ${fmtDateTime(r.criadoEm)}</p>
      <div class="row-actions">
        <button class="btn sm" data-ver="${esc(r.protocolo)}">Detalhes</button>
        ${r.status === "pendente" ? `<button class="btn ghost sm" data-cancelar="${esc(r.protocolo)}">Cancelar</button>` : ""}
      </div>
    </article>`;
  }

  /* ============================================================
     Render — Detalhe do protocolo
     ============================================================ */
  function renderProtocol(protocolo) {
    const r = state.requests.find((x) => x.protocolo === protocolo);
    const host = $("#protocolo-body");
    if (!r) {
      host.innerHTML = `<div class="card"><h2>Protocolo não encontrado</h2><p class="muted">Verifique o código ${esc(protocolo || "")} ou faça uma nova solicitação.</p><a class="btn" href="#/solicitar">Solicitar coleta</a></div>`;
      return;
    }
    const s = statusOf(r.status);
    const steps = D.STATUS.filter((x) => x.id !== "cancelada");
    const cur = steps.findIndex((x) => x.id === r.status);
    const timeline = steps.map((st, i) => {
      const done = cur >= 0 && i <= cur;
      const ev = (r.historico || []).filter((h) => h.status === st.id).pop();
      return `<li class="${done ? "done" : ""}">
        <span class="dot" style="--pill:${st.color}"></span>
        <div><strong>${st.label}</strong><small>${done && ev ? fmtDateTime(ev.em) + " — " + esc(ev.nota) : esc(st.desc)}</small></div>
      </li>`;
    }).join("");
    host.innerHTML = `
      <div class="card">
        <div class="req-head"><code class="proto">${esc(r.protocolo)}</code><span class="pill" style="--pill:${s.color}">${s.label}</span></div>
        <p class="muted small">${esc(s.desc)}</p>
        <div class="grid2">
          <div><h3>Dados</h3>
            <p class="small"><strong>${esc(r.nome)}</strong><br>${esc(r.telefone)}${r.email ? "<br>" + esc(r.email) : ""}</p>
            <p class="small">${esc(r.bairro)}<br>${esc(r.endereco)}${r.complemento ? ", " + esc(r.complemento) : ""}${r.referencia ? "<br>Ref.: " + esc(r.referencia) : ""}</p>
          </div>
          <div><h3>Coleta</h3>
            <p class="small">Modalidade: ${r.modalidade === "domiciliar" ? "em casa" : "entrega em ponto"}<br>
            ${r.modalidade === "domiciliar" ? "Data: " + fmtDate(r.data) + " (" + ({ manha: "manhã", tarde: "tarde", qualquer: "qualquer horário" }[r.janela] || "—") + ")" : "Ponto: " + esc((D.POINTS.find((p) => p.id === r.pontoId) || {}).nome || "—")}<br>
            Peso estimado: <strong>${fmtKg(num(r.kg))}</strong></p>
            ${r.obs ? `<p class="small muted">Obs.: ${esc(r.obs)}</p>` : ""}
          </div>
        </div>
        <h3>Equipamentos</h3>
        <div class="tags">${(r.itens || []).map((i) => {
          const c = D.CATEGORIES.find((x) => x.id === i.catId);
          return c ? `<span class="tag">${c.emoji} ${i.qtd}× ${esc(c.nome)}</span>` : "";
        }).join("")}</div>
        <h3>Etapas</h3>
        <ol class="timeline">${timeline}</ol>
        <div class="qr-box">
          <div>
            <p class="small muted">Informe este código no ponto de coleta ou abra o link salvo no celular.</p>
            <div class="row-actions">
              <button class="btn sm" id="btn-copy-link">Copiar link</button>
              ${r.status === "pendente" ? `<button class="btn ghost sm danger" id="btn-cancel-req">Cancelar solicitação</button>` : ""}
            </div>
          </div>
        </div>
      </div>`;
    const printBtn = $("#btn-print");
    if (printBtn) printBtn.addEventListener("click", () => window.print());
    $("#btn-copy-link").addEventListener("click", async () => {
      const ok = await copyText(requestUrl(r.protocolo));
      toast(ok ? "Link copiado!" : "Não foi possível copiar", ok ? "ok" : "err");
    });
    const cancel = $("#btn-cancel-req");
    if (cancel) cancel.addEventListener("click", () => {
      if (confirm("Cancelar a solicitação " + r.protocolo + "?")) {
        setStatus(r, "cancelada", "Cancelada pelo morador pelo app.");
        save(); renderProtocol(r.protocolo); toast("Solicitação cancelada", "warn");
      }
    });
  }

  /* ============================================================
     Render — Impacto
     ============================================================ */
  function renderImpact() {
    const stats = computeStats(state.requests);
    const I = stats.impact;
    const kg = I.kg || 0;
    $("#impact-total").innerHTML = `
      <div class="big-stat"><span>${fmtKg(kg)}</span><small>reciclados por você</small></div>
      <div class="big-stat"><span>${fmtInt(I.co2)} kg</span><small>de CO₂ evitados</small></div>
      <div class="big-stat"><span>${fmtInt(I.agua)} L</span><small>de água poupados</small></div>
      <div class="big-stat"><span>${(I.ouro).toFixed(2).replace(".", ",")} g</span><small>de ouro recuperáveis</small></div>`;
    $("#impact-bars").innerHTML = D.CATEGORIES.map((c) => {
      const qtd = stats.byCat[c.id] || 0;
      const max = Math.max(1, ...D.CATEGORIES.map((x) => stats.byCat[x.id] || 0));
      return `<div class="bar-row"><span class="bar-label">${c.emoji} ${esc(c.nome)}</span>
        <span class="bar"><span style="width:${(qtd / max) * 100}%"></span></span><span class="bar-val">${qtd}</span></div>`;
    }).join("");
    $("#impact-eq").innerHTML = [
      ["🚗", `${fmtInt(I.carroKm)} km`, "que um carro popular percorreria com a energia economizada"],
      ["🗑️", `${fmtKg(I.aterro)}`, "de resíduo que não foi para o aterro"],
      ["🟠", `${(I.cobre).toFixed(1).replace(".", ",")} kg`, "de cobre recuperado para novas indústrias"],
      ["💧", `${fmtInt(I.agua)} L`, "de água que não foram contaminados"]
    ].map(([e, n, d]) => `<div class="eq"><span class="eq-emoji">${e}</span><strong>${n}</strong><small>${d}</small></div>`).join("");
    const bairros = Object.entries(stats.byBairro).sort((a, b) => b[1] - a[1]);
    const maxB = Math.max(1, ...bairros.map((x) => x[1]));
    $("#impact-bairros").innerHTML = bairros.length ? bairros.map(([b, n]) =>
      `<div class="bar-row"><span class="bar-label">${esc(b)}</span><span class="bar"><span style="width:${(n / maxB) * 100}%"></span></span><span class="bar-val">${n}</span></div>`).join("")
      : `<p class="muted small">Ainda sem solicitações — as estatísticas aparecem aqui.</p>`;
    const sel = $("#goal");
    sel.value = state.profile && state.profile.goal ? state.profile.goal : "10";
    $("#impact-goal").textContent = state.profile && state.profile.goal
      ? `Meta: ${state.profile.goal} kg — faltam ${Math.max(0, state.profile.goal - kg).toFixed(1).replace(".", ",")} kg`
      : "";
  }

  /* ============================================================
     Render — Aprender
     ============================================================ */
  function renderLearn() {
    $("#faq").innerHTML = D.FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
    $("#team").innerHTML = D.TEAM.map((t) => `<div class="card small">
      <strong>${esc(t.nome)}</strong><p class="muted">${esc(t.papel)}</p>
      ${t.telefone ? `<a href="tel:${onlyDigits(t.telefone)}">${esc(t.telefone)}</a>` : ""}
      ${t.email ? `<br><a href="mailto:${esc(t.email)}">${esc(t.email)}</a>` : ""}
    </div>`).join("");
    $("#cat-grid").innerHTML = D.CATEGORIES.map((c) => `<div class="card small cat">
      <div class="cat-emoji">${c.emoji}</div>
      <strong>${esc(c.nome)}</strong>
      <p class="muted">${esc(c.desc)}</p>
      <span class="pill ${c.aceito ? "ok" : "off"}">${c.aceito ? "Coleta em casa" : "Só no Ecoponto"}</span>
    </div>`).join("");
  }

  /* ============================================================
     Render — Admin
     ============================================================ */
  function renderAdmin() {
    const host = $("#admin-body");
    if (!state.admin) {
      host.innerHTML = `<div class="card">
        <h2>Acesso da equipe</h2>
        <p class="muted small">Área da Secretaria de Meio Ambiente para acompanhar e atualizar as solicitações. Senha de demonstração: <code>medianeira</code></p>
        <div class="field"><label for="admin-pass">Senha</label><input id="admin-pass" type="password" autocomplete="current-password" placeholder="••••••••"></div>
        <button class="btn" id="admin-login">Entrar</button>
      </div>`;
      $("#admin-login").addEventListener("click", () => {
        if ($("#admin-pass").value === "medianeira") {
          state.admin = true; store.set(K.admin, true); renderAdmin(); toast("Bem-vindo, equipe!", "ok");
        } else toast("Senha incorreta", "err");
      });
      $("#admin-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#admin-login").click(); });
      return;
    }
    const stats = computeStats(state.requests);
    const list = filterRequests(state.requests, { q: state.filters.adminQ || "", status: state.filters.adminStatus || "", bairro: "" })
      .sort((a, b) => b.criadoEm - a.criadoEm);
    host.innerHTML = `
      <div class="grid2">
        <div class="card"><h3>Resumo</h3>
          <p class="small">Total: <strong>${stats.total}</strong> · Pendentes: <strong>${stats.pendentes}</strong> · Recicladas: <strong>${stats.recicladas}</strong> · Peso solicitado: <strong>${fmtKg(stats.kgSolicitado)}</strong> · Peso reciclado: <strong>${fmtKg(stats.kg)}</strong></p>
          <p class="small muted">Armazenamento local: ${(JSON.stringify(state.requests).length / 1024).toFixed(1)} KB · Fila de sincronização: ${state.queue.length}</p>
          <div class="row-actions">
            <button class="btn sm" id="admin-export">Exportar CSV</button>
            <button class="btn ghost sm" id="admin-backup">Baixar backup JSON</button>
            <button class="btn ghost sm" id="admin-logout">Sair</button>
          </div>
        </div>
        <div class="card"><h3>Filtros</h3>
          <div class="field"><label for="admin-q">Buscar</label><input id="admin-q" placeholder="protocolo, nome, endereço" value="${esc(state.filters.adminQ || "")}"></div>
          <div class="field"><label for="admin-status">Status</label><select id="admin-status"><option value="">Todos</option>${D.STATUS.map((s) => `<option value="${s.id}"${state.filters.adminStatus === s.id ? " selected" : ""}>${s.label}</option>`).join("")}</select></div>
        </div>
      </div>
      <div class="card">
        <h3>${list.length} solicitação(ões)</h3>
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Protocolo</th><th>Morador</th><th>Bairro</th><th>Kg</th><th>Data</th><th>Status</th><th>Ação</th></tr></thead><tbody>
          ${list.map((r) => `<tr>
            <td><code>${esc(r.protocolo)}</code></td>
            <td>${esc(r.nome)}<br><small class="muted">${esc(r.telefone)}</small></td>
            <td>${esc(r.bairro)}</td>
            <td>${num(r.kg).toFixed(1)}</td>
            <td>${r.modalidade === "domiciliar" ? fmtDate(r.data) : "ponto"}</td>
            <td><span class="pill" style="--pill:${statusOf(r.status).color}">${statusOf(r.status).label}</span></td>
            <td><select data-admin-status="${esc(r.protocolo)}">${D.STATUS.map((s) => `<option value="${s.id}"${r.status === s.id ? " selected" : ""}>${s.label}</option>`).join("")}</select></td>
          </tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">Nenhuma solicitação com esses filtros.</p>`}
      </div>`;
    $("#admin-logout").addEventListener("click", () => { state.admin = false; store.set(K.admin, false); renderAdmin(); });
    $("#admin-export").addEventListener("click", () => { download("medianeira-solicitacoes.csv", exportCsv(state.requests), "text/csv;charset=utf-8"); toast("CSV exportado", "ok"); });
    $("#admin-backup").addEventListener("click", () => { download("medianeira-backup.json", JSON.stringify({ requests: state.requests, profile: state.profile, exportedAt: new Date().toISOString() }, null, 2), "application/json"); toast("Backup baixado", "ok"); });
    $("#admin-q").addEventListener("input", (e) => { state.filters.adminQ = e.target.value; renderAdmin(); });
    $("#admin-status").addEventListener("change", (e) => { state.filters.adminStatus = e.target.value; renderAdmin(); });
    $$("[data-admin-status]").forEach((sel) => sel.addEventListener("change", (e) => {
      const r = state.requests.find((x) => x.protocolo === sel.dataset.adminStatus);
      if (!r) return;
      setStatus(r, e.target.value, "Atualizado pela equipe no painel.");
      save(); renderAdmin(); toast("Status atualizado: " + statusOf(r.status).label, "ok");
    }));
  }

  /* ============================================================
     Render — navegação/geral
     ============================================================ */
  function renderSync() {
    const badge = $("#sync-badge");
    if (!badge) return;
    const n = state.queue.length;
    badge.textContent = !navigator.onLine ? "offline" : n ? n + " pendente(s)" : "sincronizado";
    badge.className = "sync " + (!navigator.onLine ? "off" : n ? "warn" : "ok");
  }

  function render() {
    const { name, params } = parseHash();
    state.view = name;
    $$(".view").forEach((v) => { v.hidden = v.id !== "view-" + name; });
    $$(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.route === name));
    if (name === "inicio") renderHome();
    if (name === "pontos") renderPoints();
    if (name === "solicitar") renderForm();
    if (name === "acompanhar") renderTrack();
    if (name === "impacto") renderImpact();
    if (name === "aprender") renderLearn();
    if (name === "instalar") renderInstall();
    if (name === "admin") renderAdmin();
    if (name === "protocolo") renderProtocol(params.id);
    renderSync();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ============================================================
     Eventos globais
     ============================================================ */
  function bind() {
    window.addEventListener("hashchange", render);
    window.addEventListener("online", () => { renderSync(); syncNow(true); });
    window.addEventListener("offline", renderSync);

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-route]");
      if (t) { e.preventDefault(); go(t.dataset.route); return; }
      const sp = e.target.closest("[data-solicitar-ponto]");
      if (sp) {
        formState = defaultForm();
        formState.modalidade = "ecoponto";
        formState.pontoId = sp.dataset.solicitarPonto;
        go("solicitar");
        return;
      }
      const ver = e.target.closest("[data-ver]");
      if (ver) { go("protocolo", { id: ver.dataset.ver }); return; }
      const cancel = e.target.closest("[data-cancelar]");
      if (cancel) {
        const r = state.requests.find((x) => x.protocolo === cancel.dataset.cancelar);
        if (r && confirm("Cancelar " + r.protocolo + "?")) {
          setStatus(r, "cancelada", "Cancelada pelo morador.");
          save(); render(); toast("Cancelada", "warn");
        }
        return;
      }
      const pin = e.target.closest("[data-point]");
      if (pin) {
        const p = D.POINTS.find((x) => x.id === pin.dataset.point);
        if (p) toast(p.nome + " — " + p.endereco + (isOpen(p) ? " (aberto agora)" : " (fechado)"), "info");
        return;
      }
    });

    // tema
    $("#btn-theme").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      store.set(K.theme, next);
    });

    // filtros de pontos
    $("#pontos-q").addEventListener("input", (e) => { state.filters.q = e.target.value; renderPoints(); });
    $("#pontos-bairro").addEventListener("change", (e) => { state.filters.bairro = e.target.value; renderPoints(); });
    $("#pontos-cat").addEventListener("change", (e) => { state.filters.cat = e.target.value; renderPoints(); });
    $("#pontos-open").addEventListener("change", (e) => { state.filters.openNow = e.target.checked; renderPoints(); });

    // formulário
    $("#form-coleta").addEventListener("submit", submitForm);
    $("#form-coleta").addEventListener("input", (e) => {
      const q = e.target.closest && e.target.closest("[data-qtd]");
      if (q && formState && formState.itens) {
        const it = formState.itens.find((i) => i.catId === q.dataset.qtd);
        if (it) it.qtd = Math.max(0, Math.min(99, Math.round(num(q.value))));
        $("#f-kg").textContent = fmtKg(estimateWeight(formState.itens));
        const compat = pointsFor(formState.itens);
        $("#f-ponto").innerHTML = `<option value="">Escolha um ponto…</option>` + compat.map((p) =>
          `<option value="${p.id}"${formState.pontoId === p.id ? " selected" : ""}>${esc(p.nome)} — ${esc(p.bairro)}</option>`).join("");
      }
    });
    $("#form-coleta").addEventListener("change", (e) => {
      if (!formState) return;
      if (e.target.name === "modalidade") {
        formState.modalidade = e.target.value;
        toggleField("f-ponto", formState.modalidade === "ecoponto");
        toggleField("field-data", formState.modalidade === "domiciliar");
        toggleField("f-dias-box", formState.modalidade === "domiciliar");
      }
      if (e.target.id === "f-bairro") {
        formState.bairro = e.target.value;
        formState.data = nextPickupDate(formState.bairro);
        $("#f-data").value = formState.data;
        const days = D.PICKUP_DAYS[formState.bairro] || D.PICKUP_DAYS["Outro"];
        $("#f-dias").textContent = days.map((d) => DAY_NAMES[d]).join(" · ");
      }
    });

    // acompanhar
    $("#track-search").addEventListener("input", (e) => { state.filters.trackQ = e.target.value; renderTrack(); });
    $("#track-status").addEventListener("change", (e) => { state.filters.status = e.target.value; renderTrack(); });

    // perfil / meta
    $("#goal").addEventListener("change", (e) => {
      state.profile = state.profile || {};
      state.profile.goal = Number(e.target.value);
      store.set(K.profile, state.profile);
      renderImpact();
    });

    // sincronização manual
    $("#btn-sync").addEventListener("click", () => syncNow(false));
    $("#btn-install").addEventListener("click", () => installApp());

    // deep link com ?id= (QR / compartilhamento)
    const qs = new URLSearchParams(location.search);
    if (qs.get("id")) { go("protocolo", { id: qs.get("id") }); }
  }

  // ============================================================
  //  Guarda contra versão antiga presa no cache do service worker:
  //  se o arquivo servido não for o de agora, avisa e oferece atualizar.
  //  (Um usuário ficou com uma versão antiga e viu erros que já não existiam.)
  // ============================================================
  const APP_BUILD = "2026-10-22-pontos-reais";

  const DADOS_BUILD = "2026-10-22-pontos-reais";

  async function checkStaleVersion() {
    if (!("serviceWorker" in navigator) || location.protocol.indexOf("http") !== 0) return;
    try {
      const [appRes, dadosRes] = await Promise.all([
        fetch("js/app.js?verificacao=" + Date.now(), { cache: "no-store" }),
        fetch("js/data.js?verificacao=" + Date.now(), { cache: "no-store" })
      ]);
      const appNovo = (await appRes.text()).indexOf(APP_BUILD) >= 0;
      const dadosNovos = (await dadosRes.text()).indexOf(DADOS_BUILD) >= 0;
      if (appNovo && dadosNovos) return;
      // os arquivos do servidor são mais novos que os carregados: limpa o cache e recarrega sozinho
      const jaTentou = sessionStorage.getItem("eco.atualizado") === "1";
      if (!jaTentou) {
        sessionStorage.setItem("eco.atualizado", "1");
        toast("Atualizando o app para a versão nova…", "info");
        setTimeout(forceReload, 600);
        return;
      }
      showUpdatePrompt();
    } catch (e) { /* offline: segue com o que está no aparelho */ }
  }

  function showUpdatePrompt() {
    const host = $("#install-guide");
    if (!host || !host.hidden) return;
    host.innerHTML = `<div class="card guide">
      <h2>Atualizar o app</h2>
      <p>Seu navegador está mostrando uma versão antiga guardada em cache. Toque no botão para limpar e carregar a versão atual (com o mapa novo da cidade).</p>
      <div class="row-actions"><button class="btn" id="btn-force-reload">Atualizar agora</button></div>
    </div>`;
    host.hidden = false;
    const btn = host.querySelector("#btn-force-reload");
    if (btn) btn.addEventListener("click", forceReload);
  }

  async function forceReload() {
    try {
      if ("caches" in window) {
        const chaves = await caches.keys();
        await Promise.all(chaves.map((k) => caches.delete(k)));
      }
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) { /* ignora e recarrega mesmo assim */ }
    location.reload();
  }

  /* ============================================================
     Instalação no celular (PWA)
     - Android/Chrome: o navegador dispara beforeinstallprompt → instala em 1 toque.
     - iPhone/Safari: a Apple não permite instalação por botão; mostramos o passo a passo
       (Compartilhar → Adicionar à Tela de Início).
     - Já instalado: o app abre em modo standalone (display-mode) e o aviso desaparece.
     ============================================================ */
  let deferredPrompt = null;
  const K_INSTALL_HIDE = "eco.install.hide";

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      navigator.standalone === true;
  }
  function isIos() {
    const ua = navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return iOS;
  }
  function installAvailable() {
    // o navegador só dispara beforeinstallprompt em https; sem ele (iOS, alguns
    // navegadores, desktop) o app mostra o passo a passo manual — nunca fica escondido.
    return !isStandalone();
  }

  // Endereço do app na rede local, para quem abre no computador e quer levar ao celular.
  function lanAddress() {
    const host = location.hostname;
    const porta = location.port ? ":" + location.port : "";
    // mantém a pasta do app no endereço (GitHub Pages serve em /ecoponto-medianeira/)
    let pasta = location.pathname || "/";
    pasta = pasta.replace(/[^/]*$/, ""); // remove index.html ou vazio
    if (pasta.charAt(0) !== "/") pasta = "/" + pasta;
    if (host === "127.0.0.1" || host === "localhost") {
      // aberto no próprio computador: mostra o endereço de rede que o celular deve usar
      const ip = state.lanIp || "IP-DO-COMPUTADOR";
      return "http://" + ip + (porta || ":8080") + "/";
    }
    return location.protocol + "//" + host + porta + pasta;
  }

  // Descobre o IP do computador na rede local (WebRTC). Se não conseguir,
  // deixa um texto de ajuda no lugar do endereço.
  function detectLanIp() {
    try {
      const pc = new (window.RTCPeerConnection || window.webkitRTCPeerConnection)();
      pc.createDataChannel("eco");
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const m = /(\d+\.\d+\.\d+\.\d+)/.exec(e.candidate.candidate);
        if (m && !/^(0\.|127\.)/.test(m[1])) {
          state.lanIp = m[1];
          const box = $("#lan-url");
          if (box) box.textContent = lanAddress();
          pc.close();
        }
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
    } catch (e) { /* sem WebRTC: fica o texto padrão */ }
  }

  function showInstallUi() {
    const bannerTxt = $("#install-banner .install-text small");
    if (bannerTxt) {
      bannerTxt.textContent = isStandalone()
        ? "App instalado neste aparelho."
        : "Instale em 2 toques — depois funciona até sem internet. Grátis.";
    }
    const banner = $("#install-banner");
    const btn = $("#btn-install");
    if (isStandalone()) { if (banner) banner.hidden = true; if (btn) btn.hidden = true; return; }
    const dismissed = store.get(K_INSTALL_HIDE, false) === true;
    if (btn) btn.hidden = !installAvailable();
    if (banner) banner.hidden = dismissed || !installAvailable();
  }

  function installStepsHtml() {
    if (isIos()) {
      return `<h3>No iPhone / iPad (Safari)</h3>
        <ol>
          <li>Toque no botão <strong>Compartilhar</strong> (o quadrado com a flecha para cima), na barra do Safari.</li>
          <li>Role e escolha <strong>Adicionar à Tela de Início</strong>.</li>
          <li>Toque em <strong>Adicionar</strong>. O ícone do EcoMedianeira aparece na tela do celular.</li>
        </ol>
        <p class="small muted">Importante: use o Safari. No Instagram, Facebook ou WhatsApp, abra o link em “Abrir no Safari”.</p>`;
    }
    return `<h3>No Android (Chrome, Edge, Samsung Internet)</h3>
      <ol>
        <li>Toque no botão <strong>Baixar app</strong> acima (ou no ícone ⬇ no topo da tela).</li>
        <li>Se nada aparecer, abra o menu <strong>⋮</strong> do navegador e escolha <strong>Instalar aplicativo</strong> / <strong>Adicionar à tela inicial</strong>.</li>
        <li>Confirme em <strong>Instalar</strong>. O app abre em tela cheia, sem barra de navegador.</li>
      </ol>
      <p class="small muted">No computador: ícone de instalação na barra de endereço do Chrome/Edge, ou menu ⋮ → Instalar EcoMedianeira.</p>`;
  }

  function openInstallGuide() {
    if (isStandalone()) { toast("O app já está instalado neste aparelho. Abra pelo ícone do EcoMedianeira.", "ok"); return; }
    if (deferredPrompt) { installApp(); return; }
    const host = $("#install-guide");
    if (!host) { toast("Use o menu do navegador → Instalar app", "info"); return; }
    host.innerHTML = `<div class="card guide">
      <h2>📲 Baixar o EcoMedianeira no celular</h2>
      <p class="small muted">O app não é baixado de uma loja: ele é instalado direto do site, grátis, e depois funciona sem internet.</p>
      <p class="small"><span class="tag-os">${isIos() ? "iPhone / iPad" : "Celular"}</span></p>
      ${installStepsHtml()}
      <div class="row-actions">
        ${isAndroidLike() ? `<button class="btn" id="guide-install">Instalar agora</button>` : ""}
        <button class="btn ghost" id="guide-close">Fechar</button>
      </div>
    </div>`;
    host.hidden = false;
    setTimeout(() => host.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
    host.querySelector("#guide-close").addEventListener("click", () => { host.hidden = true; });
    host.addEventListener("click", (e) => { if (e.target === host) host.hidden = true; });
    const escClose = (e) => { if (e.key === "Escape" && !host.hidden) { host.hidden = true; document.removeEventListener("keydown", escClose); } };
    document.addEventListener("keydown", escClose);
    const gb = host.querySelector("#guide-install");
    if (gb) gb.addEventListener("click", () => { host.hidden = true; installApp(); });
  }
  function isAndroidLike() {
    return /Android/i.test(navigator.userAgent || "");
  }

  // Tela dedicada "Baixar app" (menu → Baixar app)
  function renderInstall() {
    detectLanIp();
    const body = $("#guide-body");
    if (body) {
      body.innerHTML = `<div class="lan-box"><small class="muted">Endereço deste app — abra no celular:</small><code id="lan-url">${esc(lanAddress())}</code></div>`
        + installStepsHtml()
        + `<h3>Só é possível instalar uma vez</h3>
      <p class="small muted">Se o ícone já está na tela inicial do celular, o app está instalado — abra por ele. Se o botão não aparecer, é porque o navegador não oferece a instalação (acontece em navegadores internos do Instagram, Facebook e WhatsApp): use o menu ⋮ e escolha "Abrir no navegador".</p>
      <h3>Depois de instalar</h3>
      <ul class="checklist">
        <li>O app abre em tela cheia, sem barra de endereço.</li>
        <li>Funciona sem internet: os dados ficam no seu aparelho.</li>
        <li>Suas solicitações ficam salvas mesmo se você fechar o app.</li>
      </ul>`;
    }
    const cta = $("#btn-install-cta");
    if (cta) {
      cta.textContent = deferredPrompt ? "Baixar / instalar agora" : (isStandalone() ? "App já instalado neste aparelho" : "Baixar / instalar agora");
      cta.disabled = isStandalone();
    }
  }

  function initPwa() {
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").then((reg) => {
          // força a checagem de versão nova a cada abertura
          if (reg && reg.update) reg.update().catch(() => {});
        }).catch(() => {});
      });
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallUi();
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      store.set(K_INSTALL_HIDE, true);
      showInstallUi();
      toast("App instalado! Procure o ícone do EcoMedianeira na tela do celular.", "ok");
    });

    const close = $("#btn-install-close");
    if (close) close.addEventListener("click", () => { store.set(K_INSTALL_HIDE, true); showInstallUi(); });

    const main = $("#btn-install-main");
    if (main) main.addEventListener("click", () => openInstallGuide());
    const topo = $("#btn-install");
    if (topo) topo.addEventListener("click", () => openInstallGuide());

    setTimeout(showInstallUi, 300);
    showInstallUi();
  }

  async function installApp() {
    if (!deferredPrompt) { openInstallGuide(); return; }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" }));
    deferredPrompt = null;
    showInstallUi();
    if (choice && choice.outcome === "accepted") toast("Instalando… o ícone aparece na tela inicial.", "ok");
  }

  function registerInstallControls() {
    const btn = $("#btn-install");
    if (btn) btn.addEventListener("click", () => installApp());
  }


  /* ============================================================
     Init
     ============================================================ */
  function init() {
    const theme = store.get(K.theme, null) || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    $("#pontos-bairro").innerHTML = `<option value="">Todos os bairros</option>` + D.NEIGHBORHOODS.map((b) => `<option>${b}</option>`).join("");
    $("#pontos-cat").innerHTML = `<option value="">Todos os tipos</option>` + D.CATEGORIES.map((c) => `<option value="${c.id}">${c.emoji} ${esc(c.nome)}</option>`).join("");
    load();
    bind();
    render();
    renderSync();
    registerInstallControls();
    initPwa();
    const cta = $("#btn-install-cta");
    if (cta) cta.addEventListener("click", () => installApp());
    if (state.queue.length) setTimeout(() => syncNow(true), 1200);
    checkStaleVersion();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  /* expõe também o controle do mapa (usado pelos testes) */
  window.ECO_MAP = {
    zoom: (f, center) => mapZoomBy(f, center),
    setView: (z, x, y) => { mapZoom = z; mapPan = { x: x || 0, y: y || 0 }; applyMapView(); },
    getZoom: () => mapZoom,
    getPan: () => ({ x: mapPan.x, y: mapPan.y }),
    centerOn, project: mapProject, metersToPx, selectPoint, locateMe
  };

  /* expõe a lógica para os testes (Node) */
  window.ECO_APP = {
    estimateWeight, impactOf, pointsFor, distanceKm, isOpen, nextPickupDate,
    makeProtocol, uniqueProtocol, validateRequest, makeRequest, setStatus,
    levelOf, computeStats, filterRequests, exportCsv, pointsSortedByDistance
  };
})();
