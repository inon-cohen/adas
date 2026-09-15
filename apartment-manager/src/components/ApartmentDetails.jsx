import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function ApartmentDetails({ selectedApartment, setSelectedApartment, onStartCheck, setViewingPastCheck }) {
  const [history, setHistory] = useState([]);
  const [localHistory, setLocalHistory] = useState([]); // סטייט חדש להיסטוריית בד"ח מקומי
  const [remoteDrafts, setRemoteDrafts] = useState([]); // טיוטות פתוחות - בדיקה מרחוק
  const [localDrafts, setLocalDrafts] = useState([]); // טיוטות פתוחות - בד"ח מקומי
  const [reminders, setReminders] = useState([]);
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');

  // סטייטים עבור סינון היסטוריית בדיקות
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateRange, setShowDateRange] = useState(false);

  const loadDrafts = () => {
    if (!selectedApartment || !selectedApartment.id) return;

    fetch(`http://localhost:5000/api/apartments/${selectedApartment.id}/drafts?type=remote`)
      .then(res => (res.ok ? res.json() : []))
      .then(setRemoteDrafts)
      .catch(() => setRemoteDrafts([]));

    fetch(`http://localhost:5000/api/apartments/${selectedApartment.id}/drafts?type=local`)
      .then(res => (res.ok ? res.json() : []))
      .then(setLocalDrafts)
      .catch(() => setLocalDrafts([]));
  };

  useEffect(() => {
    if (selectedApartment && selectedApartment.id) {
      // 1. משיכת תזכורות
      const fetchReminders = fetch(`http://localhost:5000/api/apartments/${selectedApartment.id}/reminders`)
        .then(res => {
          if (!res.ok) throw new Error('שגיאה בשליפת התזכורת');
          return res.json();
        });

      // 2. משיכת היסטוריית בדיקות מרחוק
      const fetchHistory = fetch(`http://localhost:5000/api/apartments/${selectedApartment.id}/history`)
        .then(res => {
          if (!res.ok) throw new Error('שגיאה בשליפת היסטוריה');
          return res.json();
        });

      // 3. משיכת היסטוריית בד"ח מקומי (מוגן מפני קריסה עד שנעדכן את השרת)
      const fetchLocalHistory = fetch(`http://localhost:5000/api/apartments/${selectedApartment.id}/local_history`)
        .then(res => {
          if (!res.ok) return []; // מחזיר מערך ריק במקום לשבור את האפליקציה במידה והראוט טרם קיים
          return res.json();
        })
        .catch(() => []);

      Promise.all([fetchReminders, fetchHistory, fetchLocalHistory])
        .then(([remindersData, historyData, localData]) => {
          // סידור התזכורות
          const formattedReminders = remindersData.map(r => ({
            id: r.id,
            text: r.text,
            date: new Date(r.target_date).toISOString().split('T')[0]
          }));
          setReminders(formattedReminders);

          // סידור היסטוריה מרחוק
          const formattedHistory = historyData.map(h => ({
            id: h.id,
            date: new Date(h.check_date).toLocaleDateString('he-IL'),
            rawDate: h.check_date,
            inspector: h.inspector,
            summary: h.summary,
            tasks: h.tasks || []
          }));
          setHistory(formattedHistory);

          // סידור היסטוריה מקומית
          const formattedLocalHistory = localData.map(h => ({
            id: h.id,
            date: new Date(h.check_date).toLocaleDateString('he-IL'),
            rawDate: h.check_date,
            inspector: h.inspector,
            summary: h.summary,
            tasks: h.tasks || []
          }));
          setLocalHistory(formattedLocalHistory);
        })
        .catch(err => console.error('שגיאה בטעינת נתוני הדירה:', err));

      // 4. משיכת טיוטות פתוחות (מרחוק ומקומי)
      loadDrafts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApartment]);

  const handleAddReminder = async () => {
    if (!newReminderText.trim() || !newReminderDate) return;

    try {
      const response = await fetch('http://localhost:5000/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartment_id: selectedApartment.id,
          text: newReminderText,
          target_date: newReminderDate
        })
      });

      if (!response.ok) throw new Error('שגיאה בשמירת התזכורת');

      const savedReminder = await response.json();

      const newReminder = {
        id: savedReminder.id,
        text: savedReminder.text,
        date: new Date(savedReminder.target_date).toISOString().split('T')[0]
      };

      setReminders([...reminders, newReminder]);
      setNewReminderText('');
      setNewReminderDate('');
    } catch (error) {
      console.error('שגיאה:', error);
      alert('אירעה שגיאה בשמירת התזכורת במסד הנתונים.');
    }
  };

  const handleDeleteReminder = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/reminders/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('שגיאה במחיקת התזכורת');

      setReminders(reminders.filter(r => r.id !== id));
    } catch (error) {
      console.error('שגיאה:', error);
      alert('אירעה שגיאה במחיקת התזכורת. ודא שהשרת פועל.');
    }
  };

  // המשך עבודה על טיוטה קיימת - טוענים אותה במלואה ופותחים את מסך הבדיקה איתה
  const handleResumeDraft = async (draftMeta, checkType) => {
    try {
      const response = await fetch(`http://localhost:5000/api/drafts/${draftMeta.id}`);
      if (!response.ok) throw new Error('שגיאה בטעינת הטיוטה');
      const fullDraft = await response.json();
      onStartCheck(checkType, fullDraft);
    } catch (error) {
      console.error('שגיאה:', error);
      alert('אירעה שגיאה בטעינת הטיוטה. ודא שהשרת פועל.');
    }
  };

  const handleDiscardDraft = async (draftId) => {
    if (!window.confirm('האם למחוק את הטיוטה? לא ניתן לשחזר אותה לאחר המחיקה.')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/drafts/${draftId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('שגיאה במחיקת הטיוטה');
      loadDrafts();
    } catch (error) {
      console.error('שגיאה:', error);
      alert('אירעה שגיאה במחיקת הטיוטה.');
    }
  };

  const sortedReminders = [...reminders].sort((a, b) => new Date(a.date) - new Date(b.date));

  // פונקציית עזר לסינון רשימות הבדיקות (מיושמת פעמיים - פעם למרחוק ופעם למקומי)
  const filterCheckList = (list) => {
    return list.filter(check => {
      if (showDateRange) {
        if (startDate && new Date(check.rawDate) < new Date(startDate)) return false;
        if (endDate) {
          const endLimit = new Date(endDate);
          endLimit.setHours(23, 59, 59, 999);
          if (new Date(check.rawDate) > endLimit) return false;
        }
      }
      if (searchTerm) {
        const query = searchTerm.toLowerCase().trim();
        const matchesTasks = check.tasks ? check.tasks.some(t => {
          const taskMatch = t.task && t.task.toLowerCase().includes(query);
          const notesMatch = t.notes && t.notes.toLowerCase().includes(query);
          return taskMatch || notesMatch;
        }) : false;
        const matchesSummary = check.summary && check.summary.toLowerCase().includes(query);
        return matchesTasks || matchesSummary;
      }
      return true;
    });
  };

  const filteredHistory = filterCheckList(history);
  const filteredLocalHistory = filterCheckList(localHistory);

  // פונקציית עזר לתצוגת שורת טיוטה בודדת (חוזרת פעמיים - מרחוק ומקומי)
  const renderDraftRow = (draft, checkType) => (
    <div key={draft.id} className="draft-row">
      <div className="draft-row-info">
        <span className="draft-row-label">טיוטה מ-{new Date(draft.updated_at).toLocaleDateString('he-IL')}</span>
        <span className="draft-row-meta">{draft.task_count || 0} שורות שמולאו · {draft.inspector || 'ללא שם בודק'}</span>
      </div>
      <div className="draft-row-actions">
        <button className="draft-btn-resume" onClick={() => handleResumeDraft(draft, checkType)}>המשך ✏️</button>
        <button className="draft-btn-discard" onClick={() => handleDiscardDraft(draft.id)} title="מחק טיוטה">🗑️</button>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="details-card"
      style={{ padding: '40px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontWeight: '600', fontSize: '1.8rem', color: '#111827' }}>ניהול דירה</h2>
        <button onClick={() => setSelectedApartment(null)} className="btn-secondary">חזרה לרשימה</button>
      </div>

      <div style={{ display: 'flex', gap: '25px', marginBottom: '40px', background: '#f9fafb', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        <img
          src={selectedApartment.image}
          alt={selectedApartment.name}
          style={{ width: '220px', height: '140px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.6rem', color: '#1f2937' }}>{selectedApartment.name}</h3>
          <span style={{ color: '#6b7280', fontSize: '1.05rem' }}>בדיקה אחרונה: {selectedApartment.lastChecked || 'טרם נבדק'}</span>
          <div>
            {selectedApartment.hasCriticalIssue ? (
              <span className="status-badge status-critical" style={{ margin: 0 }}>🔴 דורש טיפול קריטי</span>
            ) : (
              <span className="status-badge status-ok" style={{ margin: 0 }}>🟢 הכל תקין</span>
            )}
          </div>
        </div>
      </div>

      <div className="details-grid">

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

          <div>
            <h4 style={{ color: '#1f2937', marginBottom: '20px', fontSize: '1.2rem', fontWeight: '500' }}>מערך בדיקות והיסטוריה</h4>

            {/* אזור שורת החיפוש והסינון (משותף לשני סוגי הבדיקות) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="חיפוש בבדיקות (לדוגמה: מזגן)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field"
                  style={{ flex: 1, padding: '8px', background: 'white', minWidth: '200px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem', color: '#4b5563', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={showDateRange}
                    onChange={(e) => setShowDateRange(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  סנן לפי תאריכים
                </label>
              </div>

              {showDateRange && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{ display: 'flex', gap: '15px', overflow: 'hidden', paddingTop: '5px', flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '140px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>מתאריך:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '8px', width: '100%', boxSizing: 'border-box', background: 'white' }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '140px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>עד תאריך:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '8px', width: '100%', boxSizing: 'border-box', background: 'white' }}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* פיצול המסך ל-2 חלקים: מרחוק ומקומי */}
            <div className="category-grid">

              {/* צד ימין: בדיקות מרחוק (Remote) */}
              <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h5 style={{ margin: 0, fontSize: '1.1rem', color: '#374151', textAlign: 'center', borderBottom: '2px solid var(--remote)', paddingBottom: '10px' }}>
                  🌐 בדיקות מרחוק
                </h5>

                {remoteDrafts.length > 0 && (
                  <div className="drafts-box">
                    <span className="drafts-box-title">טיוטות פתוחות</span>
                    {remoteDrafts.map(d => renderDraftRow(d, 'remote'))}
                  </div>
                )}

                {/* קופסת גלילה מוחלטת שלא נותנת למסך להימתח */}
                <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                  {history.length > 0 ? (
                    filteredHistory.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filteredHistory.map((item) => (
                          <div
                            key={item.id}
                            className="history-item-card"
                            onClick={() => setViewingPastCheck(item)}
                            style={{ margin: 0 }}
                          >
                            <div className="history-date-only">{item.date}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', margin: '20px 0' }}>לא נמצאו תוצאות.</p>
                    )
                  ) : (
                    <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', margin: '20px 0' }}>אין היסטוריה.</p>
                  )}
                </div>

                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '1rem', background: 'var(--remote)', borderColor: 'var(--remote)', marginTop: 'auto' }}
                  onClick={() => onStartCheck('remote')}
                >
                  בדיקה מרחוק חדשה +
                </button>
              </div>

              {/* צד שמאל: בד"ח מקומי (Local) */}
              <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h5 style={{ margin: 0, fontSize: '1.1rem', color: '#374151', textAlign: 'center', borderBottom: '2px solid var(--local)', paddingBottom: '10px' }}>
                  📍 בד"ח מקומי
                </h5>

                {localDrafts.length > 0 && (
                  <div className="drafts-box">
                    <span className="drafts-box-title">טיוטות פתוחות</span>
                    {localDrafts.map(d => renderDraftRow(d, 'local'))}
                  </div>
                )}

                {/* קופסת גלילה מוחלטת שלא נותנת למסך להימתח */}
                <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                  {localHistory.length > 0 ? (
                    filteredLocalHistory.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filteredLocalHistory.map((item) => (
                          <div
                            key={item.id}
                            className="history-item-card"
                            onClick={() => setViewingPastCheck(item)}
                            style={{ margin: 0, borderLeft: '4px solid var(--local)' }}
                          >
                            <div className="history-date-only">{item.date}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', margin: '20px 0' }}>לא נמצאו תוצאות.</p>
                    )
                  ) : (
                    <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', margin: '20px 0' }}>אין היסטוריה מקומית.</p>
                  )}
                </div>

                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '1rem', background: 'var(--local)', borderColor: 'var(--local)', marginTop: 'auto' }}
                  onClick={() => onStartCheck('local')}
                >
                  בד"ח מקומי חדש +
                </button>
              </div>

            </div>
          </div>

        </div>

        <div style={{ background: '#ffffff', padding: '25px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <h4 style={{ color: '#1f2937', margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📌</span> תזכורות לדירה
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', paddingBottom: '25px', borderBottom: '1px solid #f1f5f9' }}>
            {sortedReminders.length > 0 ? (
              sortedReminders.map(reminder => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const nextMonth = new Date(today);
                nextMonth.setMonth(today.getMonth() + 1);

                const reminderDate = new Date(reminder.date);
                reminderDate.setHours(0, 0, 0, 0);

                const isPast = reminderDate < today;
                const isSoon = !isPast && reminderDate <= nextMonth;

                let cardBg = '#f9fafb';
                let cardBorder = '#e5e7eb';
                let dateBg = '#1f2937';
                let textCol = '#374151';
                let textWeight = '400';

                if (isPast) {
                  cardBg = '#fef2f2';
                  cardBorder = '#fca5a5';
                  dateBg = '#ef4444';
                  textCol = '#991b1b';
                  textWeight = '500';
                } else if (isSoon) {
                  cardBg = '#fff7ed';
                  cardBorder = '#fdba74';
                  dateBg = '#ea580c';
                  textCol = '#9a3412';
                  textWeight = '500';
                }

                return (
                  <div
                    key={reminder.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '16px',
                      background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <button
                      onClick={() => handleDeleteReminder(reminder.id)}
                      style={{ position: 'absolute', top: '10px', left: '10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                      title="מחק / סומן כבוצע"
                    >
                      <span style={{ fontSize: '14px' }}>🗑️</span>
                    </button>

                    <div style={{ alignSelf: 'flex-start', background: dateBg, color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                      {reminder.date.split('-').reverse().join('/')}
                    </div>
                    <span style={{ fontSize: '1.05rem', color: textCol, fontWeight: textWeight, paddingLeft: '35px', lineHeight: '1.4' }}>
                      {reminder.text}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed #d1d5db', borderRadius: '12px', color: '#9ca3af', fontSize: '0.95rem' }}>
                אין תזכורות פעילות לדירה זו.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="מה צריך לזכור?"
              className="input-field"
              style={{ padding: '10px' }}
              value={newReminderText}
              onChange={(e) => setNewReminderText(e.target.value)}
            />
            <input
              type="date"
              className="input-field"
              style={{ padding: '10px', cursor: 'pointer' }}
              value={newReminderDate}
              onChange={(e) => setNewReminderDate(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={handleAddReminder}
              style={{ marginTop: '5px' }}
            >
              הוסף תזכורת
            </button>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

export default ApartmentDetails;
