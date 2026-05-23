/**
 * HMS centralized runtime — single socket, safe DOM, chart guards.
 */
(function (global) {
  "use strict";

  if (global.__HMS_APP_INIT__) return;
  global.__HMS_APP_INIT__ = true;

  const HMS = {
    socket: null,
    charts: {},
    listenersBound: false
  };

  function safeQuery(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  function safeQueryAll(sel, root) {
    try {
      return Array.from((root || document).querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }

  function initSocket() {
    if (typeof global.io !== "function") return null;
    if (global.__HMS_SOCKET__) {
      HMS.socket = global.__HMS_SOCKET__;
      return HMS.socket;
    }
    const s = global.io({ transports: ["websocket", "polling"], reconnection: true });
    global.__HMS_SOCKET__ = s;
    HMS.socket = s;
    const user = global.HMS_USER;
    if (user && user.id) {
      s.emit("join", { userId: String(user.id), role: user.role || "patient" });
    }
    return s;
  }

  function destroyChart(id) {
    if (HMS.charts[id]) {
      try {
        HMS.charts[id].destroy();
      } catch (e) {}
      delete HMS.charts[id];
    }
  }

  function initChart(canvasId, config) {
    const el = document.getElementById(canvasId);
    if (!el || typeof global.Chart === "undefined") return null;
    destroyChart(canvasId);
    HMS.charts[canvasId] = new global.Chart(el, config);
    return HMS.charts[canvasId];
  }

  let alarmInterval = null;
  let audioCtx = null;

  function startSiren() {
    if (alarmInterval) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      alarmInterval = setInterval(() => {
        try {
          let osc = audioCtx.createOscillator();
          let gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) {}
      }, 500);
    } catch (e) {}
  }

  function stopSiren() {
    if (alarmInterval) {
      clearInterval(alarmInterval);
      alarmInterval = null;
    }
  }

  global.hmsStartSiren = startSiren;
  global.hmsStopSiren = stopSiren;

  function initProfileDropdown() {
    const btn = document.getElementById("userMenuBtn");
    const dropdown = document.getElementById("userMenuDropdown");
    if (!btn || !dropdown) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const open = dropdown.classList.contains("opacity-100");
      dropdown.classList.toggle("opacity-100", !open);
      dropdown.classList.toggle("visible", !open);
      dropdown.classList.toggle("opacity-0", open);
      dropdown.classList.toggle("invisible", open);
    });

    document.addEventListener("click", function () {
      dropdown.classList.add("opacity-0", "invisible");
      dropdown.classList.remove("opacity-100", "visible");
    });
  }

  function initNotificationBell() {
    const bell = document.getElementById("hmsNotifBell");
    const panel = document.getElementById("hmsNotifPanel");
    const list = document.getElementById("hmsNotifList");
    const badge = document.getElementById("hmsNotifBadge");
    if (!bell || !panel) return;

    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (!data.success) return;
        if (badge) {
          badge.textContent = data.unread > 0 ? data.unread : "";
          badge.style.display = data.unread > 0 ? "flex" : "none";
        }
        if (!list) return;
        list.innerHTML = "";
        if (!data.notifications.length) {
          list.innerHTML = '<p class="text-gray-400 text-sm p-3">No notifications</p>';
          return;
        }
        
        const userRole = (global.HMS_USER && global.HMS_USER.role) || "patient";
        const linkPrefix = userRole === "patient" ? "/patient/notifications" : "/" + userRole + "/dashboard";

        data.notifications.slice(0, 8).forEach(function (n) {
          const el = document.createElement("a");
          el.href = linkPrefix;
          el.className = "block px-3 py-2 rounded-lg hover:bg-white/10 " + (n.is_read ? "opacity-60" : "");
          el.innerHTML =
            '<p class="text-white text-sm font-medium">' + escapeHtml(n.title) + "</p>" +
            '<p class="text-gray-400 text-xs truncate">' + escapeHtml(n.message) + "</p>";
          list.appendChild(el);
        });
      } catch (e) {}
    }

    function escapeHtml(s) {
      const d = document.createElement("div");
      d.textContent = s || "";
      return d.innerHTML;
    }

    bell.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.classList.toggle("hidden");
      loadNotifications();
    });

    document.addEventListener("click", function (e) {
      if (!panel.contains(e.target) && e.target !== bell) panel.classList.add("hidden");
    });

    const s = HMS.socket || initSocket();
    if (s) {
      s.on("new-notification", function () {
        loadNotifications();
      });
    }

    loadNotifications();
  }

  function bindSidebarActive() {
    const path = global.location?.pathname || "";
    safeQueryAll(".hms-nav-link, .nav-link").forEach(function (link) {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      if (path === href || (href !== "/" && path.startsWith(href))) {
        link.classList.add("active");
      }
    });
  }

  function mountPageHooks() {
    bindSidebarActive();
    document.body?.classList.add("hms-ready");
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  global.HMS = HMS;
  global.hmsSafeQuery = safeQuery;
  global.hmsInitChart = initChart;
  global.hmsDestroyChart = destroyChart;

  if (!global.hmsSocket) {
    global.hmsSocket = function () {
      return HMS.socket || initSocket();
    };
  }

  function bindGlobalSocketEvents() {
    const s = HMS.socket || initSocket();
    if (!s || HMS.listenersBound) return;
    HMS.listenersBound = true;
    s.on("new-notification", function (data) {
      if (typeof global.hmsOnNotification === "function") global.hmsOnNotification(data);
    });
    s.on("appointment-update", function (data) {
      if (typeof global.hmsOnAppointmentUpdate === "function") global.hmsOnAppointmentUpdate(data);
    });
    s.on("sos-alert", function (data) {
      const modal = document.getElementById("hmsSosAlertModal");
      if (modal) {
        const patEl = document.getElementById("hmsSosPatient");
        const msgEl = document.getElementById("hmsSosMsg");
        if (patEl) patEl.textContent = data.patientName || "Unknown Patient";
        if (msgEl) msgEl.textContent = data.message || "Emergency SOS Alert";
        if (data.lat && data.lng) {
          const mapLink = document.getElementById("hmsSosMapLink");
          if (mapLink) {
            mapLink.href = `https://www.google.com/maps?q=${data.lat},${data.lng}`;
            mapLink.classList.remove("hidden");
          }
        }
        modal.classList.remove("hidden");
        startSiren();
      }
    });
  }

  onReady(function () {
    initSocket();
    bindGlobalSocketEvents();
    mountPageHooks();
    initProfileDropdown();
    initNotificationBell();
  });
})(window);
