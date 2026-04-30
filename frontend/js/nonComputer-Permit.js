async function submitNonComputerForm(e) {
  e.preventDefault();

  const formData = new FormData();

  formData.append("external_id", document.getElementById("nonComputerId").value);
  formData.append("bearer_name", document.getElementById("nonComputerBearer").value);
  formData.append("user_type", document.getElementById("nonComputerType").value);
  formData.append("purpose", document.getElementById("nonComputerPurpose").value);

  formData.append("category", document.getElementById("itemCategory").value);
  formData.append("quantity", document.getElementById("itemQuantity").value);
  formData.append("description", document.getElementById("itemDescription").value);
  formData.append("condition_notes", document.getElementById("itemCondition").value);

  formData.append("noted_by", document.getElementById("notedBy").value || "");
  formData.append("recommending_approval", document.getElementById("recommendingApproval").value || "");
  formData.append("checked_by", document.getElementById("checkedBy").value || "");
  formData.append("custodian_approval", document.getElementById("custodianApproval").value || "");

  const photoFile = document.getElementById("nonComputerPhotoInput")?.files?.[0];
  if (photoFile) {
    formData.append("photo", photoFile);
  }

  try {
    const res = await fetch("/items/other", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.message || "Submission failed");
      return;
    }

    document.getElementById("successPassId").textContent =
      result.pass_id ? `PASS-${result.pass_id}` : "-";

    document.getElementById("successBearer").textContent =
      document.getElementById("nonComputerBearer").value || "-";

    document.getElementById("successIdNumber").textContent =
      document.getElementById("nonComputerId").value || "-";

    document.getElementById("successDate").textContent =
      new Date().toLocaleDateString();

    document.getElementById("successMessage").textContent =
      result.message || "Application submitted successfully. Waiting for approval.";

    const qrImage = document.getElementById("qrImage");
    if (qrImage) {
      qrImage.src = "";
      qrImage.style.display = "none";
    }

    const statusBadge = document.querySelector(".status-badge");
    if (statusBadge) {
      statusBadge.className = "status-badge pending";
      statusBadge.innerHTML = `
        <i class="fas fa-clock"></i>
        PENDING
      `;
    }

    document.getElementById("successModal").style.display = "flex";

  } catch (err) {
    console.error("Frontend Error", err);
    alert("Submission failed");
  }
}

async function loadStaffDropdowns() {
  try {
    const res = await fetch("/items/staff");
    const staff = await res.json();

    ["notedBy", "recommendingApproval", "checkedBy", "custodianApproval"]
      .forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = `<option value="">Select Staff</option>`;

        staff.forEach(s => {
          const option = document.createElement("option");
          option.value = s.staff_id;
          option.textContent = s.name;
          select.appendChild(option);
        });
      });

  } catch (err) {
    console.error(err);
  }
}

function handlePhotoUpload(event, type) {
  const preview = document.getElementById(`${type}PhotoPreview`);
  if (!preview) return;

  preview.innerHTML = "";

  const files = Array.from(event.target.files || []);
  files.slice(0, 1).forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "150px";
    img.style.height = "150px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";
    img.style.border = "1px solid #ccc";
    img.style.marginTop = "10px";
    preview.appendChild(img);
  });
}

document.addEventListener("DOMContentLoaded", loadStaffDropdowns);

function printSticker() {
  alert("QR will be available after approval.");
}

function downloadQR() {
  alert("QR will be available after approval.");
}

function emailPass() {
  alert("QR will be available after approval.");
}

function closeSuccessModal() {
  document.getElementById("successModal").style.display = "none";
}

function createNewApplication() {
  location.reload();
}

// LOAD STAFF
async function loadStaffDropdowns() {
  try {
    const res = await fetch("/items/staff");
    const staff = await res.json();

    ["notedBy", "recommendingApproval", "checkedBy", "custodianApproval"]
      .forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = `<option value="">Select Staff</option>`;

        staff.forEach(s => {
          const option = document.createElement("option");
          option.value = s.staff_id;
          option.textContent = s.name;
          select.appendChild(option);
        });
      });

  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", loadStaffDropdowns);

// MODAL FUNCTIONS
function printSticker() {
  alert("QR will be available after approval.");
}

function downloadQR() {
  alert("QR will be available after approval.");
}

function emailPass() {
  alert("QR will be available after approval.");
}

function closeSuccessModal() {
  document.getElementById("successModal").style.display = "none";
}

function createNewApplication() {
  location.reload();
}