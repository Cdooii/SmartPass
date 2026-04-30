const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/* =========================
   ADMIN REGISTER
========================= */
router.post("/register", async (req, res) => {
  const { username, password, name, id_number } = req.body;

  if (!username || !password || !name || !id_number) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const [existing] = await db.query(
      "SELECT * FROM STAFF WHERE username = ? OR id_number = ?",
      [username, id_number]
    );

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ message: "Username or ID number already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO STAFF (username, password, name, id_number, staff_role)
       VALUES (?, ?, ?, ?, 'Admin')`,
      [username, hashedPassword, name, id_number]
    );

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   ADMIN LOGIN
========================= */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM STAFF WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        staff_id: user.staff_id,
        role: user.staff_role
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      message: "Login successful",
      token,
      staff: {
        staff_id: user.staff_id,
        id_number: user.id_number,
        name: user.name,
        role: user.staff_role,
        username: user.username
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================
   GET LOGGED-IN PROFILE
========================================= */
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT staff_id, id_number, name, username, staff_role
       FROM STAFF
       WHERE staff_id = ?`,
      [req.user.staff_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================
   UPDATE PROFILE
========================================= */
router.put("/profile", authMiddleware, async (req, res) => {
  const { name, username, password } = req.body;
  const staffId = req.user.staff_id;

  try {
    const [existing] = await db.query(
      "SELECT * FROM STAFF WHERE staff_id = ?",
      [staffId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    let updateQuery = `
      UPDATE STAFF
      SET name = ?, username = ?
    `;

    const values = [name, username];

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += `, password = ?`;
      values.push(hashedPassword);
    }

    updateQuery += ` WHERE staff_id = ?`;
    values.push(staffId);

    await db.query(updateQuery, values);

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================
   DELETE ACCOUNT
========================================= */
router.delete("/profile", authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.staff_id;

    const [check] = await db.query(
      "SELECT * FROM STAFF WHERE staff_id = ?",
      [staffId]
    );

    if (check.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await db.query(
      "DELETE FROM STAFF WHERE staff_id = ?",
      [staffId]
    );

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;