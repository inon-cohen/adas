const { Pool } = require('pg');
require('dotenv').config();

// יצירת חיבור למסד הנתונים בעזרת הכתובת מקובץ ה-.env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // השורה הבאה נדרשת לרוב כשמתחברים למסד נתונים בענן (מונעת שגיאות SSL)
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }
});

// בדיקת התחברות ראשונית
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ שגיאה בחיבור למסד הנתונים:', err.stack);
  } else {
    console.log('✅ מחובר בהצלחה למסד הנתונים PostgreSQL');
    release();
  }
});

module.exports = pool;