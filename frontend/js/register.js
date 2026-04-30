document.getElementById("registerForm")
  .addEventListener("submit", async function (e) {

  e.preventDefault();

  const id_number = document.getElementById("id_number").value.trim();
  const name = document.getElementById("name").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const errorMessage = document.getElementById("errorMessage");
  errorMessage.textContent = "";

  try {

    const response = await fetch("/admin/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id_number,
        name,
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      errorMessage.textContent = data.message || "Registration failed";
      return;
    }

    alert("Registration successful! Please login.");
    window.location.href = "index.html";

  } catch (err) {
    console.error("Registration error:", err);
    errorMessage.textContent = "Server error. Try again.";
  }
});