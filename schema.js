const schemaSQL = `

-- ================================
-- DEPARTMENTS
-- ================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

-- ================================
-- STUDENT
-- ================================
CREATE TABLE IF NOT EXISTS student (
  stu_id SERIAL PRIMARY KEY,
  stu_number VARCHAR(20) UNIQUE NOT NULL,
  stu_email VARCHAR(100) UNIQUE NOT NULL,
  stu_password VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  year_of_study VARCHAR(20),
  department_id INT REFERENCES departments(id),
  bio TEXT,
  registration_status VARCHAR(50),
  avatar TEXT,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  is_active BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_student_number ON student(stu_number);
CREATE INDEX IF NOT EXISTS idx_student_email  ON student(stu_email);

-- ================================
-- COURSES & MODULES
-- ================================
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE
);

-- Student-Courses junction
CREATE TABLE IF NOT EXISTS student_courses (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(student_id, course_id)
);

-- Student-Modules junction
CREATE TABLE IF NOT EXISTS student_modules (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  module_id INT REFERENCES modules(id) ON DELETE CASCADE,
  UNIQUE(student_id, module_id)
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
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  module_id INT REFERENCES modules(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_discussions_category   ON discussions(category);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at);
CREATE INDEX IF NOT EXISTS idx_discussions_module_id  ON discussions(module_id);

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

-- ================================
-- LIKES
-- ================================
CREATE TABLE IF NOT EXISTS discussion_likes (
  id SERIAL PRIMARY KEY,
  discussion_id INT REFERENCES discussions(id) ON DELETE CASCADE,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(discussion_id, student_id)
);

-- ================================
-- TAGS
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
  file_url TEXT,
  link TEXT,
  downloads INT DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  uploader_id INT REFERENCES student(stu_id) ON DELETE SET NULL
);

-- Ensure uploader_id exists (if older DBs were missing it)
ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS uploader_id INT REFERENCES student(stu_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_materials_uploaded_at ON study_materials(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_study_materials_module      ON study_materials(module);
CREATE INDEX IF NOT EXISTS idx_study_materials_type        ON study_materials(type);
CREATE INDEX IF NOT EXISTS idx_study_materials_year        ON study_materials(year);

-- ================================
-- STUDY UPLOADS (download gate)
-- one row per student who has ever uploaded
-- ================================
CREATE TABLE IF NOT EXISTS study_uploads (
  id SERIAL PRIMARY KEY,
  stu_id INT UNIQUE REFERENCES student(stu_id) ON DELETE CASCADE,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_uploads_stu_id ON study_uploads(stu_id);

-- ================================
-- NOTIFICATIONS
-- ================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  ref_id INT,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);

-- ================================
-- CONVERSATIONS & MESSAGES
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

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at);

-- ================================
-- SAVED POSTS
-- ================================
CREATE TABLE IF NOT EXISTS student_saved_posts (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES student(stu_id) ON DELETE CASCADE,
  discussion_id INT REFERENCES discussions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, discussion_id)
);

`;

module.exports = { schemaSQL };





