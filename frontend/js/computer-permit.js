async function submitComputerForm(e) {
  e.preventDefault();

  const formData = new FormData();

  formData.append("external_id", document.getElementById("computerId")?.value || "");
  formData.append("bearer_name", document.getElementById("computerBearer")?.value || "");
  formData.append("user_type", document.getElementById("computerType")?.value || "");
  formData.append("purpose", document.getElementById("computerPurpose")?.value || "");

  formData.append("item_name", document.getElementById("computerItemName")?.value || "");
  formData.append("brand", document.getElementById("computerBrand")?.value || "");
  formData.append("model", document.getElementById("computerModel")?.value || "");
  formData.append("serial", document.getElementById("computerSerial")?.value || "");
  formData.append("accessories", document.getElementById("computerAccessories")?.value || "");

  formData.append("processor", document.getElementById("computerProcessor")?.value || "");
  formData.append("memory", document.getElementById("computerMemory")?.value || "");
  formData.append("hard_drive", document.getElementById("computerHardDrive")?.value || "");
  formData.append("monitor", document.getElementById("computerMonitor")?.value || "");
  formData.append("casing", document.getElementById("computerCasing")?.value || "");
  formData.append("cd_dvd_rom", document.getElementById("computerCD")?.value || "");
  formData.append("operating_system", document.getElementById("computerOS")?.value || "");
  formData.append("description", document.getElementById("computerSpecs")?.value || "");

  formData.append("noted_by", document.getElementById("notedBy")?.value || "");
  formData.append("recommending_approval", document.getElementById("recommendingApproval")?.value || "");
  formData.append("checked_by", document.getElementById("checkedBy")?.value || "");
  formData.append("custodian_approval", document.getElementById("custodianApproval")?.value || "");

  const photoFile = document.getElementById("computerPhotoInput")?.files?.[0];
  if (photoFile) {
    formData.append("photo", photoFile);
  }

  try {
    const res = await fetch("/items/computer", {
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
      document.getElementById("computerBearer")?.value || "-";

    document.getElementById("successIdNumber").textContent =
      document.getElementById("computerId")?.value || "-";

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
    console.error(err);
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
  alert("QR is only available after approval.");
}

function downloadQR() {
  alert("QR is only available after approval.");
}

function emailPass() {
  alert("QR is only available after approval.");
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
  alert("QR is only available after approval.");
}

function downloadQR() {
  alert("QR is only available after approval.");
}

function emailPass() {
  alert("QR is only available after approval.");
}

function closeSuccessModal() {
  document.getElementById("successModal").style.display = "none";
}

function createNewApplication() {
  location.reload();
}