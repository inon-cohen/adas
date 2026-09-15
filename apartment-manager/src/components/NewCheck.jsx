import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// שני הסוגים הקבועים של אנשי הבדיקה בכל בדיקה
const CATEGORIES = [
  { key: 'IT', label: 'בדיקות ועדכוני IT', icon: '🖥️', panelClass: 'category-panel-it', headerClass: 'it' },
  { key: 'YT', label: 'בדיקות ועדכוני YT', icon: '🛠️', panelClass: 'category-panel-yt', headerClass: 'yt' }
];

function NewCheck({ selectedApartment, setIsPerformingCheck, checkType, draftToResume, onExit }) {
  const [tasks, setTasks] = useState([]);
  const [inspector, setInspector] = useState('');
  const [summary, setSummary] = useState('');
  const [draftId, setDraftId] = useState(draftToResume ? draftToResume.id : null);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);

  // פונקציית יציאה מהמסך (חזרה לדירה) - תומכת גם במקרה שהרכיב הופעל בלי onExit חדש
  const exitScreen = () => {
    if (onExit) onExit();
    else setIsPerformingCheck(false);
  };

  useEffect(() => {
    if (!selectedApartment || !selectedApartment.id) return;

    // תרחיש 1: ממשיכים טיוטה קיימת - טוענים אותה כמו שהיא, בלי לפנות לטמפלט
    if (draftToResume) {
      setInspector(draftToResume.inspector || '');
      setSummary(draftToResume.summary || '');
      setDraftId(draftToResume.id);
      const draftTasks = (draftToResume.tasks || []).map((item, index) => ({
        id: item.id || Date.now() + index,
        task: item.task,
        category: item.category === 'YT' ? 'YT' : 'IT',
        status: item.status || '',
        notes: item.notes || '',
        image: item.image || ''
      }));
      setTasks(draftTasks);
      setLoading(false);
      return;
    }

    // תרחיש 2: בדיקה חדשה - טוענים את טמפלט הצ'קליסט הקבוע לדירה
    const endpoint = checkType === 'local' ? 'local_template' : 'template';

    fetch(`http://localhost:5000/api/apartments/${selectedApartment.id}/${endpoint}`)
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בשליפת טמפלט');
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          const mappedTasks = data.map((item, index) => ({
            id: item.id || Date.now() + index,
            task: item.task_description,
            category: item.category === 'YT' ? 'YT' : 'IT',
            status: '',
            notes: '',
            image: ''
          }));
          setTasks(mappedTasks);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('שגיאה בטעינת הטמפלט:', err);
        setLoading(false);
      });
  }, [selectedApartment, checkType, draftToResume]);

  const addTask = (category) => {
    const newTask = {
      id: Date.now(),
      task: '',
      category,
      status: '',
      notes: '',
      image: ''
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (id, field, value) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // הפונקציה נשארה בשמה, אבל עכשיו מטפלת בכל קובץ
  const handleImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateTask(id, 'image', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeTask = (id) => {
    if (window.confirm('האם למחוק בדיקה זו מהרשימה הקבועה של הדירה?')) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  // שמירת הבדיקה כטיוטה - ניתן להמשיך אותה בהמשך מבלי לאבד את מה שכבר מולא
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const payload = {
        apartment_id: selectedApartment.id,
        check_type: checkType,
        inspector,
        summary,
        tasks
      };

      const response = draftId
        ? await fetch(`http://localhost:5000/api/drafts/${draftId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch('http://localhost:5000/api/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

      if (!response.ok) throw new Error('שגיאה בשמירת הטיוטה');

      alert('הטיוטה נשמרה. ניתן להמשיך אותה בכל עת מתוך מסך הדירה.');
      exitScreen();
    } catch (error) {
      console.error('שגיאה:', error);
      alert('אירעה שגיאה בשמירת הטיוטה. ודא שהשרת פועל.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFinalizeCheck = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const templateTasks = tasks
        .filter(t => t.task && t.task.trim())
        .map(t => ({ task: t.task, category: t.category }));

      // בחירת הראוטים המתאימים לשמירה לפי סוג הבדיקה
      const templateEndpoint = checkType === 'local' ? 'local_template' : 'template';
      const checksEndpoint = checkType === 'local' ? 'local_checks' : 'checks';

      await fetch(`http://localhost:5000/api/apartments/${selectedApartment.id}/${templateEndpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: templateTasks })
      });

      const checkData = {
        apartment_id: selectedApartment.id,
        check_date: today,
        inspector: inspector || 'מתחזק',
        summary: summary || 'הבדיקה בוצעה והטמפלט עודכן',
        tasks
      };

      const response = await fetch(`http://localhost:5000/api/${checksEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkData)
      });

      if (!response.ok) throw new Error('שגיאה בשמירת הבדיקה');

      // אם המשכנו מטיוטה - מנקים אותה כעת כשהבדיקה הפכה לדו"ח סופי
      if (draftId) {
        try {
          await fetch(`http://localhost:5000/api/drafts/${draftId}`, { method: 'DELETE' });
        } catch (cleanupError) {
          console.error('שגיאה בניקוי הטיוטה לאחר סיום:', cleanupError);
        }
      }

      alert('הבדיקה נשמרה בהצלחה והטמפלט עודכן לפעם הבאה!');
      exitScreen();
    } catch (error) {
      console.error('שגיאה:', error);
      alert('אירעה שגיאה בשמירת הנתונים. ודא שהשרת פועל.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2rem', color: '#6b7280' }}>
        טוען טמפלט בדיקה... 🔄
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="details-card"
      style={{ maxWidth: '980px', margin: '0 auto' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', fontWeight: '600', color: '#111827' }}>
            {draftId ? 'המשך ' : 'ביצוע '}{checkType === 'local' ? 'בד"ח מקומי' : 'בדיקה מרחוק'}: {selectedApartment.name}
          </h2>
          <p style={{ margin: 0, color: '#6b7280' }}>
            הבדיקה מחולקת לשני מדורים - IT ו-YT. ניתן לשמור כטיוטה בכל שלב ולחזור אליה מאוחר יותר.
          </p>
        </div>
        <button onClick={exitScreen} className="btn-secondary">ביטול וחזרה</button>
      </div>

      <div className="form-row">
        <div>
          <label className="field-label">שם מבצע הבדיקה</label>
          <input
            type="text"
            placeholder="לדוגמה: ינון כהן"
            className="input-field"
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">סיכום כללי לבדיקה (אופציונלי)</label>
          <input
            type="text"
            placeholder="הערה מסכמת שתופיע גם בדו״ח שיופץ לבעל הדירה"
            className="input-field"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
      </div>

      <div className="section-columns" style={{ marginBottom: '30px' }}>
        {CATEGORIES.map(cat => {
          const categoryTasks = tasks.filter(t => t.category === cat.key);
          return (
            <div key={cat.key} className={`category-panel ${cat.panelClass}`}>
              <div className={`category-panel-header ${cat.headerClass}`}>
                <span>{cat.icon}</span> {cat.label}
              </div>

              <AnimatePresence>
                {categoryTasks.length === 0 && (
                  <div className="category-empty-hint">עדיין אין שורות במדור זה</div>
                )}
                {categoryTasks.map((t) => (
                  <motion.div
                    key={t.id}
                    className="task-edit-card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <div className="task-edit-header">
                      <input
                        type="text"
                        placeholder="תיאור הבדיקה (לדוגמה: בדיקת WIFI בווילה)"
                        value={t.task}
                        onChange={(e) => updateTask(t.id, 'task', e.target.value)}
                        className="input-field task-title-input"
                      />
                      <button type="button" onClick={() => removeTask(t.id)} className="btn-delete-task" title="מחק שורה">🗑️</button>
                    </div>

                    <div className="task-edit-body">
                      <div className="task-status-group">
                        <label style={{ color: '#4b5563', fontWeight: '500' }}>תוצאה:</label>
                        <div className="status-buttons">
                          <button
                            type="button"
                            className={`status-btn ${t.status === 'תקין' ? 'active-ok' : ''}`}
                            onClick={() => updateTask(t.id, 'status', 'תקין')}
                          >
                            תקין
                          </button>
                          <button
                            type="button"
                            className={`status-btn ${t.status === 'דורש טיפול' ? 'active-critical' : ''}`}
                            onClick={() => updateTask(t.id, 'status', 'דורש טיפול')}
                          >
                            דורש טיפול
                          </button>
                        </div>
                      </div>

                      <div className="task-notes-group">
                        <input
                          type="text"
                          placeholder="הערות (אופציונלי)"
                          value={t.notes || ''}
                          onChange={(e) => updateTask(t.id, 'notes', e.target.value)}
                          className="input-field"
                          style={{ width: '100%', fontSize: '0.95rem' }}
                        />
                      </div>

                      <div className="task-image-group">
                        <label className="image-upload-label">
                          <input
                            type="file"
                            accept="image/*,.pdf,.txt,.doc,.docx"
                            onChange={(e) => handleImageUpload(t.id, e)}
                            style={{ display: 'none' }}
                          />
                          {t.image ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {t.image.startsWith('data:image/') ? (
                                <img src={t.image} alt="preview" className="task-img-preview" />
                              ) : (
                                <div style={{ padding: '8px 12px', background: '#e5e7eb', borderRadius: '6px', fontSize: '0.9rem', color: '#374151', fontWeight: '500' }}>
                                  📄 קובץ צורף
                                </div>
                              )}
                              <span style={{ fontSize: '0.85rem', textDecoration: 'underline', color: '#6b7280' }}>החלף קובץ</span>
                            </div>
                          ) : (
                            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>📎 צרף תמונה או קובץ (אופציונלי)</span>
                          )}
                        </label>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => addTask(cat.key)}
                style={{ padding: '12px', borderStyle: 'dashed', borderWidth: '2px', fontWeight: '600' }}
              >
                + הוסף שורה ל-{cat.key}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleSaveDraft}
          disabled={savingDraft}
          style={{ padding: '16px', fontSize: '1.05rem', fontWeight: '600' }}
        >
          {savingDraft ? 'שומר טיוטה...' : '💾 שמור כטיוטה והמשך אחר כך'}
        </button>

        <button
          className="btn-primary"
          onClick={handleFinalizeCheck}
          style={{ padding: '20px', fontSize: '1.2rem' }}
        >
          שמור בדיקה סופית ועדכן טמפלט
        </button>
      </div>
    </motion.div>
  );
}

export default NewCheck;
