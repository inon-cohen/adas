import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './components/Login';
import ApartmentList from './components/ApartmentList';
import ApartmentDetails from './components/ApartmentDetails';
import AddApartment from './components/AddApartment';
import NewCheck from './components/NewCheck';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [isAddingApartment, setIsAddingApartment] = useState(false);
  const [isPerformingCheck, setIsPerformingCheck] = useState(false);
  const [viewingPastCheck, setViewingPastCheck] = useState(null);

  // טיוטת בדיקה שממשיכים לערוך (אם נלחץ "המשך" על טיוטה פתוחה במסך הדירה)
  const [draftToResume, setDraftToResume] = useState(null);

  // הסטייט שמחזיק את התמונה המוגדלת (אם לחצו על תמונה)
  const [enlargedImage, setEnlargedImage] = useState(null);

  // פתיחת מסך בדיקה - בדיקה חדשה (draft=null) או המשך טיוטה קיימת (draft מלא מהשרת)
  const startCheck = (type, draft = null) => {
    setDraftToResume(draft);
    setIsPerformingCheck(type);
  };

  // סגירת מסך הבדיקה וחזרה לדף הדירה
  const exitCheckScreen = () => {
    setIsPerformingCheck(false);
    setDraftToResume(null);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === 'inon@gmail.com' && password === '1234') {
      setUser({ email, role: 'worker' });
      setLoginError('');
    } else if (email === 'inon2@gmail.com' && password === '12345') {
      setUser({ email, role: 'viewer' });
      setLoginError('');
    } else {
      setLoginError('אימייל או סיסמה שגויים');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setEmail('');
    setPassword('');
    setSelectedApartment(null);
    setIsAddingApartment(false);
    setIsPerformingCheck(false);
    setDraftToResume(null);
    setViewingPastCheck(null);
    setEnlargedImage(null);
  };

  // פונקציה מובנית למחיקת דו"ח בדיקה ספציפי מההיסטוריה (תומכת במקומי ומרחוק באופן דינמי)
  const handleDeleteCheck = async () => {
    if (!viewingPastCheck) return;
    
    if (window.confirm('האם אתה בטוח שברצונך למחוק דו"ח בדיקה זה מההיסטוריה? הפעולה אינה הפיכה ותמחק גם את כל הקבצים המשויכים אליה.')) {
      try {
        // בחירת הראוט המתאים בשרת לפי סוג הבדיקה הנוכחי
        const apiRoute = viewingPastCheck.type === 'local' ? 'local_checks' : 'checks';
        
        const response = await fetch(`http://localhost:5000/api/${apiRoute}/${viewingPastCheck.id}`, {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error('שגיאה במחיקת הדו"ח מהשרת');

        alert('דו"ח הבדיקה נמחק בהצלחה ממסד הנתונים');
        setViewingPastCheck(null); 
      } catch (error) {
        console.error('שגיאה בתהליך המחיקה:', error);
        alert('אירעה שגיאה במחיקת הדו"ח. ודא שהשרת פועל כראוי.');
      }
    }
  };

  // בונה את בלוק ה-HTML של מדור אחד (IT או YT) בתוך מסמך ה-Word
  const buildWordCategorySection = (label, icon, accentColor, tasksInCategory) => {
    if (!tasksInCategory || tasksInCategory.length === 0) {
      return `
        <h3 class="section-title" style="border-color: ${accentColor};">${icon} ${label}</h3>
        <p class="empty-note">לא בוצעו בדיקות במדור זה.</p>
      `;
    }

    let rows = '';
    tasksInCategory.forEach((t, index) => {
      const statusHtml = t.status === 'תקין'
        ? '<span class="status-ok">תקין ✓</span>'
        : t.status === 'דורש טיפול'
          ? '<span class="status-critical">דורש טיפול ✕</span>'
          : '<span class="status-neutral">לא נבדק</span>';

      rows += `
        <div class="task-item">
          <p class="task-title"><strong>${index + 1}. ${t.task || 'ללא תיאור'}</strong> — ${statusHtml}</p>
          ${t.notes ? `<p class="notes"><strong>הערות:</strong> ${t.notes}</p>` : ''}
          ${t.image ? `
            <div class="img-container">
              ${t.image.startsWith('data:image/')
                ? `<img src="${t.image}" width="320" style="border-radius: 6px; border: 1px solid #d1d5db;" alt="ממצא בשטח" />`
                : '<span class="file-badge">📄 צורף קובץ מסמך/PDF (ניתן לצפייה והורדה ישירות מתוך המערכת)</span>'
              }
            </div>
          ` : ''}
        </div>
      `;
    });

    return `
      <h3 class="section-title" style="border-color: ${accentColor};">${icon} ${label}</h3>
      ${rows}
    `;
  };

  // פונקציה לייצוא דו"ח הבדיקה לקובץ Word (.doc) רשמי, מוכן להפצה לבעל הדירה
  const exportToWord = () => {
    if (!viewingPastCheck) return;

    const tasks = viewingPastCheck.tasks || [];
    const itTasks = tasks.filter(t => (t.category || 'IT') === 'IT');
    const ytTasks = tasks.filter(t => t.category === 'YT');

    const apartmentDisplayName = selectedApartment ? selectedApartment.name : 'נכס';

    const htmlHead = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8" />
        <title>דו"ח בדיקה רשמי - ${apartmentDisplayName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; text-align: right; padding: 10px 30px 30px; color: #1f2937; }
          .letterhead { border-bottom: 4px solid #4f46e5; padding-bottom: 18px; margin-bottom: 22px; }
          .letterhead .kicker { color: #4f46e5; font-weight: bold; letter-spacing: 1px; font-size: 12px; text-transform: uppercase; margin: 0 0 6px 0; }
          .letterhead h1 { color: #111827; font-size: 26px; font-weight: bold; margin: 0 0 4px 0; }
          .letterhead .subtitle { color: #6b7280; font-size: 14px; margin: 0; }
          .meta-box { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px 18px; border-radius: 8px; margin-bottom: 28px; }
          .meta-box table { width: 100%; border-collapse: collapse; }
          .meta-box td { padding: 4px 0; font-size: 14px; color: #374151; vertical-align: top; }
          .meta-box td.meta-label { color: #6b7280; width: 160px; font-weight: bold; }
          .section-title { color: #111827; margin-top: 30px; margin-bottom: 14px; font-size: 18px; font-weight: bold; border-bottom: 3px solid #4f46e5; padding-bottom: 6px; }
          .empty-note { color: #9ca3af; font-size: 13px; font-style: italic; margin: 0 0 10px 0; }
          .task-item { border: 1px solid #e5e7eb; padding: 14px 16px; margin-bottom: 12px; border-radius: 8px; background-color: #ffffff; }
          .task-title { font-size: 15px; color: #1f2937; margin: 0 0 6px 0; }
          .status-ok { color: #16a34a; font-weight: bold; }
          .status-critical { color: #dc2626; font-weight: bold; }
          .status-neutral { color: #9ca3af; }
          .notes { color: #6b7280; font-size: 13px; margin: 6px 0 0 0; background: #fdfbf7; padding: 6px 10px; border-right: 3px solid #fdba74; }
          .img-container { margin-top: 12px; }
          .file-badge { color: #4b5563; font-size: 13px; font-style: italic; background: #f3f4f6; padding: 6px 12px; border-radius: 4px; display: inline-block; }
        </style>
      </head>
      <body>
    `;

    const htmlBody = `
      <div class="letterhead">
        <p class="kicker">דו"ח בדיקה תקופתית לבעל הנכס</p>
        <h1>${apartmentDisplayName}</h1>
        <p class="subtitle">מערכת ניהול ותחזוקת נכסים</p>
      </div>

      <div class="meta-box">
        <table>
          <tr>
            <td class="meta-label">תאריך ביצוע הבדיקה:</td>
            <td>${viewingPastCheck.date}</td>
          </tr>
          <tr>
            <td class="meta-label">סוג בדיקה:</td>
            <td>${viewingPastCheck.type === 'local' ? 'בד"ח מקומי (פיזי בשטח)' : 'בדיקה מערכתית מרחוק'}</td>
          </tr>
          <tr>
            <td class="meta-label">נבדק על ידי:</td>
            <td>${viewingPastCheck.inspector || 'לא צוין'}</td>
          </tr>
          <tr>
            <td class="meta-label">סיכום כללי:</td>
            <td>${viewingPastCheck.summary || 'אין הערות נוספות'}</td>
          </tr>
        </table>
      </div>

      ${buildWordCategorySection('בדיקות ועדכוני IT', '🖥️', '#4f46e5', itTasks)}
      ${buildWordCategorySection('בדיקות ועדכוני YT', '🛠️', '#d97706', ytTasks)}
    `;

    const htmlFoot = '</body></html>';
    const fullHtml = htmlHead + htmlBody + htmlFoot;

    const blob = new Blob(['﻿' + fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const safeDate = viewingPastCheck.date.replace(/\//g, '-');
    const apartmentName = selectedApartment ? selectedApartment.name.replace(/\s+/g, '_') : 'דירה';

    a.href = url;
    a.download = `דוח_רשמי_${apartmentName}_${safeDate}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} handleLogin={handleLogin} loginError={loginError} />;
  }

  return (
    <div className="app-container">
      <header className="main-header">
        <h1>מערכת ניהול ותחזוקת נכסים</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span>מחובר: <strong style={{ color: '#4f46e5', fontWeight: '600' }}>{user.role === 'worker' ? 'מתחזק' : 'צופה'}</strong></span>
          <button onClick={handleLogout} className="btn-secondary">התנתק</button>
        </div>
      </header>
      
      <main>
        {viewingPastCheck ? (
          <div className="details-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '15px' }}>
              <h2 style={{ margin: 0, fontWeight: '600', color: '#111827' }}>דו"ח בדיקה מתאריך: {viewingPastCheck.date}</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-primary" style={{ padding: '10px 20px', margin: 0, fontSize: '0.95rem' }} onClick={exportToWord}>
                  ייצוא ל-Word 📄
                </button>
                {user.role === 'worker' && (
                  <button className="btn-secondary" style={{ padding: '10px 20px', margin: 0, fontSize: '0.95rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={handleDeleteCheck}>
                    מחק בדיקה 🗑️
                  </button>
                )}
                <button className="btn-secondary" onClick={() => setViewingPastCheck(null)}>חזרה לדירה</button>
              </div>
            </div>
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 10px 0' }}><strong>נבדק על ידי:</strong> {viewingPastCheck.inspector || 'לא ידוע'}</p>
              <p style={{ margin: 0 }}><strong>סיכום הבדיקה:</strong> {viewingPastCheck.summary || 'אין הערות נוספות'}</p>
            </div>
            <h3 style={{ marginBottom: '20px', fontWeight: '600', color: '#111827' }}>פירוט המשימות שבוצעו:</h3>
            <div className="section-columns">
              {[
                { key: 'IT', label: 'בדיקות ועדכוני IT', icon: '🖥️', panelClass: 'category-panel-it', headerClass: 'it' },
                { key: 'YT', label: 'בדיקות ועדכוני YT', icon: '🛠️', panelClass: 'category-panel-yt', headerClass: 'yt' }
              ].map(cat => {
                const catTasks = (viewingPastCheck.tasks || []).filter(t => (t.category || 'IT') === cat.key);
                return (
                  <div key={cat.key} className={`category-panel ${cat.panelClass}`}>
                    <div className={`category-panel-header ${cat.headerClass}`}>
                      <span>{cat.icon}</span> {cat.label}
                    </div>
                    {catTasks.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {catTasks.map((t, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '13px', border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white' }}>
                            <span style={{ fontSize: '1.1rem', marginTop: '2px' }}>{t.status === 'תקין' ? '✅' : t.status === 'דורש טיפול' ? '🔴' : '⚪'}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                              <span style={{ fontSize: '1rem', color: '#1f2937', fontWeight: '500' }}>{t.task}</span>
                              {t.notes && <span style={{ fontSize: '0.88rem', color: '#6b7280', marginTop: '4px' }}>הערות: {t.notes}</span>}
                              {t.image && (
                                <div style={{ marginTop: '10px' }}>
                                  {t.image.startsWith('data:image/') ? (
                                    <img
                                      src={t.image}
                                      alt="תמונת בדיקה"
                                      onClick={() => setEnlargedImage(t.image)}
                                      style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor: 'zoom-in' }}
                                    />
                                  ) : (
                                    <a
                                      href={t.image}
                                      download={`קובץ_בדיקה_${i + 1}`}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f3f4f6', color: '#374151', textDecoration: 'none', borderRadius: '8px', border: '1px solid #d1d5db', fontWeight: '500', fontSize: '0.88rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                    >
                                      📄 הורד קובץ צורף
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="category-empty-hint">לא בוצעו בדיקות במדור זה.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : isPerformingCheck ? (
          /* הוספת משתנה סוג הבדיקה (מקומי/מרחוק) אל הרכיב שמייצר את הבדיקה, כולל תמיכה בהמשך טיוטה */
          <NewCheck
            selectedApartment={selectedApartment}
            setIsPerformingCheck={setIsPerformingCheck}
            checkType={isPerformingCheck}
            draftToResume={draftToResume}
            onExit={exitCheckScreen}
          />
        ) : isAddingApartment ? (
          <AddApartment setIsAddingApartment={setIsAddingApartment} />
        ) : !selectedApartment ? (
          <ApartmentList setSelectedApartment={setSelectedApartment} setIsAddingApartment={setIsAddingApartment} />
        ) : (
          <ApartmentDetails selectedApartment={selectedApartment} setSelectedApartment={setSelectedApartment} onStartCheck={startCheck} setViewingPastCheck={setViewingPastCheck} />
        )}
      </main>

      {/* חלון פופ-אפ לתמונה מוגדלת (Lightbox) */}
      <AnimatePresence>
        {enlargedImage && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setEnlargedImage(null)}
          >
            <button 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', color: 'black', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
              onClick={() => setEnlargedImage(null)}
            >
              ✖
            </button>
            <motion.img 
              initial={{ scale: 0.9 }} 
              animate={{ scale: 1 }} 
              exit={{ scale: 0.9 }}
              src={enlargedImage} 
              alt="תמונה מוגדלת" 
              style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', cursor: 'zoom-out' }}
              onClick={(e) => e.stopPropagation()} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;