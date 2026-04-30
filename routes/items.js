const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ===============================
   MULTER SETUP
================================ */
const uploadDir = path.join(__dirname, "..", "frontend", "uploads", "items");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `item-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
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

/* ===============================
   CLEANUP EXPIRED PASSES
================================ */
async function cleanupExpiredPasses() {
  await db.query(`
    UPDATE ITEM_PASS
    SET approval_status = 'EXPIRED'
    WHERE validity_date < CURDATE()
      AND approval_status <> 'EXPIRED'
  `);
}

/* ===============================
   CREATE COMPUTER ITEM PASS
================================ */
router.post("/computer", upload.single("photo"), async (req, res) => {
  try {
    await cleanupExpiredPasses();

    const {
      external_id,
      bearer_name,
      user_type,
      purpose,
      item_name,
      brand,
      model,
      serial,
      accessories,
      processor,
      memory,
      hard_drive,
      monitor,
      casing,
      cd_dvd_rom,
      operating_system,
      description,
      noted_by,
      recommending_approval,
      checked_by,
      custodian_approval
    } = req.body;

    if (
      !external_id ||
      !bearer_name ||
      !user_type ||
      !purpose ||
      !item_name ||
      !brand ||
      !model ||
      !serial ||
      !processor ||
      !memory ||
      !hard_drive ||
      !recommending_approval ||
      !custodian_approval
    ) {
      return res.status(400).json({
        message: "Please complete all required fields"
      });
    }

    const photoPath = req.file ? `/uploads/items/${req.file.filename}` : null;

    let normalizedType = user_type;
    if (user_type === "Teaching") normalizedType = "Teaching";
    if (user_type === "Non-Teaching") normalizedType = "Non-Teaching";
    if (user_type === "Student") normalizedType = "Student";

    const [existing] = await db.query(`
      SELECT ip.pass_id, ip.approval_status
      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io ON io.owner_id = ip.owner_id
      WHERE io.external_id = ?
        AND ip.approval_status IN ('PENDING', 'ACTIVE')
        AND ip.validity_date >= CURDATE()
      ORDER BY ip.pass_id DESC
      LIMIT 1
    `, [external_id]);

    if (existing.length > 0) {
      return res.status(400).json({
        message: `A ${existing[0].approval_status.toLowerCase()} permit already exists for this ID number`
      });
    }

    let owner_id;
    const [ownerExisting] = await db.query(`
      SELECT owner_id
      FROM ITEM_OWNER
      WHERE external_id = ?
      LIMIT 1
    `, [external_id]);

    if (ownerExisting.length > 0) {
      owner_id = ownerExisting[0].owner_id;

      await db.query(`
        UPDATE ITEM_OWNER
        SET name = ?, owner_type = ?
        WHERE owner_id = ?
      `, [bearer_name, normalizedType, owner_id]);
    } else {
      const [ownerResult] = await db.query(`
        INSERT INTO ITEM_OWNER (external_id, name, owner_type)
        VALUES (?, ?, ?)
      `, [external_id, bearer_name, normalizedType]);

      owner_id = ownerResult.insertId;
    }

    const [itemResult] = await db.query(`
      INSERT INTO ITEM (item_type, item_name, purpose, description)
      VALUES ('Electronic', ?, ?, ?)
    `, [item_name, purpose, description || null]);

    const item_id = itemResult.insertId;

    const [passResult] = await db.query(`
      INSERT INTO ITEM_PASS
      (
        owner_id,
        qr_code_data,
        validity_date,
        status,
        noted_by,
        recommending_approval,
        custodian_approval,
        checked_by,
        approval_status,
        item_id,
        photo_path
      )
      VALUES (?, '', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'OUT',
              ?, ?, ?, ?, 'PENDING', ?, ?)
    `, [
      owner_id,
      noted_by || null,
      recommending_approval,
      custodian_approval,
      checked_by || null,
      item_id,
      photoPath
    ]);

    const pass_id = passResult.insertId;

    await db.query(`
      INSERT INTO ELECTRONIC_ITEM
      (
        item_id,
        computer_type,
        brand,
        model_no,
        serial_number,
        accessories,
        processor,
        motherboard,
        memory,
        hard_drive,
        monitor,
        casing,
        cd_dvd_rom,
        operating_system,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      item_id,
      item_name,
      brand,
      model,
      serial,
      accessories || null,
      processor || null,
      null,
      memory || null,
      hard_drive || null,
      monitor || null,
      casing || null,
      cd_dvd_rom || null,
      operating_system || null,
      description || null
    ]);

    res.json({
      message: "Application submitted successfully. Waiting for approval.",
      pass_id,
      approval_status: "PENDING",
      qr_code: null,
      photo_path: photoPath
    });

  } catch (err) {
    console.error("Computer permit error:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Duplicate entry" });
    }

    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   STAFF
================================ */
router.get("/staff", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT staff_id, name, staff_role
      FROM STAFF
      ORDER BY name ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Staff load error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   CREATE NON-COMPUTER ITEM PASS
================================ */
router.post("/other", upload.single("photo"), async (req, res) => {
  try {
    await cleanupExpiredPasses();

    const {
      external_id,
      bearer_name,
      user_type,
      purpose,
      category,
      quantity,
      description,
      condition_notes,
      noted_by,
      recommending_approval,
      checked_by,
      custodian_approval
    } = req.body;

    if (
      !external_id ||
      !bearer_name ||
      !user_type ||
      !purpose ||
      !category ||
      !quantity ||
      !description ||
      !recommending_approval ||
      !custodian_approval
    ) {
      return res.status(400).json({
        message: "Please complete all required fields"
      });
    }

    const photoPath = req.file ? `/uploads/items/${req.file.filename}` : null;

    let normalizedType = user_type;
    if (user_type === "Teaching") normalizedType = "Teaching";
    if (user_type === "Non-Teaching") normalizedType = "Non-Teaching";
    if (user_type === "Student") normalizedType = "Student";

    const [existing] = await db.query(`
      SELECT ip.pass_id, ip.approval_status
      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io ON io.owner_id = ip.owner_id
      WHERE io.external_id = ?
        AND ip.approval_status IN ('PENDING', 'ACTIVE')
        AND ip.validity_date >= CURDATE()
      ORDER BY ip.pass_id DESC
      LIMIT 1
    `, [external_id]);

    if (existing.length > 0) {
      return res.status(400).json({
        message: `A ${existing[0].approval_status.toLowerCase()} permit already exists for this ID number`
      });
    }

    let owner_id;
    const [ownerExisting] = await db.query(`
      SELECT owner_id
      FROM ITEM_OWNER
      WHERE external_id = ?
      LIMIT 1
    `, [external_id]);

    if (ownerExisting.length > 0) {
      owner_id = ownerExisting[0].owner_id;

      await db.query(`
        UPDATE ITEM_OWNER
        SET name = ?, owner_type = ?
        WHERE owner_id = ?
      `, [bearer_name, normalizedType, owner_id]);
    } else {
      const [ownerResult] = await db.query(`
        INSERT INTO ITEM_OWNER (external_id, name, owner_type)
        VALUES (?, ?, ?)
      `, [external_id, bearer_name, normalizedType]);

      owner_id = ownerResult.insertId;
    }

    const [itemResult] = await db.query(`
      INSERT INTO ITEM (item_type, item_name, purpose)
      VALUES ('Other', ?, ?)
    `, [description, purpose]);

    const item_id = itemResult.insertId;

    const [passResult] = await db.query(`
      INSERT INTO ITEM_PASS
      (
        owner_id,
        qr_code_data,
        validity_date,
        status,
        noted_by,
        recommending_approval,
        custodian_approval,
        checked_by,
        approval_status,
        item_id,
        photo_path
      )
      VALUES (?, '', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'OUT',
              ?, ?, ?, ?, 'PENDING', ?, ?)
    `, [
      owner_id,
      noted_by || null,
      recommending_approval,
      custodian_approval,
      checked_by || null,
      item_id,
      photoPath
    ]);

    const pass_id = passResult.insertId;

    await db.query(`
      INSERT INTO OTHER_ITEM
      (item_id, category, quantity, description, condition_notes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      item_id,
      category,
      quantity,
      description,
      condition_notes || null
    ]);

    res.json({
      message: "Application submitted successfully. Waiting for approval.",
      pass_id,
      approval_status: "PENDING",
      qr_code: null,
      photo_path: photoPath
    });

  } catch (err) {
    console.error("Non-computer permit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;