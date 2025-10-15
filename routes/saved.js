// backend/routes/saved.js
const express = require("express");
const pool = require("../db");
const verifyToken = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * 🔹 Debug route - optional
 */
router.get("/", (req, res) => {
  res.json({ success: true, message: "Saved route working!" });
});

/**
 * 🔹 Get all saved posts for current user
 */
router.get("/my", verifyToken, async (req, res) => {
  const studentId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT d.id, d.title, d.content, d.category, d.created_at, 
              s.id AS save_id
       FROM student_saved_posts s
       JOIN discussions d ON s.discussion_id = d.id
       WHERE s.student_id = $1
       ORDER BY s.created_at DESC`,
      [studentId]
    );
    res.json({ success: true, saved_posts: result.rows });
  } catch (err) {
    console.error("Error fetching saved posts:", err);
    res.status(500).json({ success: false, message: "Error fetching saved posts" });
  }
});

/**
 * 🔹 Toggle save/unsave
 */
router.post("/toggle", verifyToken, async (req, res) => {
  const studentId = req.user.id;
  const { discussion_id } = req.body;

  if (!discussion_id) {
    return res.status(400).json({ success: false, message: "Missing discussion_id" });
  }

  try {
    const postExists = await pool.query("SELECT id FROM discussions WHERE id=$1", [discussion_id]);
    if (postExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const exists = await pool.query(
      "SELECT id FROM student_saved_posts WHERE student_id=$1 AND discussion_id=$2",
      [studentId, discussion_id]
    );

    if (exists.rows.length > 0) {
      await pool.query(
        "DELETE FROM student_saved_posts WHERE student_id=$1 AND discussion_id=$2",
        [studentId, discussion_id]
      );
      return res.json({ success: true, saved: false });
    }

    await pool.query(
      "INSERT INTO student_saved_posts (student_id, discussion_id) VALUES ($1, $2)",
      [studentId, discussion_id]
    );

    res.json({ success: true, saved: true });
  } catch (err) {
    console.error("Save toggle error:", err);
    res.status(500).json({ success: false, message: "Error saving post" });
  }
});

module.exports = router;
