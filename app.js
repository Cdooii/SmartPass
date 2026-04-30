const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const adminRoutes = require("./routes/admin");
const visitorRoutes = require("./routes/visitors");
const scanRoutes = require("./routes/scan");
const dashboardRoutes = require("./routes/dashboard");
const authMiddleware = require("./middleware/auth");
const historyRoutes = require("./routes/history");
const itemRoutes = require("./routes/items");
const adminItemApprovalRoutes = require("./routes/adminItemApproval");

const app = express();

// ======================
// MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// SERVE FRONTEND FOLDER
// ======================
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "frontend", "uploads")));

// ======================
// API ROUTES
// ======================
app.use("/admin", adminRoutes);
app.use("/visitor", visitorRoutes);
app.use("/scan", authMiddleware, scanRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/history", authMiddleware, historyRoutes);
app.use("/items", itemRoutes);
app.use("/admin/items", adminItemApprovalRoutes);

// ======================
// DEFAULT ROUTE (LOGIN)
// ======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ======================
// START SERVER
// ======================
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SmartPass running at:
  - http://localhost:${PORT}
  - http://10.69.153.27:${PORT}`);
});