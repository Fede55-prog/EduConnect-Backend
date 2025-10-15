const express = require("express");
const pool = require("../db");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * GET /api/users/me
 * Get current logged-in user profile
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT stu_id AS "id",
              stu_number AS "studentNumber",
              stu_email AS "email",
              first_name AS "firstName",
              last_name AS "lastName",
              year_of_study AS "yearOfStudy",
              department_id AS "departmentId",
              bio,
              registration_status AS "registrationStatus",
              avatar,
              registered_courses AS "registeredCourses",
              is_active AS "isActive"
       FROM student WHERE stu_id=$1`,
      [req.user.id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json(r.rows[0]);
  } catch (err) {
    console.error("Get current user error:", err);
    return res.status(500).json({ success: false, message: "Error fetching profile" });
  }
});

/**
 * PUT /api/users/profile
 * Update current user profile
 */
router.put("/profile", authMiddleware, async (req, res) => {
  const { firstName, lastName, yearOfStudy, departmentId, bio } = req.body;

  try {
    const r = await pool.query(
      `UPDATE student
       SET first_name=$1,
           last_name=$2,
           year_of_study=$3,
           department_id=$4,
           bio=$5
       WHERE stu_id=$6
       RETURNING stu_id AS "id",
                 stu_number AS "studentNumber",
                 stu_email AS "email",
                 first_name AS "firstName",
                 last_name AS "lastName",
                 year_of_study AS "yearOfStudy",
                 department_id AS "departmentId",
                 bio,
                 registration_status AS "registrationStatus",
                 avatar,
                 registered_courses AS "registeredCourses",
                 is_active AS "isActive"`,
      [firstName, lastName, yearOfStudy, departmentId, bio, req.user.id]
    );

    return res.json(r.rows[0]);
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ success: false, message: "Error updating profile" });
  }
});

/**
 * PUT /api/users/change-password
 */
router.put("/change-password", authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    const r = await pool.query(
      `SELECT stu_password FROM student WHERE stu_id=$1`,
      [req.user.id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const valid = await bcrypt.compare(oldPassword, r.rows[0].stu_password);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Old password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE student SET stu_password=$1 WHERE stu_id=$2`,
      [hashed, req.user.id]
    );

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ success: false, message: "Error changing password" });
  }
});

/**
 * GET /api/users/search?query=...
 * Search users by name, number, or email
 */
router.get("/search", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ success: false, message: "Query is required" });
  }

  try {
    const r = await pool.query(
      `SELECT stu_id AS "id",
              stu_number AS "studentNumber",
              stu_email AS "email",
              first_name AS "firstName",
              last_name AS "lastName",
              year_of_study AS "yearOfStudy",
              department_id AS "departmentId",
              bio,
              registration_status AS "registrationStatus",
              avatar,
              registered_courses AS "registeredCourses",
              is_active AS "isActive"
       FROM student
       WHERE first_name ILIKE $1
          OR last_name ILIKE $1
          OR stu_number ILIKE $1
          OR stu_email ILIKE $1`,
      [`%${query}%`]
    );

    return res.json(r.rows);
  } catch (err) {
    console.error("Search users error:", err);
    return res.status(500).json({ success: false, message: "Error searching users" });
  }
});

/**
 * GET /api/users
 * Get all users
 */
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT stu_id AS "id",
              stu_number AS "studentNumber",
              stu_email AS "email",
              first_name AS "firstName",
              last_name AS "lastName",
              year_of_study AS "yearOfStudy",
              department_id AS "departmentId",
              bio,
              registration_status AS "registrationStatus",
              avatar,
              registered_courses AS "registeredCourses",
              is_active AS "isActive"
       FROM student`
    );

    return res.json(r.rows);
  } catch (err) {
    console.error("Get all users error:", err);
    return res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

/**
 * GET /api/users/:id
 * Get another user’s profile by ID
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const r = await pool.query(
      `SELECT stu_id AS "id",
              stu_number AS "studentNumber",
              stu_email AS "email",
              first_name AS "firstName",
              last_name AS "lastName",
              year_of_study AS "yearOfStudy",
              department_id AS "departmentId",
              bio,
              registration_status AS "registrationStatus",
              avatar,
              registered_courses AS "registeredCourses",
              is_active AS "isActive"
       FROM student WHERE stu_id=$1`,
      [id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json(r.rows[0]);
  } catch (err) {
    console.error("Get user by ID error:", err);
    return res.status(500).json({ success: false, message: "Error fetching user" });
  }
});

module.exports = router;



