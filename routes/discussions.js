// routes/discussions.js
const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const { checkDiscussionContent } = require("../utils/aiModeration");

const router = express.Router();

/**
 * ============================
 *  GET ALL POSTS (module-aware)
 *  - requires auth to know viewer
 *  - shows posts where:
 *      * post.module_id IN (viewer subscribed ∪ enrolled)
 *      * plus optional general posts (module_id IS NULL) when include_general=true (default)
 *  Query params:
 *    page, limit, category, search, sort, include_general
 * ============================
 */
router.get("/posts", authMiddleware, async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    search,
    sort = "created_at",
    include_general = "true",
  } = req.query;

  // coerce to numbers safely
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(Math.min(parseInt(limit, 10) || 10, 100), 1);
  const offset = (pageNum - 1) * limitNum;

  // allowlist sort columns to avoid SQL injection on ORDER BY
  const SORT_MAP = new Set(["created_at", "likes", "views", "title", "category"]);
  const sortCol = SORT_MAP.has(String(sort)) ? sort : "created_at";

  try {
    // 1) find module_ids the viewer can see (subscriptions ∪ enrolled)
    const modsRes = await pool.query(
      `
      SELECT module_id FROM student_subscriptions WHERE student_id=$1
      UNION
      SELECT module_id FROM student_modules WHERE student_id=$1
      `,
      [req.user.id]
    );
    const allowedModuleIds = modsRes.rows.map((r) => r.module_id);

    // 2) build query
    let query = `
      SELECT d.id, d.title, d.content, d.category, d.created_at, d.likes, d.views, d.student_id, d.module_id,
             s.first_name AS author_first_name,
             s.last_name  AS author_last_name,
             s.avatar     AS author_avatar,
             m.name       AS module_name,
             m.code       AS module_code
      FROM discussions d
      LEFT JOIN student s ON d.student_id = s.stu_id
      LEFT JOIN modules m ON d.module_id = m.id
    `;

    const conditions = [];
    const values = [];

    // module visibility condition
    if (allowedModuleIds.length > 0) {
      const ph = allowedModuleIds.map((_, i) => `$${values.length + i + 1}`).join(",");
      values.push(...allowedModuleIds);
      if (String(include_general) === "true") {
        conditions.push(`(d.module_id IS NULL OR d.module_id IN (${ph}))`);
      } else {
        conditions.push(`d.module_id IN (${ph})`);
      }
    } else {
      // viewer has no modules; optionally show only general posts
      if (String(include_general) === "true") {
        conditions.push(`d.module_id IS NULL`);
      } else {
        // show nothing
        conditions.push(`1=0`);
      }
    }

    if (category) {
      conditions.push(`d.category = $${values.length + 1}`);
      values.push(category);
    }

    if (search) {
      conditions.push(
        `(d.title ILIKE $${values.length + 1} OR d.content ILIKE $${values.length + 1})`
      );
      values.push(`%${search}%`);
    }

    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += ` ORDER BY d.${sortCol} DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limitNum, offset);

    const result = await pool.query(query, values);

    const posts = result.rows.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      created_at: p.created_at,
      likes: p.likes || 0,
      views: p.views || 0,
      student_id: p.student_id,
      module: p.module_id
        ? { id: p.module_id, name: p.module_name, code: p.module_code }
        : null,
      author: {
        id: p.student_id,
        first_name: p.author_first_name || "Unknown",
        last_name: p.author_last_name || "",
        avatar: p.author_avatar || null,
      },
    }));

    return res.json({ success: true, posts });
  } catch (err) {
    console.error("Fetch posts error:", err);
    return res.status(500).json({ success: false, message: "Error fetching posts" });
  }
});

/**
 * ===============================================
 *  GET SINGLE POST (with comments) + module info
 * ===============================================
 */
router.get("/posts/:id", async (req, res) => {
  try {
    const postRes = await pool.query(
      `
      SELECT d.id, d.title, d.content, d.category, d.created_at, d.likes, d.views, d.student_id, d.module_id,
             s.first_name AS author_first_name,
             s.last_name  AS author_last_name,
             s.avatar     AS author_avatar,
             m.name       AS module_name,
             m.code       AS module_code
      FROM discussions d
      LEFT JOIN student s ON d.student_id = s.stu_id
      LEFT JOIN modules m ON d.module_id = m.id
      WHERE d.id = $1
      `,
      [req.params.id]
    );

    if (postRes.rowCount === 0)
      return res.status(404).json({ success: false, message: "Post not found" });

    await pool.query(`UPDATE discussions SET views = views + 1 WHERE id = $1`, [req.params.id]);

    const p = postRes.rows[0];
    const post = {
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      created_at: p.created_at,
      likes: p.likes || 0,
      views: p.views || 0,
      module: p.module_id ? { id: p.module_id, name: p.module_name, code: p.module_code } : null,
      author: {
        id: p.student_id,
        first_name: p.author_first_name || "Unknown",
        last_name: p.author_last_name || "",
        avatar: p.author_avatar || null,
      },
    };

    const commentsRes = await pool.query(
      `
      SELECT c.id, c.content, c.created_at,
             s.first_name AS commenter_first_name,
             s.last_name  AS commenter_last_name,
             s.avatar     AS commenter_avatar
      FROM comments c
      LEFT JOIN student s ON c.student_id = s.stu_id
      WHERE c.discussion_id = $1
      ORDER BY c.created_at ASC
      `,
      [req.params.id]
    );

    const comments = commentsRes.rows.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      commenter: {
        first_name: c.commenter_first_name || "Unknown",
        last_name: c.commenter_last_name || "",
        avatar: c.commenter_avatar || null,
      },
    }));

    return res.json({ success: true, post, comments });
  } catch (err) {
    console.error("Get single post error:", err);
    return res.status(500).json({ success: false, message: "Error fetching post" });
  }
});

/**
 * ======================================================
 *  CREATE NEW POST (AI moderation + module tag + notify)
 *  Body: { title, content, category, student_id, module_id? }
 * ======================================================
 */
router.post("/posts", async (req, res) => {
  const { title, content, category, student_id, module_id } = req.body;
  if (!title || !content || !student_id)
    return res.status(400).json({ success: false, message: "Missing required fields" });

  try {
    const moderation = await checkDiscussionContent(content);
    if (!moderation.allowed)
      return res.status(400).json({
        success: false,
        message: "Post rejected by moderation",
        categories: moderation.categories,
      });

    const insert = await pool.query(
      `INSERT INTO discussions (title, content, category, student_id, module_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, content, category || "General", student_id, module_id || null]
    );

    const post = insert.rows[0];

    const authorQuery = await pool.query(
      `SELECT first_name, last_name, avatar FROM student WHERE stu_id = $1`,
      [student_id]
    );
    const author = authorQuery.rows[0] || { first_name: "Unknown", last_name: "", avatar: null };

    // pull module info (if any) to include in response
    let mod = null;
    if (post.module_id) {
      const m = await pool.query(`SELECT id, name, code FROM modules WHERE id=$1`, [post.module_id]);
      mod = m.rows[0] || null;
    }

    const notif = await pool.query(
      `INSERT INTO notifications (type, ref_id, message)
       VALUES ($1, $2, $3) RETURNING *`,
      [
        "discussion",
        post.id,
        `📝 ${author.first_name} ${author.last_name} created a new post: ${post.title}`,
      ]
    );

    if (req.io) {
      req.io.emit("new_notification", {
        id: notif.rows[0].id,
        type: "discussion",
        message: notif.rows[0].message,
        created_at: notif.rows[0].created_at,
        read: false,
      });
    }

    return res.json({
      success: true,
      post: {
        ...post,
        module: mod,
        author,
      },
    });
  } catch (err) {
    console.error("Create post error:", err);
    return res.status(500).json({ success: false, message: "Error creating post" });
  }
});

/**
 * ===============================================
 *  ADD COMMENT (with notification)
 * ===============================================
 */
router.post("/posts/:id/comments", async (req, res) => {
  const { content, student_id } = req.body;
  if (!content || !student_id)
    return res.status(400).json({ success: false, message: "Missing required fields" });

  try {
    const insert = await pool.query(
      `INSERT INTO comments (discussion_id, student_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, student_id, content]
    );

    const comment = insert.rows[0];

    const commenterQuery = await pool.query(
      `SELECT first_name, last_name, avatar FROM student WHERE stu_id = $1`,
      [student_id]
    );
    const commenter = commenterQuery.rows[0] || { first_name: "Unknown", last_name: "", avatar: null };

    const notif = await pool.query(
      `INSERT INTO notifications (type, ref_id, message)
       VALUES ($1, $2, $3) RETURNING *`,
      ["comment", req.params.id, `💬 ${commenter.first_name} ${commenter.last_name} commented on a post`]
    );

    if (req.io) {
      req.io.emit("new_notification", {
        id: notif.rows[0].id,
        type: "comment",
        message: notif.rows[0].message,
        created_at: notif.rows[0].created_at,
        read: false,
      });
    }

    return res.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        commenter,
      },
    });
  } catch (err) {
    console.error("Add comment error:", err);
    return res.status(500).json({ success: false, message: "Error adding comment" });
  }
});

/**
 * ===============================================
 *  LIKE / UNLIKE POST (with notification)
 * ===============================================
 */
router.post("/posts/:id/like", async (req, res) => {
  const { student_id } = req.body;
  if (!student_id)
    return res.status(400).json({ success: false, message: "Missing student_id" });

  try {
    const check = await pool.query(
      `SELECT * FROM discussion_likes WHERE discussion_id=$1 AND student_id=$2`,
      [req.params.id, student_id]
    );

    if (check.rowCount > 0) {
      await pool.query(
        `DELETE FROM discussion_likes WHERE discussion_id=$1 AND student_id=$2`,
        [req.params.id, student_id]
      );
      await pool.query(`UPDATE discussions SET likes = GREATEST(likes - 1, 0) WHERE id=$1`, [
        req.params.id,
      ]);
      return res.json({ success: true, liked: false });
    } else {
      await pool.query(
        `INSERT INTO discussion_likes (discussion_id, student_id) VALUES ($1, $2)`,
        [req.params.id, student_id]
      );
      await pool.query(`UPDATE discussions SET likes = likes + 1 WHERE id=$1`, [req.params.id]);

      const liker = await pool.query(
        `SELECT first_name, last_name FROM student WHERE stu_id=$1`,
        [student_id]
      );

      const likerName = liker.rows.length
        ? `${liker.rows[0].first_name} ${liker.rows[0].last_name}`
        : "Someone";

      const notif = await pool.query(
        `INSERT INTO notifications (type, ref_id, message)
         VALUES ($1, $2, $3) RETURNING *`,
        ["like", req.params.id, `👍 ${likerName} liked your post`]
      );

      if (req.io) {
        req.io.emit("new_notification", {
          id: notif.rows[0].id,
          type: "like",
          message: notif.rows[0].message,
          created_at: notif.rows[0].created_at,
          read: false,
        });
      }

      return res.json({ success: true, liked: true });
    }
  } catch (err) {
    console.error("Like post error:", err);
    return res.status(500).json({ success: false, message: "Error liking post" });
  }
});

/**
 * ===============================================
 *  TRENDING POSTS
 * ===============================================
 */
router.get("/trending", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.id, d.title, d.views, d.likes,
             s.first_name AS author_first_name,
             s.last_name  AS author_last_name,
             s.avatar     AS author_avatar
      FROM discussions d
      LEFT JOIN student s ON d.student_id = s.stu_id
      ORDER BY (d.views + d.likes) DESC
      LIMIT 5
    `);

    const trending = r.rows.map((t) => ({
      id: t.id,
      title: t.title,
      views: t.views,
      likes: t.likes,
      author: {
        first_name: t.author_first_name,
        last_name: t.author_last_name,
        avatar: t.author_avatar,
      },
    }));

    if (req.io) req.io.emit("trending_update", trending);

    return res.json({ success: true, trending });
  } catch (err) {
    console.error("Trending error:", err);
    return res.status(500).json({ success: false, message: "Error fetching trending topics" });
  }
});

/**
 * ===============================================
 *  TAGS / STATISTICS
 * ===============================================
 */
router.get("/tags", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT category AS tag, COUNT(*) AS count
      FROM discussions
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `);
    return res.json({ success: true, tags: r.rows });
  } catch (err) {
    console.error("Tags error:", err);
    return res.status(500).json({ success: false, message: "Error fetching tags" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const totalPosts = await pool.query(`SELECT COUNT(*) FROM discussions`);
    const totalComments = await pool.query(`SELECT COUNT(*) FROM comments`);
    const totalViews = await pool.query(`SELECT COALESCE(SUM(views),0) AS sum FROM discussions`);
    const totalLikes = await pool.query(`SELECT COALESCE(SUM(likes),0) AS sum FROM discussions`);

    return res.json({
      success: true,
      stats: {
        posts: parseInt(totalPosts.rows[0].count, 10),
        comments: parseInt(totalComments.rows[0].count, 10),
        views: parseInt(totalViews.rows[0].sum || 0, 10),
        likes: parseInt(totalLikes.rows[0].sum || 0, 10),
      },
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ success: false, message: "Error fetching stats" });
  }
});

module.exports = router;
