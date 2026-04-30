let allNotifications = [];
let currentFilter = "all";

async function checkApprovalAccess() {
    try {
        const res = await fetch("/admin/profile", {
            headers: getAuthHeaders()
        });

        const data = await res.json();

        const role = data.staff_role || data.role || "";

        if (role !== "CSU-Head") {
            alert("Access denied");
            window.location.href = "dashboard.html";
        }

    } catch (err) {
        console.error(err);
        window.location.href = "dashboard.html";
    }
}

/* ===============================
   AUTH
================================ */
function getAuthHeaders() {
  const token = localStorage.getItem("smartpass_token");

  if (!token) {
    window.location.href = "/index.html";
    return null;
  }

  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

/* ===============================
   HELPERS
================================ */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function getStatusMeta(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "PENDING") {
    return {
      key: "pending",
      label: "Pending",
      icon: "fas fa-clock",
      title: "Permit awaiting approval"
    };
  }

  if (normalized === "ACTIVE") {
    return {
      key: "approved",
      label: "Approved",
      icon: "fas fa-check-circle",
      title: "Permit approved"
    };
  }

  return {
    key: "rejected",
    label: "Rejected / Expired",
    icon: "fas fa-times-circle",
    title: "Permit not active"
  };
}

/* ===============================
   LOAD PERMITS AS NOTIFICATIONS
================================ */
async function loadNotifications() {
  const headers = getAuthHeaders();
  if (!headers) return;

  try {
    document.getElementById("loadingState").style.display = "flex";
    document.getElementById("emptyState").style.display = "none";

    const response = await fetch("/history/records", {
      headers
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load notifications");
    }

    const records = Array.isArray(data.records) ? data.records : [];

    // Notifications page is mainly for equipment approval workflow
    allNotifications = records
      .filter(record => String(record.type || "").toLowerCase() === "equipment")
      .map(record => {
        const statusMeta = getStatusMeta(record.status);

        return {
          id: record.id,
          permitId: record.permitId,
          name: record.name,
          item: record.item,
          status: String(record.status || "").toUpperCase(),
          statusKey: statusMeta.key,
          statusLabel: statusMeta.label,
          icon: statusMeta.icon,
          title: statusMeta.title,
          date: record.date,
          timeIn: record.timeIn,
          timeOut: record.timeOut,
          is_read: statusMeta.key !== "pending"
        };
      });

    updateCounts();
    renderNotifications();

  } catch (err) {
    console.error("Notifications load error:", err);
    document.getElementById("notificationsList").innerHTML = `
      <div class="empty-state" style="display:flex;">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Failed to load notifications</h3>
        <p>${escapeHtml(err.message || "Please try again.")}</p>
      </div>
    `;
  } finally {
    const loading = document.getElementById("loadingState");
    if (loading) loading.style.display = "none";
  }
}

/* ===============================
   COUNTS
================================ */
function updateCounts() {
  const all = allNotifications.length;
  const unread = allNotifications.filter(n => !n.is_read).length;
  const pending = allNotifications.filter(n => n.status === "PENDING").length;
  const approved = allNotifications.filter(n => n.status === "ACTIVE").length;
  const rejected = allNotifications.filter(
    n => n.status !== "PENDING" && n.status !== "ACTIVE"
  ).length;

  document.getElementById("countAll").textContent = all;
  document.getElementById("countUnread").textContent = unread;
  document.getElementById("countPending").textContent = pending;
  document.getElementById("countApproved").textContent = approved;
  document.getElementById("countRejected").textContent = rejected;

  const badge = document.getElementById("notificationBadge");
  if (badge) {
    if (unread > 0) {
      badge.style.display = "inline-flex";
      badge.textContent = unread;
    } else {
      badge.style.display = "none";
    }
  }
}

/* ===============================
   FILTER
================================ */
function filterNotifications(filter) {
  currentFilter = filter;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  renderNotifications();
}

function getFilteredNotifications() {
  if (currentFilter === "all") return allNotifications;
  if (currentFilter === "unread") return allNotifications.filter(n => !n.is_read);
  if (currentFilter === "pending") return allNotifications.filter(n => n.status === "PENDING");
  if (currentFilter === "approved") return allNotifications.filter(n => n.status === "ACTIVE");
  if (currentFilter === "rejected") {
    return allNotifications.filter(n => n.status !== "PENDING" && n.status !== "ACTIVE");
  }

  return allNotifications;
}

/* ===============================
   RENDER
================================ */
function renderNotifications() {
  const list = document.getElementById("notificationsList");
  const emptyState = document.getElementById("emptyState");

  if (!list) return;

  const filtered = getFilteredNotifications();

  // Preserve built-in loading/empty blocks if present
  const loadingMarkup = `
    <div class="loading-state" id="loadingState" style="display:none;">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Loading notifications...</p>
    </div>
  `;

  if (filtered.length === 0) {
    list.innerHTML = loadingMarkup;
    if (emptyState) {
      emptyState.style.display = "flex";
      list.appendChild(emptyState);
    } else {
      list.innerHTML += `
        <div class="empty-state" style="display:flex;">
          <i class="fas fa-bell-slash"></i>
          <h3>No Notifications</h3>
          <p>You're all caught up! No notifications to display.</p>
        </div>
      `;
    }
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  const cards = filtered.map(item => {
    const unreadClass = item.is_read ? "" : " unread";

    const actions = item.status === "PENDING"
      ? `
        <div class="notification-actions">
          <button class="notif-btn primary" onclick="approvePermit(${item.id})">
            <i class="fas fa-check"></i>
            Approve
          </button>
          <button class="notif-btn secondary" onclick="rejectPermit(${item.id})">
            <i class="fas fa-times"></i>
            Reject
          </button>
          <button class="notif-btn secondary" onclick="markAsRead(${item.id})">
            <i class="fas fa-envelope-open"></i>
            Mark Read
          </button>
        </div>
      `
      : `
        <div class="notification-actions">
          <button class="notif-btn secondary" onclick="markAsRead(${item.id})">
            <i class="fas fa-envelope-open"></i>
            Mark Read
          </button>
        </div>
      `;

    return `
      <div class="notification-card${unreadClass}">
        <div class="notification-header">
          <div class="notification-icon-circle ${item.statusKey}">
            <i class="${item.icon}"></i>
          </div>

          <div class="notification-body">
            <div class="notification-title">
              ${escapeHtml(item.title)}
            </div>

            <div class="notification-message">
              <strong>${escapeHtml(item.permitId)}</strong><br>
              Bearer: ${escapeHtml(item.name)}<br>
              Item/Purpose: ${escapeHtml(item.item || "-")}<br>
              Status: ${escapeHtml(item.statusLabel)}
            </div>

            <div class="notification-meta">
              <span class="meta-item">
                <i class="fas fa-calendar-alt"></i>
                ${escapeHtml(formatDateTime(item.date))}
              </span>
              <span class="meta-item">
                <i class="fas fa-tag"></i>
                Equipment Permit
              </span>
            </div>

            ${actions}
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.innerHTML = loadingMarkup + cards;
}

/* ===============================
   APPROVAL ACTIONS
================================ */
async function approvePermit(passId) {
  const headers = getAuthHeaders();
  if (!headers) return;

  if (!confirm("Approve this permit?")) return;

  try {
    const response = await fetch(`/admin-item-approval/items/${passId}/approve`, {
      method: "POST",
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Approval failed");
      return;
    }

    alert(data.message || "Permit approved successfully");
    await refreshNotifications();

  } catch (err) {
    console.error("Approve error:", err);
    alert("Approval failed");
  }
}

async function rejectPermit(passId) {
  const headers = getAuthHeaders();
  if (!headers) return;

  if (!confirm("Reject this permit?")) return;

  try {
    const response = await fetch(`/admin-item-approval/items/${passId}/reject`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "Rejected from notifications page" })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Reject failed");
      return;
    }

    alert(data.message || "Permit rejected successfully");
    await refreshNotifications();

  } catch (err) {
    console.error("Reject error:", err);
    alert("Reject failed");
  }
}

/* ===============================
   READ STATE
================================ */
function markAsRead(passId) {
  allNotifications = allNotifications.map(item =>
    item.id === passId ? { ...item, is_read: true } : item
  );

  updateCounts();
  renderNotifications();
}

function markAllAsRead() {
  allNotifications = allNotifications.map(item => ({
    ...item,
    is_read: true
  }));

  updateCounts();
  renderNotifications();
}

/* ===============================
   REFRESH
================================ */
async function refreshNotifications() {
  await loadNotifications();
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await checkApprovalAccess();
  loadNotifications();
});