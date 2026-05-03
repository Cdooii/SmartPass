const express = require("express");
const db = require("../db");

const router = express.Router();

/* =========================================================
   HISTORY RECORDS
   - Visitors: one-time record
   - Equipment: includes full movement logs for modal view/export
========================================================= */
router.get("/records", async (req, res) => {
  try {
    // -----------------------------------------
    // VISITOR RECORDS
    // -----------------------------------------
    const [visitorRows] = await db.query(`
      SELECT
        vp.visitor_id AS record_id,
        NULL AS pass_id,
        vp.qr_code_data AS permitId,
        v.date_registered AS date,
        v.date_registered AS createdAt,
        NULL AS approvedAt,
        v.name AS name,
        'Visitor' AS type,
        v.purpose AS item,
        v.purpose AS purpose,
        v.contact_number AS contactNumber,
        vp.valid_status AS status,
        vp.valid_until,
        v.photo_path AS photo,

        (
          SELECT MIN(al.log_timestamp)
          FROM ACCESS_LOGS al
          WHERE al.visitor_pass_id = vp.visitor_id
            AND al.type_id = 1
        ) AS timeIn,

        (
          SELECT MAX(al.log_timestamp)
          FROM ACCESS_LOGS al
          WHERE al.visitor_pass_id = vp.visitor_id
            AND al.type_id = 2
        ) AS timeOut

      FROM VISITOR_PASS_RECORD vp
      JOIN VISITOR v
        ON v.visitor_id = vp.visitor_id
    `);

    // -----------------------------------------
    // EQUIPMENT RECORDS
    // -----------------------------------------
    const [equipmentRows] = await db.query(`
      SELECT
        ip.pass_id AS record_id,
        ip.pass_id,
        ip.qr_code_data AS permitId,
        COALESCE(ip.approved_at, ip.created_at, ip.validity_date) AS date,
        ip.created_at AS createdAt,
        ip.approved_at AS approvedAt,

        io.name AS name,
        'Equipment' AS type,

        COALESCE(i.item_name, i.purpose, 'Item') AS item,
        i.purpose AS purpose,

        io.contact_number AS contactNumber,
        ip.approval_status AS status,
        ip.validity_date,
        ip.photo_path AS photo,

        io.external_id,
        io.owner_type,
        io.department,

        i.item_type,
        i.item_name,
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
        custodian.name AS custodian_approval_name,

        (
          SELECT MIN(al.log_timestamp)
          FROM ACCESS_LOGS al
          WHERE al.item_pass_id = ip.pass_id
            AND al.type_id = 1
        ) AS timeIn,

        (
          SELECT MAX(al.log_timestamp)
          FROM ACCESS_LOGS al
          WHERE al.item_pass_id = ip.pass_id
            AND al.type_id = 2
        ) AS timeOut

      FROM ITEM_PASS ip
      JOIN ITEM_OWNER io
        ON io.owner_id = ip.owner_id
      LEFT JOIN ITEM i
        ON i.item_id = ip.item_id
      LEFT JOIN ELECTRONIC_ITEM ei
        ON ei.item_id = i.item_id
      LEFT JOIN OTHER_ITEM oi
        ON oi.item_id = i.item_id
      LEFT JOIN STAFF noted
        ON noted.staff_id = ip.noted_by
      LEFT JOIN STAFF recommender
        ON recommender.staff_id = ip.recommending_approval
      LEFT JOIN STAFF checker
        ON checker.staff_id = ip.checked_by
      LEFT JOIN STAFF custodian
        ON custodian.staff_id = ip.custodian_approval
    `);

    // -----------------------------------------
    // EQUIPMENT MOVEMENT LOGS
    // -----------------------------------------
    const [equipmentLogs] = await db.query(`
      SELECT
        al.item_pass_id,
        al.log_timestamp,
        tt.type_name,
        s.name AS staff_name
      FROM ACCESS_LOGS al
      JOIN TRANSACTION_TYPE tt
        ON tt.type_id = al.type_id
      LEFT JOIN STAFF s
        ON s.staff_id = al.staff_id
      WHERE al.item_pass_id IS NOT NULL
      ORDER BY al.log_timestamp ASC
    `);

    const equipmentLogMap = {};
    for (const log of equipmentLogs) {
      if (!equipmentLogMap[log.item_pass_id]) {
        equipmentLogMap[log.item_pass_id] = [];
      }
      equipmentLogMap[log.item_pass_id].push({
        log_timestamp: log.log_timestamp,
        type_name: log.type_name,
        staff_name: log.staff_name
      });
    }

    const visitors = visitorRows.map((row) => ({
      ...row,
      logs: [] // visitors are one-time, no need for full repeated movement history
    }));

    const equipment = equipmentRows.map((row) => ({
      ...row,
      logs: equipmentLogMap[row.pass_id] || []
    }));

    const records = [...visitors, ...equipment].sort((a, b) => {
      const aDate = new Date(a.date || a.createdAt || 0).getTime();
      const bDate = new Date(b.date || b.createdAt || 0).getTime();
      return bDate - aDate;
    });

    res.json({
      success: true,
      records
    });

  } catch (err) {
    console.error("History records error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load history records"
    });
  }
});

/* =========================================================
   MONTHLY / CUSTOM SUMMARY
========================================================= */
router.get("/summary", async (req, res) => {
  try {
    const { preset = "current", from, to } = req.query;

    let startDate;
    let endDate;

    if (preset === "custom" && from && to) {
      startDate = `${from} 00:00:00`;
      endDate = `${to} 23:59:59`;
    } else if (preset === "last") {
      startDate = `
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00')
      `;
      endDate = `
        DATE_FORMAT(LAST_DAY(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)), '%Y-%m-%d 23:59:59')
      `;
    } else {
      startDate = `
        DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00')
      `;
      endDate = `
        DATE_FORMAT(LAST_DAY(CURDATE()), '%Y-%m-%d 23:59:59')
      `;
    }

    const buildRangeClause = (columnName) => {
      if (preset === "custom" && from && to) {
        return `${columnName} BETWEEN ? AND ?`;
      }
      return `${columnName} BETWEEN ${startDate} AND ${endDate}`;
    };

    const logParams = preset === "custom" && from && to ? [startDate, endDate] : [];

    // Computer / Electronic items
    const [computerRows] = await db.query(`
      SELECT
        SUM(CASE WHEN al.type_id = 1 THEN 1 ELSE 0 END) AS checkIn,
        SUM(CASE WHEN al.type_id = 2 THEN 1 ELSE 0 END) AS checkOut
      FROM ACCESS_LOGS al
      JOIN ITEM_PASS ip
        ON ip.pass_id = al.item_pass_id
      JOIN ITEM i
        ON i.item_id = ip.item_id
      WHERE al.item_pass_id IS NOT NULL
        AND i.item_type = 'Electronic'
        AND ${buildRangeClause("al.log_timestamp")}
    `, logParams);

    // Non-computer / Other items
    const [otherRows] = await db.query(`
      SELECT
        SUM(CASE WHEN al.type_id = 1 THEN 1 ELSE 0 END) AS checkIn,
        SUM(CASE WHEN al.type_id = 2 THEN 1 ELSE 0 END) AS checkOut
      FROM ACCESS_LOGS al
      JOIN ITEM_PASS ip
        ON ip.pass_id = al.item_pass_id
      JOIN ITEM i
        ON i.item_id = ip.item_id
      WHERE al.item_pass_id IS NOT NULL
        AND i.item_type = 'Other'
        AND ${buildRangeClause("al.log_timestamp")}
    `, logParams);

    // Visitors
    const [visitorRows] = await db.query(`
      SELECT
        SUM(CASE WHEN al.type_id = 1 THEN 1 ELSE 0 END) AS checkIn,
        SUM(CASE WHEN al.type_id = 2 THEN 1 ELSE 0 END) AS checkOut
      FROM ACCESS_LOGS al
      WHERE al.visitor_pass_id IS NOT NULL
        AND ${buildRangeClause("al.log_timestamp")}
    `, logParams);

    const formatSummary = (row) => {
      const checkIn = Number(row?.checkIn || 0);
      const checkOut = Number(row?.checkOut || 0);
      return {
        checkIn,
        checkOut,
        netInside: checkIn - checkOut
      };
    };

    res.json({
      success: true,
      computer: formatSummary(computerRows[0]),
      nonComputer: formatSummary(otherRows[0]),
      visitors: formatSummary(visitorRows[0])
    });

  } catch (err) {
    console.error("History summary error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load history summary"
    });
  }
});

/* =========================================================
   RENEW EQUIPMENT PERMIT
   - Keeps the same QR code
   - Allowed only 2 days before expiry until expiry date
   - Extends validity by 7 days from today
========================================================= */
router.put("/equipment/:passId/renew", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { passId } = req.params;

    const {
      name,
      contactNumber,
      externalId,
      ownerType,
      department,
      itemName,
      purpose,
      itemDescription,
      computerType,
      brand,
      modelNo,
      serialNumber,
      accessories,
      processor,
      memory,
      hardDrive,
      operatingSystem,
      category,
      quantity,
      otherDescription,
      conditionNotes
    } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.query(`
      SELECT 
        ip.pass_id,
        ip.owner_id,
        ip.item_id,
        ip.validity_date,
        ip.qr_code_data,
        i.item_type
      FROM ITEM_PASS ip
      JOIN ITEM i ON i.item_id = ip.item_id
      WHERE ip.pass_id = ?
    `, [passId]);

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Equipment permit not found"
      });
    }

    const permit = rows[0];

    const [renewCheck] = await connection.query(`
      SELECT 
        CASE
          WHEN CURDATE() >= DATE_SUB(?, INTERVAL 2 DAY) THEN 1
          ELSE 0
        END AS canRenew
    `, [permit.validity_date, permit.validity_date]);

    if (!renewCheck[0].canRenew) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Permit can only be renewed starting 2 days before expiry."
      });
    }

    await connection.query(`
      UPDATE ITEM_OWNER
      SET
        external_id = ?,
        name = ?,
        contact_number = ?,
        owner_type = ?,
        department = ?
      WHERE owner_id = ?
    `, [
      externalId,
      name,
      contactNumber || null,
      ownerType,
      department || null,
      permit.owner_id
    ]);

    await connection.query(`
      UPDATE ITEM
      SET
        item_name = ?,
        purpose = ?,
        description = ?
      WHERE item_id = ?
    `, [
      itemName,
      purpose,
      itemDescription || null,
      permit.item_id
    ]);

    if (permit.item_type === "Electronic") {
      await connection.query(`
        UPDATE ELECTRONIC_ITEM
        SET
          computer_type = ?,
          brand = ?,
          model_no = ?,
          serial_number = ?,
          accessories = ?,
          processor = ?,
          memory = ?,
          hard_drive = ?,
          operating_system = ?
        WHERE item_id = ?
      `, [
        computerType || "",
        brand || "",
        modelNo || null,
        serialNumber || "",
        accessories || null,
        processor || null,
        memory || null,
        hardDrive || null,
        operatingSystem || null,
        permit.item_id
      ]);
    }

    if (permit.item_type === "Other") {
      await connection.query(`
        UPDATE OTHER_ITEM
        SET
          category = ?,
          quantity = ?,
          description = ?,
          condition_notes = ?
        WHERE item_id = ?
      `, [
        category || "",
        quantity || 1,
        otherDescription || itemName || "",
        conditionNotes || null,
        permit.item_id
      ]);
    }

    await connection.query(`
      UPDATE ITEM_PASS
      SET
        validity_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY),
        approval_status = 'ACTIVE',
        approved_at = NOW()
      WHERE pass_id = ?
    `, [passId]);

    await connection.commit();

    res.json({
      success: true,
      message: "Permit renewed successfully."
    });

  } catch (err) {
    await connection.rollback();
    console.error("Renew permit error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to renew permit"
    });
  } finally {
    connection.release();
  }
});

module.exports = router;