const express = require("express");
const db = require("../db");

const router = express.Router();

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */
router.get("/summary", async (req, res) => {
  try {
    const [visitorResult] = await db.query(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT 
          visitor_pass_id,
          COUNT(CASE WHEN type_id = 1 THEN 1 END) AS entry_count,
          COUNT(CASE WHEN type_id = 2 THEN 1 END) AS exit_count
        FROM ACCESS_LOGS
        WHERE visitor_pass_id IS NOT NULL
        GROUP BY visitor_pass_id
      ) t
      WHERE entry_count > exit_count
    `);

    const [equipmentResult] = await db.query(`
      SELECT COUNT(*) AS count
      FROM ITEM_PASS
      WHERE status = 'IN'
        AND approval_status = 'ACTIVE'
    `);

    const [pendingResult] = await db.query(`
      SELECT COUNT(*) AS count
      FROM ITEM_PASS
      WHERE approval_status = 'PENDING'
    `);

    const [qrReadyResult] = await db.query(`
      SELECT COUNT(*) AS count
      FROM ITEM_PASS
      WHERE approval_status = 'ACTIVE'
        AND qr_code_data <> ''
        AND qr_released = 0
    `);

    // ✅ ONLY ONE RESPONSE
    res.json({
      visitorInside: visitorResult[0].count || 0,
      equipmentInside: equipmentResult[0].count || 0,
      ongoingApplications: pendingResult[0].count || 0,
      qrReady: qrReadyResult[0].count || 0
    });

  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   LIVE FEED
========================================================= */
router.get("/live-feed", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM (

        SELECT 
          v.name AS visitor_name,
          NULL AS owner_name,
          v.purpose AS visitor_purpose,
          NULL AS item_purpose,
          'Visitor' AS record_type,
          tt.type_name,
          al.log_timestamp
        FROM ACCESS_LOGS al
        JOIN VISITOR v 
          ON v.visitor_id = al.visitor_pass_id
        JOIN TRANSACTION_TYPE tt 
          ON tt.type_id = al.type_id

        UNION ALL

        SELECT 
          NULL AS visitor_name,
          io.name AS owner_name,
          NULL AS visitor_purpose,
          COALESCE(i.item_name, i.purpose, 'Unknown Item') AS item_purpose,
          'Equipment' AS record_type,
          tt.type_name,
          al.log_timestamp
        FROM ACCESS_LOGS al
        JOIN ITEM_PASS ip 
          ON ip.pass_id = al.item_pass_id
        JOIN ITEM_OWNER io 
          ON io.owner_id = ip.owner_id
        LEFT JOIN ITEM i 
          ON i.item_id = ip.item_id
        JOIN TRANSACTION_TYPE tt 
          ON tt.type_id = al.type_id
        WHERE al.item_pass_id IS NOT NULL

      ) AS combined
      ORDER BY combined.log_timestamp DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error("Live feed error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   PENDING LIST
========================================================= */
router.get("/pending", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ip.pass_id,
        io.name AS bearer,
        io.external_id,
        i.item_type,
        COALESCE(i.item_name, i.purpose, 'Item') AS item_label,
        i.purpose,
        ip.validity_date
      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io ON io.owner_id = ip.owner_id
      LEFT JOIN ITEM i ON i.item_id = ip.item_id
      WHERE ip.approval_status = 'PENDING'
      ORDER BY ip.pass_id DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error("Pending permits error:", err);
    res.status(500).json({ message: "Error loading pending permits" });
  }
});

/* =========================================================
   FULL PENDING / PERMIT DETAILS
========================================================= */
router.get("/pending/:pass_id", async (req, res) => {
  const { pass_id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT
        ip.pass_id,
        ip.qr_code_data,
        ip.validity_date,
        ip.status,
        ip.approval_status,

        io.external_id,
        io.name AS bearer_name,
        io.owner_type,
        io.department,
        io.contact_number,

        i.item_id,
        i.item_type,
        i.item_name,
        i.purpose,
        i.description AS item_description,

        ei.computer_type,
        ei.brand,
        ei.model_no,
        ei.serial_number,
        ei.accessories,
        ei.processor,
        ei.motherboard,
        ei.memory,
        ei.hard_drive,
        ei.monitor,
        ei.casing,
        ei.cd_dvd_rom,
        ei.operating_system,
        ei.description AS electronic_description,

        oi.category,
        oi.quantity,
        oi.description AS other_description,
        oi.condition_notes,

        noted.name AS noted_by_name,
        recommender.name AS recommending_approval_name,
        checker.name AS checked_by_name,
        custodian.name AS custodian_approval_name

      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io ON io.owner_id = ip.owner_id
      LEFT JOIN ITEM i ON i.item_id = ip.item_id
      LEFT JOIN ELECTRONIC_ITEM ei ON ei.item_id = i.item_id
      LEFT JOIN OTHER_ITEM oi ON oi.item_id = i.item_id
      LEFT JOIN STAFF noted ON noted.staff_id = ip.noted_by
      LEFT JOIN STAFF recommender ON recommender.staff_id = ip.recommending_approval
      LEFT JOIN STAFF checker ON checker.staff_id = ip.checked_by
      LEFT JOIN STAFF custodian ON custodian.staff_id = ip.custodian_approval
      WHERE ip.pass_id = ?
      LIMIT 1
    `, [pass_id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Permit not found" });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error("Pending permit detail error:", err);
    res.status(500).json({ message: "Error loading permit details" });
  }
});

router.get("/approved", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ip.pass_id,
        ip.qr_code_data,
        ip.validity_date,
        io.name AS bearer,
        io.external_id,
        i.item_type,
        i.item_name,
        i.purpose
      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io ON io.owner_id = ip.owner_id
      LEFT JOIN ITEM i ON i.item_id = ip.item_id
      WHERE ip.approval_status = 'ACTIVE'
        AND ip.qr_code_data <> ''
        AND ip.qr_released = 0
      ORDER BY ip.pass_id DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error("Approved permits error:", err);
    res.status(500).json({ message: "Error loading approved permits" });
  }
});

router.post("/release/:pass_id", async (req, res) => {
  const { pass_id } = req.params;

  try {
    await db.query(`
      UPDATE ITEM_PASS
      SET qr_released = 1
      WHERE pass_id = ?
    `, [pass_id]);

    res.json({ message: "QR released successfully" });

  } catch (err) {
    console.error("QR release error:", err);
    res.status(500).json({ message: "Error marking QR as released" });
  }
});

module.exports = router;