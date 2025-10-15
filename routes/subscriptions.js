// routes/subscriptions.js
const express = require("express");
const pool = require("../db");
const router = express.Router();

/**
 * Subscribe to ANY module (cross-enroll allowed).
 * We only verify the module exists; we no longer require it to be in the student's course.
 */
router.post("/", async (req, res) => {
  const studentId = parseInt(req.body.student_id || req.body.studentId, 10);
  const moduleId = parseInt(req.body.module_id || req.body.moduleId, 10);

  if (isNaN(studentId) || isNaN(moduleId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid student or module ID (must be numeric)",
    });
  }

  try {
    // ✅ Ensure the module exists (but don't enforce course matching)
    const mod = await pool.query(`SELECT id, name, code FROM modules WHERE id = $1`, [moduleId]);
    if (mod.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Module not found" });
    }

    // ✅ Insert subscription safely (duplicates ignored)
    const r = await pool.query(
      `INSERT INTO student_subscriptions (student_id, module_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id, module_id) DO NOTHING
       RETURNING *`,
      [studentId, moduleId]
    );

    if (r.rows.length === 0) {
      return res.json({ success: false, message: "Already subscribed" });
    }

    return res.json({ success: true, subscription: r.rows[0] });
  } catch (err) {
    console.error("Subscribe error:", err);
    return res.status(500).json({ success: false, message: "Error subscribing" });
  }
});

/**
 * Get subscriptions for a student
 */
router.get("/:studentId", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ss.id, m.name AS module_name, m.code, ss.created_at
       FROM student_subscriptions ss
       JOIN modules m ON ss.module_id = m.id
       WHERE ss.student_id = $1
       ORDER BY ss.created_at DESC`,
      [req.params.studentId]
    );
    return res.json({ success: true, subscriptions: r.rows });
  } catch (err) {
    console.error("Fetch subscriptions error:", err);
    return res.status(500).json({ success: false, message: "Error fetching subscriptions" });
  }
});

/**
 * Unsubscribe
 */
router.delete("/:id", async (req, res) => {
  try {
    const r = await pool.query(
      "DELETE FROM student_subscriptions WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }
    return res.json({ success: true, message: "Unsubscribed successfully" });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return res.status(500).json({ success: false, message: "Error unsubscribing" });
  }
});

module.exports = router;

