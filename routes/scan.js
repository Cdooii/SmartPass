const express = require("express");
const db = require("../db");

const router = express.Router();

/* =========================================================
   SCAN LOOKUP (UNCHANGED + FIXED ITEM JOIN)
========================================================= */
router.get("/scan-lookup", async (req, res) => {
  const qr_code = req.query.qr_code;

  if (!qr_code) {
    return res.status(400).json({ message: "QR code missing" });
  }

  try {
    const [visitor] = await db.query(`
      SELECT v.name as visitor_name, v.purpose 
      FROM VISITOR_PASS_RECORD vp
      JOIN VISITOR v ON v.visitor_id = vp.visitor_id
      WHERE vp.qr_code_data = ?
    `, [qr_code]);

    if (visitor.length > 0) {
      return res.json(visitor[0]);
    }

    const [item] = await db.query(`
      SELECT io.name as visitor_name, i.purpose
      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io ON io.owner_id = ip.owner_id
      LEFT JOIN ITEM i ON i.item_id = ip.item_id
      WHERE ip.qr_code_data = ?
    `, [qr_code]);

    if (item.length > 0) {
      return res.json(item[0]);
    }

    return res.status(404).json({ message: "QR Code not found" });

  } catch (err) {
    console.error("Lookup error:", err);
    return res.status(500).json({ message: "Server error during lookup" });
  }
});

/* =========================================================
   SCAN CONFIRM
========================================================= */
router.post("/scan-confirm", async (req, res) => {
  const { qr_code } = req.body;
  const staff_id = req.user?.staff_id || 1;

  try {
    if (qr_code.startsWith("QRV")) {
      const [visitor] = await db.query(`
        SELECT visitor_id, valid_until, valid_status
        FROM VISITOR_PASS_RECORD
        WHERE qr_code_data = ?
      `, [qr_code]);

      if (visitor.length === 0) {
        return res.status(404).json({ message: "Visitor QR not found" });
      }

      const pass = visitor[0];
      const visitor_id = pass.visitor_id;

      const [counts] = await db.query(`
        SELECT 
          SUM(CASE WHEN type_id = 1 THEN 1 ELSE 0 END) AS entry_count,
          SUM(CASE WHEN type_id = 2 THEN 1 ELSE 0 END) AS exit_count
        FROM ACCESS_LOGS
        WHERE visitor_pass_id = ?
      `, [visitor_id]);

      const entry = Number(counts[0].entry_count || 0);
      const exit = Number(counts[0].exit_count || 0);

      let type_id;
      let action;

      // already inside -> allow EXIT even if validity date passed
      if (entry > exit) {
        type_id = 2;
        action = "EXIT";
      } else {
        // first entry must still be valid
        if (new Date(pass.valid_until) < new Date() || pass.valid_status === "Expired") {
          return res.status(400).json({ message: "Visitor pass expired" });
        }

        if (entry === 0 && exit === 0) {
          type_id = 1;
          action = "ENTRY";
        } else {
          return res.status(400).json({
            message: "QR already completed"
          });
        }
      }

      await db.query(`
        INSERT INTO ACCESS_LOGS
        (type_id, staff_id, visitor_pass_id, log_timestamp)
        VALUES (?, ?, ?, NOW())
      `, [type_id, staff_id, visitor_id]);

      if (type_id === 2) {
        await db.query(`
          UPDATE VISITOR_PASS_RECORD
          SET valid_status = 'Expired'
          WHERE visitor_id = ?
        `, [visitor_id]);
      } else {
        await db.query(`
          UPDATE VISITOR_PASS_RECORD
          SET valid_status = 'Active'
          WHERE visitor_id = ?
        `, [visitor_id]);
      }

      return res.json({ message: `${action} successful`, action });
    }

    else if (qr_code.startsWith("QRI")) {
      const [itemPass] = await db.query(`
        SELECT *
        FROM ITEM_PASS
        WHERE qr_code_data = ?
      `, [qr_code]);

      if (itemPass.length === 0) {
        return res.status(404).json({ message: "Item QR not found" });
      }

      const pass = itemPass[0];

      if (pass.approval_status !== "ACTIVE") {
        return res.status(400).json({
          message: "Permit not approved yet"
        });
      }

      if (new Date(pass.validity_date) < new Date()) {
        return res.status(400).json({ message: "QR expired" });
      }

      let action;
      let type_id;
      let newStatus;

      if (pass.status === "OUT") {
        action = "ENTRY";
        type_id = 1;
        newStatus = "IN";
      } else if (pass.status === "IN") {
        action = "EXIT";
        type_id = 2;
        newStatus = "OUT";
      } else {
        return res.status(400).json({
          message: "QR already completed"
        });
      }

      await db.query(`
        INSERT INTO ACCESS_LOGS
        (type_id, staff_id, item_pass_id, log_timestamp)
        VALUES (?, ?, ?, NOW())
      `, [type_id, staff_id, pass.pass_id]);

      await db.query(`
        UPDATE ITEM_PASS
        SET status = ?, checked_by = ?
        WHERE pass_id = ?
      `, [newStatus, staff_id, pass.pass_id]);

      return res.json({
        message: `${action} successful`,
        action
      });
    }

    return res.status(400).json({ message: "Invalid QR format" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Scan failed" });
  }
});

/* =========================================================
   PREVIEW
========================================================= */
router.post("/preview", async (req, res) => {
  const { qr_code_data } = req.body;

  if (!qr_code_data) {
    return res.status(400).json({ message: "QR data missing" });
  }

  try {
    const [visitor] = await db.query(`
      SELECT v.name, v.purpose
      FROM VISITOR_PASS_RECORD vp
      JOIN VISITOR v ON v.visitor_id = vp.visitor_id
      WHERE vp.qr_code_data = ?
    `, [qr_code_data]);

    if (visitor.length > 0) {
      return res.json({
        type: "VISITOR",
        name: visitor[0].name,
        info: visitor[0].purpose
      });
    }

    const [item] = await db.query(`
      SELECT io.name, i.purpose
      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io ON io.owner_id = ip.owner_id
      LEFT JOIN ITEM i ON i.item_id = ip.item_id
      WHERE ip.qr_code_data = ?
    `, [qr_code_data]);

    if (item.length > 0) {
      return res.json({
        type: "ITEM",
        name: item[0].name,
        info: item[0].purpose
      });
    }

    return res.status(404).json({ message: "Not found" });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;