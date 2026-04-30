/* ========================================
   TOPBAR JAVASCRIPT (SECURE VERSION)
======================================== */

// ================================
// Helper: Get Auth Headers
// ================================
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

// ================================
// Toggle Logout Dropdown
// ================================
function toggleLogout() {
    const dropdown = document.getElementById("logoutDropdown");
    dropdown.classList.toggle("show");

    document.addEventListener("click", function closeDropdown(event) {
        if (!event.target.closest(".profile-dropdown")) {
            dropdown.classList.remove("show");
            document.removeEventListener("click", closeDropdown);
        }
    });
}

// ================================
// Logout
// ================================
function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {

        localStorage.removeItem("smartpass_token");
        localStorage.clear();

        window.location.href = "/index.html";
    }
}

// ================================
// Load User From Backend
// ================================
async function loadUserProfile() {
    try {

        const response = await fetch("/admin/profile", {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            handleLogout();
            return;
        }

        const data = await response.json();

        const role = data.staff_role || data.role || "";

        // Topbar display
        document.getElementById("userName").textContent = data.name;
        document.getElementById("userRole").textContent = role;

        // Dropdown display
        document.getElementById("dropdownName").textContent = data.name;
        document.getElementById("dropdownEmail").textContent = data.username;

        // ✅ Show Approvals only for CSU Head
        const approvalMenu = document.getElementById("approvalMenu");

        if (approvalMenu) {
            approvalMenu.style.display = (role === "CSU_HEAD") ? "flex" : "none";
        }

    } catch (err) {
        console.error("Profile load error:", err);
        handleLogout();
    }
}

// ================================
// Highlight Active Nav Link
// ================================
function setActiveNavLink() {
    const currentPage = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll(".topbar-link, .mobile-nav-link");

    navLinks.forEach(link => {
        const href = link.getAttribute("href");
        if (href === currentPage) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

// ================================
// Authentication Check
// ================================
function checkAuthentication() {
    const token = localStorage.getItem("smartpass_token");

    if (!token) {
        window.location.href = "/index.html";
    }
}

// ================================
// ✅ PERMIT MODAL FUNCTIONS (NEW)
// ================================
function openPermitModal() {
    const modal = document.getElementById("permitModal");

    if (!modal) {
        console.warn("permitModal not found on this page");
        return;
    }

    modal.style.display = "block";
}

function closePermitModal() {
    const modal = document.getElementById("permitModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function goToPermit(type) {
    if (type === "computer") {
        window.location.href = "computer-permit.html";
    } else {
        window.location.href = "nonComputer-Permit.html";
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById("mobileMenu");
    if (!menu) return;

    menu.classList.toggle("show");
}

// ================================
// Initialize
// ================================
document.addEventListener("DOMContentLoaded", function () {
    checkAuthentication();
    loadUserProfile();
    setActiveNavLink();
});