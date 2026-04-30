const express = require("express");
const QRCode = require("qrcode");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

/* =========================================================
   MULTER SETUP
========================================================= */
const uploadDir = path.join(__dirname, "..", "frontend", "uploads", "visitors");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext || ".jpg";
    cb(null, `visitor-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

/* =========================================================
   VISITOR REGISTRATION
========================================================= */
router.post("/register", upload.single("photo"), async (req, res) => {
  const { name, contact_number, purpose, date_of_visit } = req.body;

  if (!name || !contact_number || !purpose || !date_of_visit) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const photoPath = req.file ? `/uploads/visitors/${req.file.filename}` : null;

    // 1. Insert visitor
    const [visitorResult] = await db.query(
      `INSERT INTO visitor (name, contact_number, purpose, photo_path)
       VALUES (?, ?, ?, ?)`,
      [name, contact_number, purpose, photoPath]
    );

    const visitorId = visitorResult.insertId;

    // 2. Generate QR data
    const qrData = `QRV-${String(visitorId).padStart(3, "0")}`;

    // 3. Insert visitor pass
    await db.query(
      `INSERT INTO visitor_pass_record
       (visitor_id, qr_code_data, valid_from, valid_until, valid_status)
       VALUES (?, ?, NOW(), ?, 'Active')`,
      [visitorId, qrData, `${date_of_visit} 23:59:59`]
    );

    // 4. Generate QR image
    const qrImage = await QRCode.toDataURL(qrData);

    res.status(201).json({
      message: "Visitor registered successfully",
      visitor_id: visitorId,
      qr_code_data: qrData,
      qr_image: qrImage,
      photo_path: photoPath
    });
  } catch (err) {
    console.error("Visitor registration error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;