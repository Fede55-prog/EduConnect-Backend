const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * ACTIVATE ACCOUNT
 */
router.post("/activate", async (req, res) => {
  const student_number = req.body.student_number || req.body.studentNumber;
  const email = req.body.email;
  const password = req.body.password;

  if (!student_number || !email || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM student WHERE stu_number=$1 AND stu_email=$2",
      [student_number, email]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Student not found" });

    const student = result.rows[0];
    if (student.is_active)
      return res.status(400).json({ success: false, message: "Account already activated" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE student SET stu_password=$1, is_active=TRUE WHERE stu_number=$2",
      [hashedPassword, student_number]
    );

    res.json({ success: true, message: "Account activated successfully" });
  } catch (err) {
    console.error("Activation error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * LOGIN
 */
router.post("/login", async (req, res) => {
  const studentNumber = req.body.studentNumber || req.body.student_number;
  const password = req.body.password;

  if (!studentNumber || !password)
    return res.status(400).json({ success: false, message: "Missing fields" });

  try {
    const r = await pool.query("SELECT * FROM student WHERE stu_number=$1", [studentNumber]);
    if (r.rows.length === 0)
      return res.status(404).json({ success: false, message: "Student not found" });

    const student = r.rows[0];
    if (!student.is_active)
      return res.status(403).json({ success: false, message: "Activate your account first" });

    const ok = await bcrypt.compare(password, student.stu_password);
    if (!ok)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { id: student.stu_id, studentNumber: student.stu_number, email: student.stu_email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // ✅ Set cookie for server-based session
    res.cookie("peerconnect_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: student.stu_id,
        studentNumber: student.stu_number,
        email: student.stu_email,
        first_name: student.first_name,
        last_name: student.last_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

/**
 * LOGOUT
 * Clears cookie and redirects user to login page
 */
router.post("/logout", (req, res) => {
  try {
    // Clear auth cookie
    res.clearCookie("peerconnect_auth", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    });

    console.log("User logged out, redirecting to login...");
    return res.status(200).json({
      success: true,
      message: "Logged out successfully. Redirecting to login...",
      redirect: "http://localhost:3000/log-in.html"
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
});


/**
 * FORGOT PASSWORD
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email required" });

  try {
    const r = await pool.query("SELECT stu_id, is_active FROM student WHERE stu_email=$1", [email]);
    if (r.rows.length === 0)
      return res.json({ success: false, message: "Email not registered" });

    const student = r.rows[0];
    if (!student.is_active)
      return res.status(403).json({ success: false, message: "Activate your account first" });

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "15m" });

    await pool.query(
      "UPDATE student SET reset_token=$1, reset_token_expiry=NOW()+INTERVAL '15 minutes' WHERE stu_email=$2",
      [resetToken, email]
    );

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: `"PeerConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset - PeerConnect",
      html: `<p>Click to reset your password:</p><a href="${resetLink}">${resetLink}</a>`,
    });

    res.json({ success: true, message: "Password reset email sent successfully" });
  } catch (err) {
    console.error("Forgot-password error:", err);
    res.status(500).json({ success: false, message: "Error sending reset email" });
  }
});

/**
 * RESET PASSWORD
 */
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword)
    return res.status(400).json({ success: false, message: "New password required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const r = await pool.query(
      "SELECT stu_id FROM student WHERE stu_email=$1 AND reset_token=$2 AND reset_token_expiry > NOW()",
      [email, token]
    );

    if (r.rows.length === 0)
      return res.status(400).json({ success: false, message: "Invalid or expired token" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE student SET stu_password=$1, reset_token=NULL, reset_token_expiry=NULL WHERE stu_email=$2",
      [hashed, email]
    );

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset-password error:", err);
    res.status(400).json({ success: false, message: "Invalid or expired token" });
  }
});

/**
 * VALIDATE TOKEN
 */
router.get("/validate", authMiddleware, (req, res) => {
  return res.json({ success: true, user: req.user });
});

module.exports = router;


