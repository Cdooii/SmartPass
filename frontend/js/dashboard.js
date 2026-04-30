// ===============================
// AUTH
// ===============================
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

// ===============================
// GLOBAL STATE
// ===============================
let html5QrCode = null;
let currentQR = null;
let isProcessingScan = false;
let currentPermit = null;
let currentUserRole = "";

// ===============================
// USER ROLE
// ===============================
async function loadUserRole() {
    try {
        const res = await fetch("/admin/profile", {
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            console.error(data.message || "Failed to load role");
            return;
        }

        currentUserRole = data.staff_role || data.role || "";
        applyRoleUI();

    } catch (err) {
        console.error("Role load error:", err);
    }
}

function applyRoleUI() {
    const statCards = document.querySelectorAll(".stat-card");
    const mainCard = statCards[0];
    const statLabel = mainCard?.querySelector(".stat-label");
    const statTrend = mainCard?.querySelector(".stat-trend");

    if (!mainCard || !statLabel || !statTrend) return;

    mainCard.style.cursor = "pointer";

    if (currentUserRole === "Custodian Head") {
        statLabel.textContent = "QR Ready";
        statTrend.innerHTML = `<i class="fas fa-qrcode"></i> Ready to release`;
        mainCard.onclick = openQRReadyModal;
    } else {
        statLabel.textContent = "Ongoing Applications";
        statTrend.innerHTML = `<i class="fas fa-hourglass-half"></i> For Approval`;
        mainCard.onclick = openPendingModal;
    }
}

// ===============================
// HELPERS
// ===============================
function formatDate(dateString) {
    if (!dateString) return "-";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function downloadQRCode(qrCodeData, passId) {
    if (!qrCodeData) {
        alert("QR code is not available.");
        return;
    }

    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;

        const response = await fetch(qrUrl);
        if (!response.ok) {
            throw new Error("Failed to fetch QR image");
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `QR-${passId}.png`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 1000);

        const res = await fetch(`/dashboard/release/${passId}`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Failed to mark QR as released");
            return;
        }

        setTimeout(() => {
            closeApprovalModal();
            closePendingModal();
            loadDashboardSummary();
        }, 300);

    } catch (err) {
        console.error(err);
        alert("Failed to download QR");
    }
}

function printQRCode(qrCodeData, passId, bearerName) {
    if (!qrCodeData) {
        alert("QR code is not available.");
        return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;
    const win = window.open("", "", "width=700,height=700");

    win.document.write(`
        <html>
        <head>
            <title>Print QR</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 30px;
                }
                img {
                    margin-top: 20px;
                    width: 260px;
                    height: 260px;
                }
            </style>
        </head>
        <body>
            <h2>SmartPass QR Permit</h2>
            <p><strong>Pass ID:</strong> ${escapeHtml(passId)}</p>
            <p><strong>Bearer:</strong> ${escapeHtml(bearerName || "-")}</p>
            <img src="${qrUrl}" alt="QR Code">
        </body>
        </html>
    `);

    win.document.close();
    win.focus();
    win.print();
}

// ===============================
// LOAD SUMMARY
// ===============================
async function loadDashboardSummary() {
    try {
        const response = await fetch("/dashboard/summary", {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        document.getElementById("visitorInside").textContent =
            data.visitorInside || 0;

        document.getElementById("equipmentInside").textContent =
            data.equipmentInside || 0;

        if (currentUserRole === "Custodian Head") {
            document.getElementById("ongoingApplications").textContent =
                data.qrReady || 0;
        } else {
            document.getElementById("ongoingApplications").textContent =
                data.ongoingApplications || 0;
        }

    } catch (err) {
        console.error(err);
    }
}

// ===============================
// LOAD LIVE FEED
// ===============================
async function loadLiveFeed() {
    try {
        const response = await fetch("/dashboard/live-feed", {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        const tbody = document.getElementById("liveFeedBody");
        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">No records</td></tr>`;
            return;
        }

        data.forEach(row => {
            const tr = document.createElement("tr");

            const name = row.visitor_name || row.owner_name || "-";
            const type = row.record_type || "-";
            const purpose = row.visitor_purpose || row.item_purpose || "-";

            tr.innerHTML = `
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(type)}</td>
                <td>${escapeHtml(purpose)}</td>
                <td>${row.type_name === "ENTRY" ? escapeHtml(formatDate(row.log_timestamp)) : "-"}</td>
                <td class="w3-hide-small">${row.type_name === "EXIT" ? escapeHtml(formatDate(row.log_timestamp)) : "-"}</td>
                <td class="w3-hide-small">${escapeHtml(row.type_name || "-")}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
    }
}

// ===============================
// QR SCANNER
// ===============================
function openQRModal() {
    const modal = document.getElementById("qrModal");

    if (!modal) {
        console.error("qrModal not found");
        return;
    }

    modal.style.display = "flex";
    startScanner();
}

function closeQRModal() {
    const modal = document.getElementById("qrModal");

    if (html5QrCode) {
        html5QrCode.stop().catch(err => console.error(err));
    }

    modal.style.display = "none";
}

function startScanner() {
    if (!document.getElementById("reader")) {
        console.error("reader div not found");
        return;
    }

    html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
            handleScan(decodedText);
        }
    ).catch(err => {
        console.error("Scanner start failed:", err);
    });
}

async function handleScan(qr) {
    if (isProcessingScan) return;
    isProcessingScan = true;

    currentQR = qr;

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(`/scan/scan-lookup?qr_code=${encodeURIComponent(qr)}`, {
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "QR not found");
            isProcessingScan = false;
            return;
        }

        const confirmRes = await fetch("/scan/scan-confirm", {
            method: "POST",
            headers,
            body: JSON.stringify({ qr_code: qr })
        });

        const confirmData = await confirmRes.json();

        if (!confirmRes.ok) {
            alert(confirmData.message);
            isProcessingScan = false;
            return;
        }

        const msg = document.createElement("div");
        msg.textContent = `${confirmData.action} SUCCESS`;

        msg.style.position = "fixed";
        msg.style.top = "50%";
        msg.style.left = "50%";
        msg.style.transform = "translate(-50%, -50%)";
        msg.style.background = confirmData.action === "ENTRY" ? "green" : "red";
        msg.style.color = "#fff";
        msg.style.padding = "15px 25px";
        msg.style.borderRadius = "8px";
        msg.style.fontSize = "18px";
        msg.style.fontWeight = "bold";
        msg.style.zIndex = "9999";
        msg.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";

        document.body.appendChild(msg);

        setTimeout(() => msg.remove(), 2000);

        loadDashboardSummary();
        loadLiveFeed();

        closeQRModal();

    } catch (err) {
        console.error(err);
        alert("Scan failed");
    } finally {
        setTimeout(() => {
            isProcessingScan = false;
        }, 1500);
    }
}

// ===============================
// MANUAL QR INPUT
// ===============================
function simulateScan() {
    const value = document.getElementById("manualQRInput").value;

    if (!value) {
        alert("Enter QR ID");
        return;
    }

    handleScan(value);
}

// ===============================
// PENDING APPLICATIONS MODAL
// ===============================
async function openPendingModal() {
    const modal = document.getElementById("pendingModal");
    const tbody = document.getElementById("pendingTableBody");

    if (!modal || !tbody) {
        console.error("pendingModal or pendingTableBody not found");
        return;
    }

    modal.style.display = "flex";
    tbody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;

    try {
        const res = await fetch("/dashboard/pending", {
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(data.message || "Failed to load pending applications")}</td></tr>`;
            return;
        }

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">No pending applications</td></tr>`;
            return;
        }

        tbody.innerHTML = "";

        data.forEach(row => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";

            tr.innerHTML = `
                <td>${escapeHtml(row.pass_id)}</td>
                <td>${escapeHtml(row.bearer)}</td>
                <td>${escapeHtml(row.item_type || "-")}</td>
                <td>${escapeHtml(row.purpose || "-")}</td>
                <td>${escapeHtml(formatDate(row.validity_date))}</td>
            `;

            tr.onclick = () => openApprovalModal(row.pass_id);
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5">Failed to load pending applications</td></tr>`;
    }
}

function closePendingModal() {
    const modal = document.getElementById("pendingModal");
    if (modal) modal.style.display = "none";
}

// ===============================
// QR READY MODAL (CUSTODIAN)
// ===============================
async function openQRReadyModal() {
    const modal = document.getElementById("pendingModal");
    const tbody = document.getElementById("pendingTableBody");

    if (!modal || !tbody) {
        console.error("pendingModal or pendingTableBody not found");
        return;
    }

    modal.style.display = "flex";
    tbody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;

    try {
        const res = await fetch("/dashboard/approved", {
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(data.message || "Failed to load approved permits")}</td></tr>`;
            return;
        }

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">No QR-ready permits</td></tr>`;
            return;
        }

        tbody.innerHTML = "";

        data.forEach(row => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";

            tr.innerHTML = `
                <td>${escapeHtml(row.pass_id)}</td>
                <td>${escapeHtml(row.bearer)}</td>
                <td>${escapeHtml(row.item_type || "-")}</td>
                <td>${escapeHtml(row.purpose || "-")}</td>
                <td>${escapeHtml(formatDate(row.validity_date))}</td>
            `;

            tr.onclick = () => openQRReleaseModal(row.pass_id);
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5">Failed to load approved permits</td></tr>`;
    }
}

// ===============================
// APPROVAL DETAIL MODAL
// ===============================
async function openApprovalModal(passId) {
    try {
        const res = await fetch(`/dashboard/pending/${passId}`, {
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Failed to load details");
            return;
        }

        currentPermit = data;
        renderApprovalDetails(data, false);

        document.getElementById("approvalModal").style.display = "flex";

    } catch (err) {
        console.error(err);
        alert("Error loading permit details");
    }
}

async function openQRReleaseModal(passId) {
    try {
        const res = await fetch(`/dashboard/pending/${passId}`, {
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Failed to load details");
            return;
        }

        currentPermit = data;
        renderApprovalDetails(data, true);

        document.getElementById("approvalModal").style.display = "flex";

    } catch (err) {
        console.error(err);
        alert("Error loading permit details");
    }
}

function closeApprovalModal() {
    const modal = document.getElementById("approvalModal");
    if (modal) modal.style.display = "none";
}

function renderApprovalDetails(data, showQRTools = false) {
    const container = document.getElementById("approvalContent");
    if (!container) return;

    let html = `
        <div class="approval-section">
            <h3>Permit Information</h3>
            <p><b>Pass ID:</b> ${escapeHtml(data.pass_id)}</p>
            <p><b>Status:</b> ${escapeHtml(data.approval_status)}</p>
            <p><b>Validity Date:</b> ${escapeHtml(formatDate(data.validity_date))}</p>
            <p><b>Current Gate Status:</b> ${escapeHtml(data.status || "-")}</p>
        </div>

        <hr>

        <div class="approval-section">
            <h3>Owner Details</h3>
            <p><b>Name:</b> ${escapeHtml(data.bearer_name)}</p>
            <p><b>ID Number:</b> ${escapeHtml(data.external_id)}</p>
            <p><b>Owner Type:</b> ${escapeHtml(data.owner_type)}</p>
            <p><b>Department:</b> ${escapeHtml(data.department || "-")}</p>
            <p><b>Contact Number:</b> ${escapeHtml(data.contact_number || "-")}</p>
        </div>

        <hr>

        <div class="approval-section">
            <h3>Item Details</h3>
            <p><b>Item Type:</b> ${escapeHtml(data.item_type)}</p>
            <p><b>Item Name:</b> ${escapeHtml(data.item_name || "-")}</p>
            <p><b>Purpose:</b> ${escapeHtml(data.purpose || "-")}</p>
            <p><b>Description:</b> ${escapeHtml(data.item_description || "-")}</p>
        </div>
    `;

    if (data.item_type === "Electronic") {
        html += `
            <hr>
            <div class="approval-section">
                <h3>Computer Specifications</h3>
                <p><b>Computer Type:</b> ${escapeHtml(data.computer_type || "-")}</p>
                <p><b>Brand:</b> ${escapeHtml(data.brand || "-")}</p>
                <p><b>Model:</b> ${escapeHtml(data.model_no || "-")}</p>
                <p><b>Serial Number:</b> ${escapeHtml(data.serial_number || "-")}</p>
                <p><b>Accessories:</b> ${escapeHtml(data.accessories || "-")}</p>
                <p><b>Processor:</b> ${escapeHtml(data.processor || "-")}</p>
                <p><b>Motherboard:</b> ${escapeHtml(data.motherboard || "-")}</p>
                <p><b>Memory:</b> ${escapeHtml(data.memory || "-")}</p>
                <p><b>Hard Drive:</b> ${escapeHtml(data.hard_drive || "-")}</p>
                <p><b>Monitor:</b> ${escapeHtml(data.monitor || "-")}</p>
                <p><b>Casing:</b> ${escapeHtml(data.casing || "-")}</p>
                <p><b>CD/DVD ROM:</b> ${escapeHtml(data.cd_dvd_rom || "-")}</p>
                <p><b>Operating System:</b> ${escapeHtml(data.operating_system || "-")}</p>
                <p><b>Notes:</b> ${escapeHtml(data.electronic_description || "-")}</p>
            </div>
        `;
    }

    if (data.item_type === "Other") {
        html += `
            <hr>
            <div class="approval-section">
                <h3>Other Item Details</h3>
                <p><b>Category:</b> ${escapeHtml(data.category || "-")}</p>
                <p><b>Quantity:</b> ${escapeHtml(data.quantity || "-")}</p>
                <p><b>Description:</b> ${escapeHtml(data.other_description || "-")}</p>
                <p><b>Condition Notes:</b> ${escapeHtml(data.condition_notes || "-")}</p>
            </div>
        `;
    }

    html += `
        <hr>
        <div class="approval-section">
            <h3>Approval Flow</h3>
            <p><b>Noted By:</b> ${escapeHtml(data.noted_by_name || "-")}</p>
            <p><b>Recommended By:</b> ${escapeHtml(data.recommending_approval_name || "-")}</p>
            <p><b>Checked By:</b> ${escapeHtml(data.checked_by_name || "-")}</p>
            <p><b>Custodian Office:</b> ${escapeHtml(data.custodian_approval_name || "-")}</p>
        </div>
    `;

    if (showQRTools && data.qr_code_data) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data.qr_code_data)}`;

        html += `
            <hr>
            <div class="approval-section" style="text-align:center;">
                <h3>QR Code Ready for Release</h3>
                <img src="${qrUrl}" alt="QR Code" style="width:220px;height:220px;">
                <p><b>QR ID:</b> ${escapeHtml(data.qr_code_data)}</p>
                <div style="margin-top:15px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button class="w3-button w3-blue" onclick="event.stopPropagation(); downloadQRCode('${escapeHtml(data.qr_code_data)}','${escapeHtml(data.pass_id)}')">Download QR</button>
                    <button class="w3-button w3-teal" onclick="event.stopPropagation(); printQRCode('${escapeHtml(data.qr_code_data)}','${escapeHtml(data.pass_id)}','${escapeHtml(data.bearer_name)}')">Print QR</button>
                </div>
            </div>
        `;
    }

    let actionButtons = `
        <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="w3-button w3-light-grey" onclick="closeApprovalModal()">Close</button>
        </div>
    `;

    if (currentUserRole === "CSU Head" && !showQRTools) {
        actionButtons = `
            <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap;">
                <button class="w3-button w3-green" onclick="approveCurrent()">Approve</button>
                <button class="w3-button w3-red" onclick="rejectCurrent()">Reject</button>
                <button class="w3-button w3-light-grey" onclick="closeApprovalModal()">Close</button>
            </div>
        `;
    }

    html += actionButtons;
    container.innerHTML = html;
}

// ===============================
// APPROVAL ACTIONS
// ===============================
async function approveCurrent() {
    if (!currentPermit) return;

    if (!confirm("Approve this permit?")) return;

    try {
        const res = await fetch(`/admin/items/items/${currentPermit.pass_id}/approve`, {
            method: "POST",
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Approval failed");
            return;
        }

        alert(data.message || "Permit approved successfully");

        closeApprovalModal();
        closePendingModal();
        loadDashboardSummary();
        loadLiveFeed();

    } catch (err) {
        console.error(err);
        alert("Approval failed");
    }
}

async function rejectCurrent() {
    if (!currentPermit) return;

    if (!confirm("Reject this permit?")) return;

    try {
        const res = await fetch(`/admin/items/items/${currentPermit.pass_id}/reject`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason: "Rejected from dashboard" })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Reject failed");
            return;
        }

        alert(data.message || "Permit rejected successfully");

        closeApprovalModal();
        closePendingModal();
        loadDashboardSummary();
        loadLiveFeed();

    } catch (err) {
        console.error(err);
        alert("Reject failed");
    }
}

async function loadWelcomeName() {
    try {
        const res = await fetch("/admin/profile", {
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) return;

        const welcomeName = document.getElementById("welcomeName");
        if (welcomeName) {
            welcomeName.textContent = data.name || "User";
        }

    } catch (err) {
        console.error("Welcome name load error:", err);
    }
}

// ===============================
// INIT
// ===============================
loadUserRole();
loadWelcomeName();
loadDashboardSummary();
loadLiveFeed();

setInterval(() => {
    loadDashboardSummary();
    loadLiveFeed();
}, 5000);