const CACHE = 'habit-v2';
const ASSETS = ['./index.html', './manifest.json'];

// ── インストール ──────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ── アクティベート ────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  // クライアントにタスクを要求
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'REQUEST_TASKS' }));
  });
});

// ── キャッシュ優先フェッチ ─────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── アラーム管理 ──────────────────────────
let alarms = []; // { taskId, title, hour, min, timerId }

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    scheduleAll(e.data.tasks);
  }
});

function clearAll() {
  alarms.forEach(a => clearTimeout(a.timerId));
  alarms = [];
}

function scheduleAll(tasks) {
  clearAll();
  tasks.forEach(t => scheduleOne(t));
}

function scheduleOne(task) {
  const [h, m] = task.time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target - now;

  const tid = setTimeout(() => {
    self.registration.showNotification('🌿 ' + task.title, {
      body: '習慣タスクの時間です',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'habit-' + task.id,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: { url: './' }
    });
    // 翌日も再スケジュール
    scheduleOne(task);
  }, ms);

  alarms.push({ taskId: task.id, timerId: tid });
}

// ── 通知クリック ──────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (let c of list) {
        if (c.url.includes('habit-tasks') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('./');
    })
  );
});

// ── 定期的な再スケジュール（念のため毎時実行） ──
self.addEventListener('periodicsync', e => {
  if (e.tag === 'reschedule') {
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'REQUEST_TASKS' }));
      })
    );
  }
});
