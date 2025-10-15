const express = require("express");
const pool = require("../db");

const router = express.Router();

/**
 * GET /api/departments
 */
router.get("/", async (req, res) => {
  try {
    const r = await pool.query("SELECT id, name FROM departments ORDER BY name ASC");
    return res.json(r.rows);
  } catch (err) {
    console.error("Get departments error:", err);
    return res.status(500).json({ success: false, message: "Error fetching departments" });
  }
});

module.exports = router;
