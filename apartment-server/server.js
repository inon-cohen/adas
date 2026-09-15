const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db'); 

const app = express();

app.use(cors());
// Middlewares לקריאת JSON (חשוב מאוד לקבלת נתונים בטפסים - כאן הוספנו מגבלה גדולה יותר בגלל התמונות)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- מיגרציות אוטומטיות: מריצות את עצמן בכל עליית שרת, בלי לפגוע בנתונים קיימים ---
// 1. עמודת category (IT / YT) בכל טבלאות הטמפלטים והמשימות
// 2. טבלאות טיוטה לשמירת בדיקה באמצע העבודה וחזרה אליה בהמשך
async function runMigrations() {
  try {
    await pool.query(`ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS category VARCHAR(10) NOT NULL DEFAULT 'IT'`);
    await pool.query(`ALTER TABLE local_checklist_templates ADD COLUMN IF NOT EXISTS category VARCHAR(10) NOT NULL DEFAULT 'IT'`);
    await pool.query(`ALTER TABLE past_check_tasks ADD COLUMN IF NOT EXISTS category VARCHAR(10) NOT NULL DEFAULT 'IT'`);
    await pool.query(`ALTER TABLE local_past_check_tasks ADD COLUMN IF NOT EXISTS category VARCHAR(10) NOT NULL DEFAULT 'IT'`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS draft_checks (
        id SERIAL PRIMARY KEY,
        apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
        check_type VARCHAR(10) NOT NULL,
        inspector TEXT,
        summary TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS draft_check_tasks (
        id SERIAL PRIMARY KEY,
        draft_check_id INTEGER NOT NULL REFERENCES draft_checks(id) ON DELETE CASCADE,
        task_description TEXT,
        category VARCHAR(10) NOT NULL DEFAULT 'IT',
        status TEXT,
        notes TEXT,
        image_url TEXT
      )
    `);

    console.log('✅ מיגרציות מסד הנתונים הורצו בהצלחה (סיווג IT/YT + טיוטות בדיקה)');
  } catch (err) {
    console.error('❌ שגיאה בהרצת מיגרציות מסד הנתונים:', err.message);
  }
}
runMigrations();

// --- נקודות קצה לבדיקה (GET) ---

// 1. ראוט בדיקה כללי לסטטוס השרת
app.get('/api/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'השרת עובד באוויר בהצלחה! 🚀' 
  });
});

// 2. ראוט בדיקה ישיר למסד הנתונים
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'התקשורת למסד הנתונים עובדת!',
      dbTime: result.rows[0].now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'תקלה בתקשורת למסד הנתונים' });
  }
});

// --- נקודות קצה לקריאת נתונים (GET) ---

// 3. לקבלת רשימת כל הדירות ממסד הנתונים (עודכן לבדיקת סטטוס קריטי משולב: מרחוק ומקומי!)
app.get('/api/apartments', async (req, res) => {
  try {
    // שאילתת SQL חכמה המשקפת תזכורות פקעות, ליקויים בבדיקה מרחוק אחרונה או ליקויים בבד"ח מקומי אחרון
    const queryText = `
      SELECT a.id, a.name, a.image_url, a.last_checked,
        CASE 
          -- תנאי א': קיימת תזכורת פקעה (התאריך קטן מתאריך היום הנוכחי)
          WHEN EXISTS (
            SELECT 1 FROM reminders r 
            WHERE r.apartment_id = a.id AND r.target_date < CURRENT_DATE
          ) THEN TRUE
          
          -- תנאי ב': בבדיקה מרחוק האחרונה ביותר שבוצעה, יש משימה בסטטוס 'דורש טיפול'
          WHEN EXISTS (
            SELECT 1 FROM past_check_tasks pct
            JOIN past_checks pc ON pct.past_check_id = pc.id
            WHERE pc.apartment_id = a.id 
              AND pc.id = (SELECT id FROM past_checks WHERE apartment_id = a.id ORDER BY check_date DESC, id DESC LIMIT 1)
              AND pct.status = 'דורש טיפול'
          ) THEN TRUE

          -- תנאי ג': בבד"ח המקומי האחרון ביותר שבוצע, יש משימה בסטטוס 'דורש טיפול'
          WHEN EXISTS (
            SELECT 1 FROM local_past_check_tasks lpct
            JOIN local_past_checks lpc ON lpct.local_past_check_id = lpc.id
            WHERE lpc.apartment_id = a.id 
              AND lpc.id = (SELECT id FROM local_past_checks WHERE apartment_id = a.id ORDER BY check_date DESC, id DESC LIMIT 1)
              AND lpct.status = 'דורש טיפול'
          ) THEN TRUE
          
          ELSE FALSE
        END as has_critical_issue
      FROM apartments a
      ORDER BY a.id ASC;
    `;
    
    const result = await pool.query(queryText);
    res.json(result.rows);
  } catch (err) {
    console.error('שגיאה בשליפת דירות:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת הדירות' });
  }
});

// 4. לקבלת התזכורות של דירה ספציפית
app.get('/api/apartments/:id/reminders', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM reminders WHERE apartment_id = $1 ORDER BY target_date ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('שגיאה בשליפת תזכורות:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת התזכורות' });
  }
});

// 5. לקבלת טמפלט הצ''קליסט (מרחוק) של דירה ספציפית
app.get('/api/apartments/:id/template', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM checklist_templates WHERE apartment_id = $1 ORDER BY id ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('שגיאה בשליפת טמפלט:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת הטמפלט' });
  }
});

// 6. לקבלת היסטוריית הבדיקות מרחוק של דירה ספציפית
app.get('/api/apartments/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const checksResult = await pool.query(
      "SELECT *, 'remote' as type FROM past_checks WHERE apartment_id = $1 ORDER BY check_date DESC",
      [id]
    );
    
    const checks = checksResult.rows;

    for (let check of checks) {
      const tasksResult = await pool.query(
        'SELECT * FROM past_check_tasks WHERE past_check_id = $1 ORDER BY id ASC',
        [check.id]
      );
      
      check.tasks = tasksResult.rows.map(t => ({
        id: t.id,
        task: t.task_description,
        status: t.status,
        notes: t.notes,
        image: t.image_url,
        category: t.category || 'IT'
      }));
    }

    res.json(checks);
  } catch (err) {
    console.error('שגיאה בשליפת היסטוריה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת ההיסטוריה' });
  }
});

// --- נקודות קצה חדשות עבור בד"ח מקומי (Local) ---

// 15. לקבלת היסטוריית הבדיקות המקומיות של דירה ספציפית
app.get('/api/apartments/:id/local_history', async (req, res) => {
  const { id } = req.params;
  try {
    const checksResult = await pool.query(
      "SELECT *, 'local' as type FROM local_past_checks WHERE apartment_id = $1 ORDER BY check_date DESC",
      [id]
    );
    
    const checks = checksResult.rows;

    for (let check of checks) {
      const tasksResult = await pool.query(
        'SELECT * FROM local_past_check_tasks WHERE local_past_check_id = $1 ORDER BY id ASC',
        [check.id]
      );
      
      check.tasks = tasksResult.rows.map(t => ({
        id: t.id,
        task: t.task_description,
        status: t.status,
        notes: t.notes,
        image: t.image_url,
        category: t.category || 'IT'
      }));
    }

    res.json(checks);
  } catch (err) {
    console.error('שגיאה בשליפת היסטוריה מקומית:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת ההיסטוריה המקומית' });
  }
});

// 16. לקבלת טמפלט הצ''קליסט המקומי של דירה ספציפית
app.get('/api/apartments/:id/local_template', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM local_checklist_templates WHERE apartment_id = $1 ORDER BY id ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('שגיאה בשליפת טמפלט מקומי:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת הטמפלט המקומי' });
  }
});

// 17. עדכון טמפלט הבדיקה המקומי הקבוע לדירה
app.put('/api/apartments/:id/local_template', async (req, res) => {
  const { id } = req.params;
  const { tasks } = req.body;

  try {
    await pool.query('DELETE FROM local_checklist_templates WHERE apartment_id = $1', [id]);

    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        const taskDesc = typeof t === 'string' ? t : t.task;
        const category = typeof t === 'string' ? 'IT' : (t.category || 'IT');
        if (!taskDesc) continue;
        await pool.query(
          'INSERT INTO local_checklist_templates (apartment_id, task_description, category) VALUES ($1, $2, $3)',
          [id, taskDesc, category]
        );
      }
    }

    res.json({ success: true, message: 'הטמפלט המקומי עודכן בהצלחה' });
  } catch (err) {
    console.error('שגיאה בעדכון טמפלט מקומי:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בעדכון הטמפלט המקומי' });
  }
});

// 18. שמירת דו"ח בדיקה מקומי מלא (כולל המשימות שבוצעו)
app.post('/api/local_checks', async (req, res) => {
  const { apartment_id, check_date, inspector, summary, tasks } = req.body;

  try {
    const checkResult = await pool.query(
      'INSERT INTO local_past_checks (apartment_id, check_date, inspector, summary) VALUES ($1, $2, $3, $4) RETURNING id',
      [apartment_id, check_date, inspector, summary]
    );
    
    const pastCheckId = checkResult.rows[0].id;

    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        await pool.query(
          'INSERT INTO local_past_check_tasks (local_past_check_id, task_description, status, notes, image_url, category) VALUES ($1, $2, $3, $4, $5, $6)',
          [pastCheckId, t.task, t.status || 'לא נבדק', t.notes || '', t.image || '', t.category || 'IT']
        );
      }
    }

    await pool.query(
      'UPDATE apartments SET last_checked = $1 WHERE id = $2',
      [check_date, apartment_id]
    );

    res.status(201).json({ success: true, checkId: pastCheckId });
  } catch (err) {
    console.error('שגיאה בשמירת בדיקה מקומית מלאה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בשמירת הדו"ח המקומי' });
  }
});

// 19. מחיקת דו"ח בדיקה מקומי ספציפי מההיסטוריה
app.delete('/api/local_checks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM local_past_checks WHERE id = $1', [id]);
    res.json({ success: true, message: 'דו"ח הבדיקה המקומי נמחק בהצלחה' });
  } catch (err) {
    console.error('שגיאה במחיקת דו"ח מקומי מהמסד:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית במחיקת הדו"ח המקומי' });
  }
});

// --- נקודות קצה ליצירת נתונים כלליים (POST) ---

// 7. הוספת דירה חדשה למסד הנתונים
app.post('/api/apartments', async (req, res) => {
  const { name, image_url } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'חובה לספק שם דירה' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO apartments (name, image_url) VALUES ($1, $2) RETURNING *',
      [name, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('שגיאה בהוספת דירה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בהוספת הדירה' });
  }
});

// 8. הוספת תזכורת חדשה לדירה
app.post('/api/reminders', async (req, res) => {
  const { apartment_id, text, target_date } = req.body;
  
  if (!apartment_id || !text || !target_date) {
    return res.status(400).json({ error: 'חובה לספק את כל השדות לתזכורת' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO reminders (apartment_id, text, target_date) VALUES ($1, $2, $3) RETURNING *',
      [apartment_id, text, target_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('שגיאה בהוספת תזכורת:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בהוספת התזכורת' });
  }
});

// --- נקודות קצה למחיקה ועדכון כלליים ---

// 9. מחיקת תזכורת
app.delete('/api/reminders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM reminders WHERE id = $1', [id]);
    res.json({ success: true, message: 'התזכורת נמחקה בהצלחה' });
  } catch (err) {
    console.error('שגיאה במחיקת תזכורת:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית במחיקת התזכורת' });
  }
});

// 10. עדכון טמפלט הבדיקה (מרחוק) הקבוע לדירה
app.put('/api/apartments/:id/template', async (req, res) => {
  const { id } = req.params;
  const { tasks } = req.body;

  try {
    await pool.query('DELETE FROM checklist_templates WHERE apartment_id = $1', [id]);

    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        const taskDesc = typeof t === 'string' ? t : t.task;
        const category = typeof t === 'string' ? 'IT' : (t.category || 'IT');
        if (!taskDesc) continue;
        await pool.query(
          'INSERT INTO checklist_templates (apartment_id, task_description, category) VALUES ($1, $2, $3)',
          [id, taskDesc, category]
        );
      }
    }

    res.json({ success: true, message: 'הטמפלט עודכן בהצלחה' });
  } catch (err) {
    console.error('שגיאה בעדכון טמפלט:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בעדכון הטמפלט' });
  }
});

// 11. שמירת דו"ח בדיקה מרחוק מלא (כולל המשימות שבוצעו)
app.post('/api/checks', async (req, res) => {
  const { apartment_id, check_date, inspector, summary, tasks } = req.body;

  try {
    const checkResult = await pool.query(
      'INSERT INTO past_checks (apartment_id, check_date, inspector, summary) VALUES ($1, $2, $3, $4) RETURNING id',
      [apartment_id, check_date, inspector, summary]
    );
    
    const pastCheckId = checkResult.rows[0].id;

    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        await pool.query(
          'INSERT INTO past_check_tasks (past_check_id, task_description, status, notes, image_url, category) VALUES ($1, $2, $3, $4, $5, $6)',
          [pastCheckId, t.task, t.status || 'לא נבדק', t.notes || '', t.image || '', t.category || 'IT']
        );
      }
    }

    await pool.query(
      'UPDATE apartments SET last_checked = $1 WHERE id = $2',
      [check_date, apartment_id]
    );

    res.status(201).json({ success: true, checkId: pastCheckId });
  } catch (err) {
    console.error('שגיאה בשמירת בדיקה מלאה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בשמירת הדו"ח' });
  }
});

// 12. עדכון פרטי דירה (שם ותמונה)
app.put('/api/apartments/:id', async (req, res) => {
  const { id } = req.params;
  const { name, image_url } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'חובה לספק שם דירה' });
  }
  try {
    const result = await pool.query(
      'UPDATE apartments SET name = $1, image_url = $2 WHERE id = $3 RETURNING *',
      [name, image_url, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'הדירה לא נמצאה' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('שגיאה בעדכון דירה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בעדכון הדירה' });
  }
});

// 13. מחיקת דירה קומפלט מהמסד
app.delete('/api/apartments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM apartments WHERE id = $1', [id]);
    res.json({ success: true, message: 'הדירה וכל נתוניה נמחקו בהצלחה' });
  } catch (err) {
    console.error('שגיאה במחיקת דירה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית במחיקת הדירה' });
  }
});

// 14. מחיקת דו"ח בדיקה מרחוק ספציפי מההיסטוריה
app.delete('/api/checks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM past_checks WHERE id = $1', [id]);
    res.json({ success: true, message: 'דו"ח הבדיקה נמחק בהצלחה' });
  } catch (err) {
    console.error('שגיאה במחיקת דו"ח בדיקה מהמסד:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית במחיקת הדו"ח' });
  }
});

// --- נקודות קצה לטיוטות בדיקה (שמירה באמצע העבודה והמשך מאוחר יותר) ---

// 20. קבלת רשימת הטיוטות הפתוחות של דירה, מסוננות לפי סוג בדיקה (remote / local)
app.get('/api/apartments/:id/drafts', async (req, res) => {
  const { id } = req.params;
  const { type } = req.query;
  try {
    const result = await pool.query(
      `SELECT dc.*, COUNT(dct.id) AS task_count
       FROM draft_checks dc
       LEFT JOIN draft_check_tasks dct ON dct.draft_check_id = dc.id
       WHERE dc.apartment_id = $1 AND dc.check_type = $2
       GROUP BY dc.id
       ORDER BY dc.updated_at DESC`,
      [id, type]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('שגיאה בשליפת טיוטות:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת הטיוטות' });
  }
});

// 21. קבלת טיוטה מלאה לפי מזהה (לצורך המשך עריכה)
app.get('/api/drafts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const draftResult = await pool.query('SELECT * FROM draft_checks WHERE id = $1', [id]);
    if (draftResult.rows.length === 0) {
      return res.status(404).json({ error: 'הטיוטה לא נמצאה' });
    }
    const draft = draftResult.rows[0];

    const tasksResult = await pool.query(
      'SELECT * FROM draft_check_tasks WHERE draft_check_id = $1 ORDER BY id ASC',
      [id]
    );
    draft.tasks = tasksResult.rows.map(t => ({
      id: t.id,
      task: t.task_description,
      category: t.category || 'IT',
      status: t.status,
      notes: t.notes,
      image: t.image_url
    }));

    res.json(draft);
  } catch (err) {
    console.error('שגיאה בשליפת טיוטה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בטעינת הטיוטה' });
  }
});

// 22. יצירת טיוטה חדשה (שמירת בדיקה שעוד לא הושלמה)
app.post('/api/drafts', async (req, res) => {
  const { apartment_id, check_type, inspector, summary, tasks } = req.body;

  if (!apartment_id || !check_type) {
    return res.status(400).json({ error: 'חובה לספק דירה וסוג בדיקה לשמירת הטיוטה' });
  }

  try {
    const draftResult = await pool.query(
      'INSERT INTO draft_checks (apartment_id, check_type, inspector, summary) VALUES ($1, $2, $3, $4) RETURNING id',
      [apartment_id, check_type, inspector || '', summary || '']
    );
    const draftId = draftResult.rows[0].id;

    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        await pool.query(
          'INSERT INTO draft_check_tasks (draft_check_id, task_description, category, status, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
          [draftId, t.task, t.category || 'IT', t.status || '', t.notes || '', t.image || '']
        );
      }
    }

    res.status(201).json({ success: true, draftId });
  } catch (err) {
    console.error('שגיאה בשמירת טיוטה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בשמירת הטיוטה' });
  }
});

// 23. עדכון טיוטה קיימת (המשך עבודה ושמירה חוזרת)
app.put('/api/drafts/:id', async (req, res) => {
  const { id } = req.params;
  const { inspector, summary, tasks } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM draft_checks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'הטיוטה לא נמצאה' });
    }

    await pool.query(
      'UPDATE draft_checks SET inspector = $1, summary = $2, updated_at = NOW() WHERE id = $3',
      [inspector || '', summary || '', id]
    );

    await pool.query('DELETE FROM draft_check_tasks WHERE draft_check_id = $1', [id]);

    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        await pool.query(
          'INSERT INTO draft_check_tasks (draft_check_id, task_description, category, status, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, t.task, t.category || 'IT', t.status || '', t.notes || '', t.image || '']
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('שגיאה בעדכון טיוטה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית בעדכון הטיוטה' });
  }
});

// 24. מחיקת טיוטה (ביטול / זריקה של טיוטה, או ניקוי אחרי סיום סופי של הבדיקה)
app.delete('/api/drafts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM draft_checks WHERE id = $1', [id]);
    res.json({ success: true, message: 'הטיוטה נמחקה בהצלחה' });
  } catch (err) {
    console.error('שגיאה במחיקת טיוטה:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית במחיקת הטיוטה' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`=================================`);
}).on('error', (err) => {
  console.error('❌ שגיאה קריטית בהפעלת השרת:', err.message);
});