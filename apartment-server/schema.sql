-- סכמת מסד הנתונים למערכת ניהול ותחזוקת נכסים
-- שחזור מבנה הטבלאות על סמך השאילתות בקוד השרת (server.js).
-- ניתן להריץ בבטחה גם על מסד נתונים שכבר מכיל את הטבלאות - כל הפקודות משתמשות ב-IF NOT EXISTS
-- ולא ימחקו או ישנו נתונים קיימים.

-- דירות (נכסים)
CREATE TABLE IF NOT EXISTS apartments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  last_checked DATE
);

-- תזכורות לכל דירה
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  target_date DATE NOT NULL
);

-- טמפלט הצ'קליסט הקבוע לבדיקה מרחוק, לכל דירה
CREATE TABLE IF NOT EXISTS checklist_templates (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  task_description TEXT,
  category VARCHAR(10) NOT NULL DEFAULT 'IT'
);

-- טמפלט הצ'קליסט הקבוע לבד"ח מקומי, לכל דירה
CREATE TABLE IF NOT EXISTS local_checklist_templates (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  task_description TEXT,
  category VARCHAR(10) NOT NULL DEFAULT 'IT'
);

-- היסטוריית בדיקות מרחוק שהושלמו
CREATE TABLE IF NOT EXISTS past_checks (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  inspector TEXT,
  summary TEXT
);

-- המשימות שבוצעו בכל בדיקה מרחוק
CREATE TABLE IF NOT EXISTS past_check_tasks (
  id SERIAL PRIMARY KEY,
  past_check_id INTEGER NOT NULL REFERENCES past_checks(id) ON DELETE CASCADE,
  task_description TEXT,
  status TEXT,
  notes TEXT,
  image_url TEXT,
  category VARCHAR(10) NOT NULL DEFAULT 'IT'
);

-- היסטוריית בד"ח מקומי שהושלם
CREATE TABLE IF NOT EXISTS local_past_checks (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  inspector TEXT,
  summary TEXT
);

-- המשימות שבוצעו בכל בד"ח מקומי
CREATE TABLE IF NOT EXISTS local_past_check_tasks (
  id SERIAL PRIMARY KEY,
  local_past_check_id INTEGER NOT NULL REFERENCES local_past_checks(id) ON DELETE CASCADE,
  task_description TEXT,
  status TEXT,
  notes TEXT,
  image_url TEXT,
  category VARCHAR(10) NOT NULL DEFAULT 'IT'
);

-- טיוטות בדיקה פתוחות (נשמרות באמצע העבודה, לפני שהבדיקה הושלמה)
CREATE TABLE IF NOT EXISTS draft_checks (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  check_type VARCHAR(10) NOT NULL,
  inspector TEXT,
  summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- המשימות בתוך טיוטה פתוחה
CREATE TABLE IF NOT EXISTS draft_check_tasks (
  id SERIAL PRIMARY KEY,
  draft_check_id INTEGER NOT NULL REFERENCES draft_checks(id) ON DELETE CASCADE,
  task_description TEXT,
  category VARCHAR(10) NOT NULL DEFAULT 'IT',
  status TEXT,
  notes TEXT,
  image_url TEXT
);
