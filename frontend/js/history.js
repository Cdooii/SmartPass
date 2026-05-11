/* ========================================
   HISTORY PAGE
======================================== */

let allRecords = [];
let filteredRecords = [];
let currentPage = 1;
const recordsPerPage = 10;
let currentView = "table";
let currentQRPrintRecord = null;

/* ================================
   Auth Headers
================================ */
function getAuthHeaders() {
  const token = localStorage.getItem("smartpass_token");

  if (!token) {
    window.location.href = "/index.html";
    return null;
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

/* ================================
   Escape HTML
================================ */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ================================
   Formatting
================================ */
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

function formatDateOnly(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function formatDateInput(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isRenewable(record) {
  if (record.type !== "Equipment" || !record.validity_date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(record.validity_date);
  expiry.setHours(0, 0, 0, 0);

  const renewStart = new Date(expiry);
  renewStart.setDate(expiry.getDate() - 2);

  // Renewable from 2 days before expiry and anytime after expiry
  return today >= renewStart;
}

function qrImageUrl(qrData) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData || "")}`;
}

function openQRResultModal(record, title = "Permit QR Code") {
  if (!record) return;

  currentQRPrintRecord = record;

  let modal = document.getElementById("qrResultModal");

  if (!modal) {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="qrResultModal" class="modal">
        <div class="modal-content" style="max-width:420px;">
          <div class="modal-header">
            <h2 class="modal-title" id="qrResultTitle">Permit QR Code</h2>
            <button class="modal-close" onclick="closeQRResultModal()">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body" style="text-align:center;">
            <img id="qrResultImage" style="width:220px; height:220px; margin:10px auto; display:block;">
            <h3 id="qrResultPermitId"></h3>
            <p id="qrResultName"></p>
            <p id="qrResultValidity"></p>

            <div style="margin-top:20px; display:flex; gap:10px; justify-content:center;">
              <button class="w3-button w3-blue" onclick="printPermitQR(currentQRPrintRecord)">
                <i class="fas fa-print"></i> Reprint
              </button>

              <button class="w3-button w3-gray" onclick="closeQRResultModal()">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  document.getElementById("qrResultTitle").textContent = title;
  document.getElementById("qrResultImage").src = qrImageUrl(record.permitId);
  document.getElementById("qrResultPermitId").textContent = record.permitId || "-";
  document.getElementById("qrResultName").textContent = record.name || "-";

  document.getElementById("qrResultValidity").textContent =
    record.type === "Equipment"
      ? `Valid Until: ${formatDateOnly(record.validity_date)}`
      : record.valid_until
        ? `Valid Until: ${formatDateOnly(record.valid_until)}`
        : "";

  document.getElementById("qrResultModal").classList.add("show");
}

function closeQRResultModal() {
  document.getElementById("qrResultModal")?.classList.remove("show");
}

function printPermitQR(record) {
  if (!record) return;

  const printWindow = window.open("", "_blank");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SmartPass QR</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 30px;
        }

        img {
          width: 250px;
          height: 250px;
        }

        h2, h3, p {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <h2>SmartPass Permit QR</h2>
      <img src="${qrImageUrl(record.permitId)}">
      <h3>${escapeHtml(record.permitId || "-")}</h3>
      <p><strong>Name:</strong> ${escapeHtml(record.name || "-")}</p>
      <p><strong>Type:</strong> ${escapeHtml(record.type || "-")}</p>
      <p><strong>Item/Purpose:</strong> ${escapeHtml(record.item || record.purpose || "-")}</p>
      ${
        record.type === "Equipment"
          ? `<p><strong>Valid Until:</strong> ${escapeHtml(formatDateOnly(record.validity_date))}</p>`
          : record.valid_until
            ? `<p><strong>Valid Until:</strong> ${escapeHtml(formatDateOnly(record.valid_until))}</p>`
            : ""
      }

      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();

  if (s === "pending") return "pending";
  if (s === "active") return "active";
  if (s === "expired") return "expired";

  return "expired";
}

/* ================================
   Records
================================ */
async function loadHistoryRecords() {
  try {
    const response = await fetch("/history/records", {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load history records");
    }

    allRecords = Array.isArray(data.records) ? data.records : [];
    filteredRecords = [...allRecords];
    currentPage = 1;

    applyFilters();
  } catch (err) {
    console.error("History load error:", err);
    const tbody = document.getElementById("historyTableBody");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="no-data">Failed to load records</td>
        </tr>
      `;
    }
  }
}

function applyFilters() {
  const search = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
  const dateFrom = document.getElementById("dateFrom")?.value || "";
  const dateTo = document.getElementById("dateTo")?.value || "";
  const type = document.getElementById("typeFilter")?.value.toLowerCase() || "";
  const status = document.getElementById("statusFilter")?.value.toLowerCase() || "";

  filteredRecords = allRecords.filter((record) => {
    const searchBlob = [
      record.date,
      record.permitId,
      record.name,
      record.type,
      record.item,
      record.status,
      record.timeIn,
      record.timeOut
    ]
      .join(" ")
      .toLowerCase();

    const recordDate = record.date ? new Date(record.date) : null;
    const fromOk = !dateFrom || (recordDate && recordDate >= new Date(`${dateFrom}T00:00:00`));
    const toOk = !dateTo || (recordDate && recordDate <= new Date(`${dateTo}T23:59:59`));
    const typeOk = !type || String(record.type || "").toLowerCase() === type;
    const statusOk = !status || String(record.status || "").toLowerCase() === status;
    const searchOk = !search || searchBlob.includes(search);

    return fromOk && toOk && typeOk && statusOk && searchOk;
  });

  currentPage = 1;
  displayRecords();
  updateResultCount();
  renderPagination();
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  document.getElementById("typeFilter").value = "";
  document.getElementById("statusFilter").value = "";

  applyFilters();
}

function displayRecords() {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (filteredRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="no-data">
          No records found
        </td>
      </tr>
    `;
    return;
  }

  const start = (currentPage - 1) * recordsPerPage;
  const paginated = filteredRecords.slice(start, start + recordsPerPage);

  paginated.forEach((record) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(formatDateOnly(record.date))}</td>
      <td><span class="permit-id">${escapeHtml(record.permitId)}</span></td>
      <td class="record-name">${escapeHtml(record.name)}</td>
      <td>
        <span class="record-type ${String(record.type || "").toLowerCase()}">
          ${escapeHtml(record.type)}
        </span>
      </td>
      <td>${escapeHtml(record.item || "-")}</td>
      <td class="w3-hide-small">
        <span class="record-status ${statusClass(record.status)}">
          <i class="fas fa-circle"></i>
          ${escapeHtml(record.status || "-")}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn primary" onclick="viewDetails('${escapeHtml(record.permitId)}')">
            <i class="fas fa-eye"></i> View
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function updateResultCount() {
  const el = document.getElementById("resultCount");
  if (el) el.textContent = filteredRecords.length;
}

/* ================================
   Pagination
================================ */
function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / recordsPerPage));
  const pageNumbers = document.getElementById("pageNumbers");
  const prevBtn = document.querySelector(".pagination .page-btn:first-child");
  const nextBtn = document.querySelector(".pagination .page-btn:last-child");

  if (!pageNumbers) return;

  pageNumbers.innerHTML = "";

  for (let i = 1; i <= totalPages; i += 1) {
    const btn = document.createElement("button");
    btn.className = `page-number ${i === currentPage ? "active" : ""}`;
    btn.textContent = i;
    btn.onclick = () => {
      currentPage = i;
      displayRecords();
      renderPagination();
    };
    pageNumbers.appendChild(btn);
  }

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function previousPage() {
  if (currentPage > 1) {
    currentPage -= 1;
    displayRecords();
    renderPagination();
  }
}

function nextPage() {
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  if (currentPage < totalPages) {
    currentPage += 1;
    displayRecords();
    renderPagination();
  }
}

/* ================================
   View toggle
================================ */
function changeView(view) {
  currentView = view;

  document.querySelectorAll(".view-btn").forEach((btn) => btn.classList.remove("active"));
  const clicked = Array.from(document.querySelectorAll(".view-btn")).find((btn) =>
    btn.textContent.toLowerCase().includes(view)
  );
  if (clicked) clicked.classList.add("active");

  const tableSection = document.querySelector(".history-table-section");
  if (!tableSection) return;

  if (currentView === "card") {
    tableSection.classList.add("card-view-mode");
  } else {
    tableSection.classList.remove("card-view-mode");
  }
}

/* ================================
   Detail modal
================================ */
function viewDetails(permitId) {
  const record = allRecords.find((r) => r.permitId === permitId);
  if (!record) return;

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  if (!modal || !modalBody) return;

  let html = `
    <div class="detail-grid">

      <div class="detail-item">
        <span class="detail-label">Created</span>
        <span class="detail-value">${escapeHtml(formatDateTime(record.createdAt))}</span>
      </div>

      ${
        record.type === "Equipment"
          ? `
          <div class="detail-item">
            <span class="detail-label">Approved</span>
            <span class="detail-value">${escapeHtml(formatDateTime(record.approvedAt))}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Validity Date</span>
            <span class="detail-value">${escapeHtml(formatDateOnly(record.validity_date))}</span>
          </div>
          `
          : ""
      }

      <div class="detail-item">
        <span class="detail-label">Permit ID</span>
        <span class="detail-value">${escapeHtml(record.permitId)}</span>
      </div>

      <div class="detail-item full-width" style="text-align:center;">
        <span class="detail-label">QR Code</span>
        <img 
          src="${qrImageUrl(record.permitId)}" 
          style="width:180px; height:180px; margin:10px auto; display:block;"
        >
        <span class="detail-value">${escapeHtml(record.permitId)}</span>
      </div>
      
      <div class="detail-item">
        <span class="detail-label">Name</span>
        <span class="detail-value">${escapeHtml(record.name)}</span>
      </div>

      <div class="detail-item">
        <span class="detail-label">Type</span>
        <span class="detail-value">${escapeHtml(record.type)}</span>
      </div>

      <div class="detail-item">
        <span class="detail-label">Contact Number</span>
        <span class="detail-value">${escapeHtml(record.contactNumber || "-")}</span>
      </div>

      <div class="detail-item full-width">
        <span class="detail-label">Purpose / Item</span>
        <span class="detail-value">${escapeHtml(record.item || record.purpose || "-")}</span>
      </div>

      <div class="detail-item">
        <span class="detail-label">Status</span>
        <span class="detail-value">${escapeHtml(record.status || "-")}</span>
      </div>

      <div class="detail-item">
        <span class="detail-label">Time In</span>
        <span class="detail-value">${escapeHtml(formatDateTime(record.timeIn))}</span>
      </div>

      <div class="detail-item">
        <span class="detail-label">Time Out</span>
        <span class="detail-value">${escapeHtml(formatDateTime(record.timeOut))}</span>
      </div>

      ${
        record.photo
          ? `
          <div class="detail-item full-width">
            <span class="detail-label">Picture</span>
            <img src="${escapeHtml(record.photo)}" class="detail-photo" 
                 style="max-width:220px; border-radius:10px; border:1px solid #ccc;">
          </div>
          `
          : ""
      }
  `;

  // ===============================
  // EQUIPMENT MOVEMENT LOGS
  // ===============================
  if (record.type === "Equipment") {
    html += `
      <div class="detail-item full-width">
        <span class="detail-label">Movement History</span>
        <div class="detail-value" style="margin-top:10px;">
    `;

    if (!record.logs || record.logs.length === 0) {
      html += `<p>No movement logs</p>`;
    } else {
      record.logs.forEach(log => {
        const isEntry = log.type_name === "ENTRY";

        html += `
          <div style="
            padding:8px 12px;
            margin-bottom:6px;
            border-left:4px solid ${isEntry ? "green" : "red"};
            background:#f9f9f9;
            border-radius:6px;
          ">
            <strong style="color:${isEntry ? "green" : "red"}">
              ${escapeHtml(log.type_name)}
            </strong>
            <br>
            <small>
              ${escapeHtml(formatDateTime(log.log_timestamp))}
              ${log.staff_name ? ` • ${escapeHtml(log.staff_name)}` : ""}
            </small>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  }

  // ===============================
  // EXPORT + RENEW BUTTON
  // ===============================
  const renewButton = record.type === "Equipment" && isRenewable(record)
    ? `
      <button class="w3-button w3-green" onclick="openRenewModal('${escapeHtml(record.permitId)}')">
        <i class="fas fa-sync-alt"></i> Renew Permit
      </button>
    `
    : record.type === "Equipment"
      ? `
        <button class="w3-button w3-gray" disabled title="Renewal is only available 2 days before expiry">
          <i class="fas fa-lock"></i> Renew Available 2 Days Before Expiry
        </button>
      `
      : "";

  html += `
      <div class="detail-item full-width" style="margin-top:20px; text-align:right; display:flex; gap:10px; justify-content:flex-end;">
        ${renewButton}

        <button class="w3-button w3-blue" onclick="exportHistoryPDF()">
          <i class="fas fa-file-pdf"></i> Export Full History
        </button>
      </div>

    </div>
  `;

  modalBody.innerHTML = html;
  modal.classList.add("show");
}

function closeDetailModal() {
  document.getElementById("detailModal")?.classList.remove("show");
}

/* ================================
   Renewal modal
================================ */
function openRenewModal(permitId) {
  const record = allRecords.find((r) => r.permitId === permitId);
  if (!record || record.type !== "Equipment") return;

  let modal = document.getElementById("renewModal");

  if (!modal) {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="renewModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">Renew Equipment Permit</h2>
            <button class="modal-close" onclick="closeRenewModal()">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <form id="renewForm" class="detail-grid" onsubmit="submitRenewal(event)">
              <input type="hidden" id="renewPassId">

              <div class="detail-item">
                <span class="detail-label">Permit ID / QR Code</span>
                <input class="filter-input" id="renewPermitId" readonly>
              </div>

              <div class="detail-item">
                <span class="detail-label">Current Validity Date</span>
                <input class="filter-input" id="renewValidityDate" readonly>
              </div>

              <div class="detail-item">
                <span class="detail-label">ID Number</span>
                <input class="filter-input" id="renewExternalId" required>
              </div>

              <div class="detail-item">
                <span class="detail-label">Owner Name</span>
                <input class="filter-input" id="renewName" required>
              </div>

              <div class="detail-item">
                <span class="detail-label">Contact Number</span>
                <input class="filter-input" id="renewContact">
              </div>

              <div class="detail-item">
                <span class="detail-label">Owner Type</span>
                <select class="filter-select" id="renewOwnerType" required>
                  <option value="Student">Student</option>
                  <option value="Teaching">Teaching</option>
                  <option value="Non-Teaching">Non-Teaching</option>
                </select>
              </div>

              <div class="detail-item">
                <span class="detail-label">Department</span>
                <input class="filter-input" id="renewDepartment">
              </div>

              <div class="detail-item">
                <span class="detail-label">Item Name</span>
                <input class="filter-input" id="renewItemName" required>
              </div>

              <div class="detail-item full-width">
                <span class="detail-label">Purpose</span>
                <textarea class="filter-input" id="renewPurpose" required></textarea>
              </div>

              <div class="detail-item full-width">
                <span class="detail-label">Additional Notes / Description</span>
                <textarea class="filter-input" id="renewItemDescription"></textarea>
              </div>

              <div id="renewElectronicFields" class="detail-item full-width"></div>
              <div id="renewOtherFields" class="detail-item full-width"></div>

              <div class="detail-item full-width" style="text-align:right; margin-top:15px;">
                <button type="button" class="w3-button w3-gray" onclick="closeRenewModal()">Cancel</button>
                <button type="submit" class="w3-button w3-green">
                  <i class="fas fa-check"></i> Complete Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `);

    modal = document.getElementById("renewModal");

    modal.addEventListener("click", (e) => {
      if (e.target.id === "renewModal") closeRenewModal();
    });
  }

  document.getElementById("renewPassId").value = record.pass_id || record.record_id || "";
  document.getElementById("renewPermitId").value = record.permitId || "";
  document.getElementById("renewValidityDate").value = formatDateInput(record.validity_date);
  document.getElementById("renewExternalId").value = record.external_id || "";
  document.getElementById("renewName").value = record.name || "";
  document.getElementById("renewContact").value = record.contactNumber || "";
  document.getElementById("renewOwnerType").value = record.owner_type || "Student";
  document.getElementById("renewDepartment").value = record.department || "";
  document.getElementById("renewItemName").value = record.item_name || record.item || "";
  document.getElementById("renewPurpose").value = record.purpose || "";
  document.getElementById("renewItemDescription").value = record.item_description || "";

  const electronicFields = document.getElementById("renewElectronicFields");
  const otherFields = document.getElementById("renewOtherFields");

  electronicFields.innerHTML = "";
  otherFields.innerHTML = "";

  if (record.item_type === "Electronic") {
    electronicFields.innerHTML = `
      <h4>Electronic Item Details</h4>

      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Computer Type</span>
          <input class="filter-input" id="renewComputerType" value="${escapeHtml(record.computer_type || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Brand</span>
          <input class="filter-input" id="renewBrand" value="${escapeHtml(record.brand || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Model No.</span>
          <input class="filter-input" id="renewModelNo" value="${escapeHtml(record.model_no || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Serial Number</span>
          <input class="filter-input" id="renewSerialNumber" value="${escapeHtml(record.serial_number || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Accessories</span>
          <input class="filter-input" id="renewAccessories" value="${escapeHtml(record.accessories || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Processor</span>
          <input class="filter-input" id="renewProcessor" value="${escapeHtml(record.processor || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Memory</span>
          <input class="filter-input" id="renewMemory" value="${escapeHtml(record.memory || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Hard Drive</span>
          <input class="filter-input" id="renewHardDrive" value="${escapeHtml(record.hard_drive || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Operating System</span>
          <input class="filter-input" id="renewOperatingSystem" value="${escapeHtml(record.operating_system || "")}">
        </div>
      </div>
    `;
  }

  if (record.item_type === "Other") {
    otherFields.innerHTML = `
      <h4>Non-Computer Item Details</h4>

      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Category</span>
          <input class="filter-input" id="renewCategory" value="${escapeHtml(record.category || "")}">
        </div>

        <div class="detail-item">
          <span class="detail-label">Quantity</span>
          <input type="number" min="1" class="filter-input" id="renewQuantity" value="${escapeHtml(record.quantity || 1)}">
        </div>

        <div class="detail-item full-width">
          <span class="detail-label">Description</span>
          <textarea class="filter-input" id="renewOtherDescription">${escapeHtml(record.other_description || "")}</textarea>
        </div>

        <div class="detail-item full-width">
          <span class="detail-label">Condition Notes</span>
          <textarea class="filter-input" id="renewConditionNotes">${escapeHtml(record.condition_notes || "")}</textarea>
        </div>
      </div>
    `;
  }

  modal.classList.add("show");
}

function closeRenewModal() {
  document.getElementById("renewModal")?.classList.remove("show");
}

async function submitRenewal(event) {
  event.preventDefault();

  const passId = document.getElementById("renewPassId").value;

  const payload = {
    externalId: document.getElementById("renewExternalId").value.trim(),
    name: document.getElementById("renewName").value.trim(),
    contactNumber: document.getElementById("renewContact").value.trim(),
    ownerType: document.getElementById("renewOwnerType").value,
    department: document.getElementById("renewDepartment").value.trim(),
    itemName: document.getElementById("renewItemName").value.trim(),
    purpose: document.getElementById("renewPurpose").value.trim(),
    itemDescription: document.getElementById("renewItemDescription").value.trim(),

    computerType: document.getElementById("renewComputerType")?.value.trim(),
    brand: document.getElementById("renewBrand")?.value.trim(),
    modelNo: document.getElementById("renewModelNo")?.value.trim(),
    serialNumber: document.getElementById("renewSerialNumber")?.value.trim(),
    accessories: document.getElementById("renewAccessories")?.value.trim(),
    processor: document.getElementById("renewProcessor")?.value.trim(),
    memory: document.getElementById("renewMemory")?.value.trim(),
    hardDrive: document.getElementById("renewHardDrive")?.value.trim(),
    operatingSystem: document.getElementById("renewOperatingSystem")?.value.trim(),

    category: document.getElementById("renewCategory")?.value.trim(),
    quantity: document.getElementById("renewQuantity")?.value,
    otherDescription: document.getElementById("renewOtherDescription")?.value.trim(),
    conditionNotes: document.getElementById("renewConditionNotes")?.value.trim()
  };

  try {
    const response = await fetch(`/history/equipment/${passId}/renew`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to renew permit");
    }

    alert("Permit renewed successfully. Same QR code can continue to be used.");

    closeRenewModal();
    closeDetailModal();

    await loadHistoryRecords();

    const renewedRecord = allRecords.find((record) => String(record.pass_id || record.record_id) === String(passId));

    openQRResultModal(
      renewedRecord || {
        permitId: document.getElementById("renewPermitId").value,
        name: document.getElementById("renewName").value,
        type: "Equipment",
        item: document.getElementById("renewItemName").value,
        purpose: document.getElementById("renewPurpose").value
      },
      "Renewed Permit QR Code"
    );

  } catch (err) {
    console.error("Renewal error:", err);
    alert(err.message || "Failed to renew permit.");
  }
}

/* ================================
   Monthly summary
================================ */
function setSummaryCard(prefix, data) {
  const checkIn = Number(data?.checkIn || 0);
  const checkOut = Number(data?.checkOut || 0);
  const netInside = Number(data?.netInside || 0);
  const total = checkIn + checkOut;
  const progress = total > 0 ? Math.round((checkIn / total) * 100) : 0;

  document.getElementById(`${prefix}In`).textContent = checkIn;
  document.getElementById(`${prefix}Out`).textContent = checkOut;
  document.getElementById(`${prefix}Net`).textContent = netInside;
  document.getElementById(`${prefix}Progress`).style.width = `${progress}%`;
  document.getElementById(`${prefix}ProgressText`).textContent = `${progress}% activity`;
}

async function updateMonthlySummary() {
  try {
    const preset = document.getElementById("monthSelector")?.value || "current";
    const customFrom = document.getElementById("customFrom")?.value || "";
    const customTo = document.getElementById("customTo")?.value || "";

    const params = new URLSearchParams({ preset });

    if (preset === "custom") {
      if (!customFrom || !customTo) {
        setSummaryCard("computer", { checkIn: 0, checkOut: 0, netInside: 0 });
        setSummaryCard("nonComputer", { checkIn: 0, checkOut: 0, netInside: 0 });
        setSummaryCard("visitors", { checkIn: 0, checkOut: 0, netInside: 0 });
        return;
      }
      params.append("from", customFrom);
      params.append("to", customTo);
    }

    const response = await fetch(`/history/summary?${params.toString()}`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load summary");
    }

    setSummaryCard("computer", data.computer);
    setSummaryCard("nonComputer", data.nonComputer);
    setSummaryCard("visitors", data.visitors);
  } catch (err) {
    console.error("Summary load error:", err);
  }
}

/* ================================
   Export filtered table to PDF
================================ */
function exportRecords() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF is not loaded.");
    return;
  }

  const exportRows = filteredRecords.map((record) => [
    formatDateOnly(record.date),
    record.permitId || "-",
    record.name || "-",
    record.type || "-",
    record.item || "-",
    record.status || "-",
    formatDateTime(record.timeIn),
    formatDateTime(record.timeOut)
  ]);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "mm", "a4");

  doc.setFontSize(16);
  doc.text("SmartPass History Records", 14, 15);

  doc.setFontSize(10);
  doc.text(`Exported: ${new Date().toLocaleString("en-PH")}`, 14, 22);
  doc.text(`Rows: ${filteredRecords.length}`, 14, 28);

  doc.autoTable({
    startY: 34,
    head: [[
      "Date",
      "Permit ID",
      "Name",
      "Type",
      "Item/Purpose",
      "Status",
      "Time In",
      "Time Out"
    ]],
    body: exportRows,
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [0, 51, 102]
    }
  });

  doc.save(`history-records-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportHistoryPDF() {
  const element = document.getElementById("modalBody");

  const opt = {
    margin: 0.5,
    filename: "SmartPass-History.pdf",
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}

/* ================================
   Init
================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadHistoryRecords();
  updateMonthlySummary();

  document.getElementById("monthSelector")?.addEventListener("change", () => {
    const customRange = document.getElementById("customRangeFilters");
    if (customRange) {
      customRange.style.display =
        document.getElementById("monthSelector").value === "custom" ? "flex" : "none";
    }
    updateMonthlySummary();
  });

  document.getElementById("customFrom")?.addEventListener("change", updateMonthlySummary);
  document.getElementById("customTo")?.addEventListener("change", updateMonthlySummary);

  document.getElementById("detailModal")?.addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeDetailModal();
  });
});