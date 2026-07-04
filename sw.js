/* ==========================================================================
   MARIA CLARA 15 — SW.JS (Service Worker)
   Estratégia: cache-first para o app shell, com atualização em segundo
   plano (stale-while-revalidate) para manter o app sempre instalável e
   funcional offline durante a festa.
   ========================================================================== */

'use strict';

const CACHE_VERSION = 'maria-clara-15-v1';
const CACHE_NAME = `mc15-cache-${CACHE_VERSION}`;

// Arquivos essenciais do "app shell" — precisam funcionar 100% offline
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/svg/brasao-mc.svg',
  './assets/svg/flor-01.svg',
  './assets/svg/flor-02.svg',
  './assets/svg/balao-01.svg',
  './assets/svg/balao-02.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-180.png'
];

// Fontes do Google Fonts usadas no app — cacheadas separadamente pois
// vêm de outra origem (CDN) e não devem quebrar a instalação se falharem
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Parisienne&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap'
];

/* --------------------------------------------------------------------------
   INSTALAÇÃO — pré-cacheia o app shell
-------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cacheAppShellBestEffort(cache))
      .then(() => cacheFontsBestEffort())
      .then(() => self.skipWaiting())
  );
});

// cache.addAll() falha por inteiro se UM único recurso der erro (404,
// rede instável etc.), o que deixaria o app inteiro sem suporte
// offline. Aqui cada arquivo é cacheado individualmente: um item que
// falhar não compromete os demais.
async function cacheAppShellBestEffort(cache) {
  await Promise.all(
    APP_SHELL.map((url) =>
      cache.add(url).catch((err) => {
        console.warn('[SW] Falha ao cachear no app shell:', url, err);
      })
    )
  );
}

async function cacheFontsBestEffort() {
  try {
    const cache = await caches.open(CACHE_NAME);

    for (const cssUrl of FONT_URLS) {
      try {
        const cssResponse = await fetch(cssUrl, { mode: 'cors' });
        if (!cssResponse || !cssResponse.ok) continue;

        const cssText = await cssResponse.clone().text();
        await cache.put(cssUrl, cssResponse);

        // O CSS do Google Fonts referencia os arquivos .woff2 reais via
        // url(...). Sem cacheá-los também, o texto simplesmente cairia
        // para a fonte do sistema quando offline, mesmo com o CSS salvo.
        const fontFileUrls = extractFontFileUrls(cssText);
        await Promise.all(
          fontFileUrls.map((fontUrl) =>
            fetch(fontUrl, { mode: 'cors' })
              .then((res) => { if (res && res.ok) return cache.put(fontUrl, res); })
              .catch(() => {})
          )
        );
      } catch (err) {
        // Sem internet no momento da instalação: as fontes serão
        // buscadas normalmente na próxima navegação com rede.
      }
    }
  } catch (err) {
    // Falha ao abrir cache não deve impedir a instalação do app shell
  }
}

function extractFontFileUrls(cssText) {
  const matches = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g) || [];
  return matches.map((match) => match.replace(/^url\(/, '').replace(/\)$/, ''));
}

/* --------------------------------------------------------------------------
   ATIVAÇÃO — remove caches de versões antigas
-------------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('mc15-cache-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* --------------------------------------------------------------------------
   FETCH — estratégias diferentes por tipo de recurso
-------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignora métodos que não são GET (ex.: eventuais chamadas POST futuras)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Navegação (index.html) — network-first para garantir a versão mais
  // recente quando há conexão, com fallback para cache quando offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }

  // Recursos do próprio domínio (CSS, JS, SVG, ícones) — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithNetworkFallback(request));
    return;
  }

  // Fontes externas (Google Fonts) — stale-while-revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

/* --------------------------------------------------------------------------
   ESTRATÉGIAS DE CACHE
-------------------------------------------------------------------------- */
async function cacheFirstWithNetworkFallback(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirstWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || caches.match('./index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}
