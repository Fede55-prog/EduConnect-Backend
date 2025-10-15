// backend/routes/messages.js
const express = require("express");
const pool = require("../db");
const verifyToken = require("../middleware/authMiddleware");

const router = express.Router();

let ioInstance;
function setSocket(io) {
  ioInstance = io;
}

/**
 * Start a new conversation or return existing one
 */
router.post("/start", verifyToken, async (req, res) => {
  const { recipientId } = req.body;
  const senderId = req.user.id;

  if (!recipientId) {
    return res
      .status(400)
      .json({ success: false, message: "Recipient ID required" });
  }

  try {
    // Check if a conversation already exists between the two users
    const existing = await pool.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants p1 ON c.id = p1.conversation_id
       JOIN conversation_participants p2 ON c.id = p2.conversation_id
       WHERE p1.student_id = $1 AND p2.student_id = $2`,
      [senderId, recipientId]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        conversationId: existing.rows[0].id,
      });
    }

    // Otherwise, create new conversation
    const convo = await pool.query(
      "INSERT INTO conversations DEFAULT VALUES RETURNING id"
    );
    const convoId = convo.rows[0].id;

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, student_id)
       VALUES ($1, $2), ($1, $3)`,
      [convoId, senderId, recipientId]
    );

    res.json({ success: true, conversationId: convoId });
  } catch (err) {
    console.error("Start conversation error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 *  Get all conversations for current user
 */
router.get("/my", verifyToken, async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT c.id AS conversation_id,
              c.created_at,
              json_agg(
                json_build_object(
                  'id', s.stu_id,
                  'first_name', s.first_name,
                  'last_name', s.last_name,
                  'email', s.stu_email,
                  'avatar', s.avatar
                )
              ) FILTER (WHERE s.stu_id IS NOT NULL AND s.stu_id <> $1) AS participants
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       JOIN student s ON cp.student_id = s.stu_id
       WHERE c.id IN (
         SELECT conversation_id
         FROM conversation_participants
         WHERE student_id = $1
       )
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [studentId]
    );

    res.json({ success: true, conversations: result.rows });
  } catch (err) {
    console.error("Fetch conversations error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 *  Send a message in a conversation
 */
router.post("/:conversationId/message", verifyToken, async (req, res) => {
  const { conversationId } = req.params;
  const { content } = req.body;
  const senderId = req.user.id;

  if (!content || !content.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Message cannot be empty" });
  }

  try {
    const msg = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, content, created_at`,
      [conversationId, senderId, content]
    );

    const message = msg.rows[0];

    // Emit to all users in that conversation via Socket.IO
    if (ioInstance) {
      ioInstance
        .to(`conversation_${conversationId}`)
        .emit("receive_message", message);
    }

    res.json({ success: true, message });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 *  Get all messages in a specific conversation
 */
router.get("/:conversationId/messages", verifyToken, async (req, res) => {
  const { conversationId } = req.params;

  try {
    const msgs = await pool.query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at,
              s.first_name, s.last_name, s.avatar
       FROM messages m
       JOIN student s ON m.sender_id = s.stu_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    res.json({ success: true, messages: msgs.rows });
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = { router, setSocket };




