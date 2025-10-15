// backend/routes/modules.js
const express = require("express");
const pool = require("../db");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, name, code, course_id FROM modules ORDER BY id ASC"
    );
    res.json({ success: true, modules: r.rows });
  } catch (err) {
    console.error("Error fetching modules:", err);
    res.status(500).json({ success: false, message: "Error fetching modules" });
  }
});

module.exports = router;

module.exports = router;
