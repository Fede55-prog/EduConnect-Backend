const express = require("express");
const pool = require("../db");

const router = express.Router();

/**
 * GET /api/notifications
 * Get all notifications (includes author/actor details)
 * NOTE: We alias is_read -> read so the client can rely on `read`.
 */
router.get("/", async (_req, res) => {
  try {
    const q = `
      SELECT
        n.id,
        n.type,
        n.ref_id,
        n.message,
        n.created_at,
        n.is_read AS read,
        s.first_name,
        s.last_name,
        s.avatar
      FROM notifications n
      LEFT JOIN discussions d ON (n.type = 'discussion' AND n.ref_id = d.id)
      LEFT JOIN comments    c ON (n.type = 'comment'    AND n.ref_id = c.id)
      LEFT JOIN discussion_likes l ON (n.type = 'like' AND n.ref_id = l.discussion_id)
      LEFT JOIN student s ON (
        (n.type = 'discussion' AND d.student_id = s.stu_id) OR
        (n.type = 'comment'    AND c.student_id = s.stu_id) OR
        (n.type = 'like'       AND l.student_id = s.stu_id)
      )
      ORDER BY n.created_at DESC
    `;

    const result = await pool.query(q);
    return res.json({ success: true, notifications: result.rows });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return res.status(500).json({ success: false, message: "Error fetching notifications" });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
router.put("/:id/read", async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING id, is_read AS read`,
      [req.params.id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, notification: r.rows[0] });
  } catch (err) {
    console.error("Error marking notification read:", err);
    return res.status(500).json({ success: false, message: "Error updating notification" });
  }
});

/**
 * PUT /api/notifications/:id/unread
 * Mark a single notification as unread
 */
router.put("/:id/unread", async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE notifications SET is_read = FALSE WHERE id = $1 RETURNING id, is_read AS read`,
      [req.params.id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, notification: r.rows[0] });
  } catch (err) {
    console.error("Error marking notification unread:", err);
    return res.status(500).json({ success: false, message: "Error updating notification" });
  }
});

/**
 * PUT /api/notifications/read-all
 * (Optional) Mark all notifications as read
 */
router.put("/read-all", async (_req, res) => {
  try {
    const r = await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE RETURNING id`
    );
    return res.json({ success: true, count: r.rowCount });
  } catch (err) {
    console.error("Error marking all notifications read:", err);
    return res.status(500).json({ success: false, message: "Error updating notifications" });
  }
});

module.exports = router;
