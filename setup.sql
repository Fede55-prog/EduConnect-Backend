-- ================================
-- STUDENT
-- ================================
CREATE TABLE IF NOT EXISTS student (
  stu_id SERIAL PRIMARY KEY,
  stu_number VARCHAR(20) UNIQUE NOT NULL,
  stu_email VARCHAR(100) UNIQUE NOT NULL,
  stu_password VARCHAR(255),
  stu_fname VARCHAR(100),
  stu_lname VARCHAR(100),
  year_of_study INTEGER,
  registered_courses TEXT[],
  course_id INT REFERENCES courses(id) ON DELETE SET NULL,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  is_active BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_number ON student(stu_number);
CREATE INDEX IF NOT EXISTS idx_student_email ON student(stu_email);
CREATE INDEX IF NOT EXISTS idx_student_course ON student(course_id);

-- ================================
-- COURSES & MODULES
-- ================================
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department_id INT
);

CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE
);

-- ================================
-- STUDENT SUBSCRIPTIONS
-- ================================
CREATE TABLE IF NOT EXISTS student_subscriptions (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  module_id INT REFERENCES modules(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, module_id)
);

-- ================================
-- DISCUSSIONS
-- ================================
CREATE TABLE IF NOT EXISTS discussions (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE, -- 👈 link post to student
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category);
CREATE INDEX IF NOT EXISTS idx_discussions_views ON discussions(views DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_likes ON discussions(likes DESC);

-- ================================
-- COMMENTS
-- ================================
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  discussion_id INT REFERENCES discussions(id) ON DELETE CASCADE,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_discussion ON comments(discussion_id);

-- ================================
-- LIKES (who liked what)
-- ================================
CREATE TABLE IF NOT EXISTS discussion_likes (
  id SERIAL PRIMARY KEY,
  discussion_id INT REFERENCES discussions(id) ON DELETE CASCADE,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(discussion_id, student_id)
);

-- ================================
-- TAGS (optional multi-tagging)
-- ================================
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS discussion_tags (
  discussion_id INT REFERENCES discussions(id) ON DELETE CASCADE,
  tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (discussion_id, tag_id)
);

-- ================================
-- STUDY MATERIALS
-- ================================
CREATE TABLE IF NOT EXISTS study_materials (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  module VARCHAR(100),
  year INT,
  type VARCHAR(50),
  description TEXT,
  file_url TEXT,         -- uploaded files (PDF, DOCX, PPTX, XLSX)
  link TEXT,             -- YouTube / external links
  downloads INT DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_materials_module ON study_materials(module);
CREATE INDEX IF NOT EXISTS idx_study_materials_year ON study_materials(year);
CREATE INDEX IF NOT EXISTS idx_study_materials_type ON study_materials(type);

-- ================================
-- NOTIFICATIONS
-- ================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,     -- 'discussion', 'comment', 'like', 'material'
  ref_id INT,                    -- ID of related discussion, comment, or material
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

-- ================================
-- CONVERSATIONS & MESSAGING
-- ================================
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);


