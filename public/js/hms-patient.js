/**
 * Patient portal UI — profile menu, notifications, SOS, parking, wellbeing
 */
(function () {
  "use strict";
  if (window.__HMS_PATIENT_INIT__) return;
  window.__HMS_PATIENT_INIT__ = true;



  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function initSOS() {
    const sos = document.getElementById("hmsSosBtn");
    if (!sos) return;

    sos.addEventListener("click", async function () {
      if (!confirm("Trigger emergency SOS? Hospital, doctors, and ambulance teams will be alerted.")) return;

      const modal = document.getElementById("hmsSosModal");
      if (modal) modal.classList.remove("hidden");

      try {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=");
        audio.volume = 0.6;
        audio.play().catch(function () {});
      } catch (e) {}

      let lat = null;
      let lng = null;
      try {
        const pos = await new Promise(function (resolve, reject) {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {}

      try {
        await fetch("/patient/sos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat,
            lng,
            message: "Emergency SOS — patient needs immediate help"
          })
        });
      } catch (e) {}

      const socket = window.hmsSocket && window.hmsSocket();
      const user = window.HMS_USER;
      if (socket && user) {
        socket.emit("trigger-sos", {
          patientId: user.id,
          patientName: user.name,
          lat,
          lng,
          message: "Emergency SOS triggered",
          ts: Date.now()
        });
      }

      if (window.hmsShowToast) window.hmsShowToast("SOS Sent", "Emergency teams alerted with your location.", "error");
    });
  }

  window.markAllRead = async function () {
    try {
      await fetch("/patient/notifications/read-all", { method: "POST" });
      location.reload();
    } catch (e) {
      if (window.hmsShowToast) window.hmsShowToast("Error", "Could not mark all as read", "error");
    }
  };

  window.checkInEarly = async function (appointmentId) {
    if (!confirm("Check in for your upcoming appointment?")) return;
    try {
      const res = await fetch("/patient/appointments/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId })
      });
      const data = await res.json();
      if (data.success) {
        if (window.hmsShowToast) window.hmsShowToast("Checked In", "You have been checked in successfully.", "success");
        setTimeout(function () { location.reload(); }, 1200);
      } else {
        if (window.hmsShowToast) window.hmsShowToast("Check-in", data.error || "Failed", "error");
      }
    } catch (e) {
      if (window.hmsShowToast) window.hmsShowToast("Error", e.message, "error");
    }
  };

  window.viewLabReport = function (type) {
    if (type === "blood") {
      window.location.href = "/patient/lab-reports/blood";
    } else {
      window.location.href = "/patient/lab-reports";
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    initSOS();
  });
})();
