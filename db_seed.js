// backend/db_seed.js
const pool = require("./db");

async function seedDatabase() {
  try {
    console.log(" Seeding database...");

    // === Departments ===
    const departments = [
      "Computer Science",
      "Information Systems",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Economics",
      "Business Management"
    ];

    for (const dept of departments) {
      await pool.query(
        `INSERT INTO departments (name)
         VALUES ($1)
         ON CONFLICT (name) DO NOTHING`,
        [dept]
      );
    }
    console.log(" Departments seeded");

    // === Courses ===
    const courses = [
      { name: "BSc Computer Science", dept: "Computer Science" },
      { name: "BCom Information Systems", dept: "Information Systems" },
      { name: "BSc Applied Mathematics", dept: "Mathematics" },
      { name: "BSc Physics", dept: "Physics" },
      { name: "BSc Chemistry", dept: "Chemistry" },
      { name: "BCom Economics", dept: "Economics" },
      { name: "BCom Business Management", dept: "Business Management" },
    ];

    for (const c of courses) {
      const deptRes = await pool.query(`SELECT id FROM departments WHERE name=$1`, [c.dept]);
      if (deptRes.rows.length > 0) {
        await pool.query(
          `INSERT INTO courses (name, department_id)
           VALUES ($1,$2)
           ON CONFLICT (name) DO NOTHING`,
          [c.name, deptRes.rows[0].id]
        );
      }
    }
    console.log("Courses seeded");

    // === Modules ===
    const modules = [
      { code: "CS101", name: "Introduction to Programming", course: "BSc Computer Science" },
      { code: "CS201", name: "Data Structures & Algorithms", course: "BSc Computer Science" },
      { code: "IS101", name: "Information Systems Fundamentals", course: "BCom Information Systems" },
      { code: "MATH101", name: "Calculus I", course: "BSc Applied Mathematics" },
      { code: "PHYS101", name: "Classical Mechanics", course: "BSc Physics" },
      { code: "CHEM101", name: "General Chemistry", course: "BSc Chemistry" },
      { code: "ECON101", name: "Microeconomics", course: "BCom Economics" },
      { code: "BUS101", name: "Principles of Management", course: "BCom Business Management" },
    ];

    for (const m of modules) {
      const courseRes = await pool.query(`SELECT id FROM courses WHERE name=$1`, [m.course]);
      if (courseRes.rows.length > 0) {
        await pool.query(
          `INSERT INTO modules (code, name, course_id)
           VALUES ($1,$2,$3)
           ON CONFLICT (code) DO NOTHING`,
          [m.code, m.name, courseRes.rows[0].id]
        );
      }
    }
    console.log(" Modules seeded");

    console.log(" Database seeding completed!");
    process.exit(0);
  } catch (err) {
    console.error(" Seeding error:", err);
    process.exit(1);
  }
}

seedDatabase();
