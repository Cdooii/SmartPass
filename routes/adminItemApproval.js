const express = require("express");
const db = require("../db");

const router = express.Router();

/* =========================================================
   APPROVE ITEM (UPDATED WORKFLOW)
   - Uses existing ITEM_PASS
   - Generates QR only here
========================================================= */
router.post("/items/:pass_id/approve", async (req, res) => {
  const { pass_id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT * FROM ITEM_PASS WHERE pass_id = ?`,
      [pass_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Permit not found"
      });
    }

    const pass = rows[0];

    if (pass.approval_status !== "PENDING") {
      return res.status(400).json({
        message: "Permit already processed"
      });
    }

    const qr_code = `QRI-${pass_id.toString().padStart(4, "0")}`;

    await db.query(`
      UPDATE ITEM_PASS
      SET approval_status = 'ACTIVE',
          qr_code_data = ?,
          approved_at = NOW()
      WHERE pass_id = ?
    `, [qr_code, pass_id]);

    res.json({
      message: "Permit approved successfully",
      qr_code,
      pass_id
    });

  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   REJECT ITEM
========================================================= */
router.post("/items/:pass_id/reject", async (req, res) => {
  const { pass_id } = req.params;
  const { reason } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT * FROM ITEM_PASS WHERE pass_id = ?`,
      [pass_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Permit not found"
      });
    }

    const pass = rows[0];

    if (pass.approval_status !== "PENDING") {
      return res.status(400).json({
        message: "Permit already processed"
      });
    }

    await db.query(`
      UPDATE ITEM_PASS
      SET approval_status = 'EXPIRED'
      WHERE pass_id = ?
    `, [pass_id]);

    res.json({
      message: "Permit rejected successfully"
    });

  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;