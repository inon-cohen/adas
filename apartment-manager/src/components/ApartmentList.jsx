import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function ApartmentList({ setSelectedApartment, setIsAddingApartment }) {
  const [localApartments, setLocalApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apartmentToEdit, setApartmentToEdit] = useState(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');

  // משיכת הנתונים מהשרת שלנו ברגע שהמסך עולה
  useEffect(() => {
    fetch('http://localhost:5000/api/apartments')
      .then(res => {
        if (!res.ok) throw new Error('תקלה בקבלת הדירות');
        return res.json();
      })
      .then(data => {
        // מתאימים את השמות מהדאטה-בייס למשתנים של ריאקט
        const mappedApartments = data.map(apt => ({
          id: apt.id,
          name: apt.name,
          image: apt.image_url,
          lastChecked: apt.last_checked ? new Date(apt.last_checked).toLocaleDateString('he-IL') : 'טרם נבדק',
          hasCriticalIssue: apt.has_critical_issue
        }));
        setLocalApartments(mappedApartments);
        setLoading(false);
      })
      .catch(err => {
        console.error('שגיאה בטעינת הדירות:', err);
        setLoading(false);
      });
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  // מחיקת דירה קומפלט מהשרת וממסד הנתונים
  const handleDelete = async (e, id) => {
    e.stopPropagation(); 
    if (window.confirm('האם אתה בטוח שברצונך למחוק דירה זו? הפעולה אינה הפיכה ותמחק את כל התזכורות וההיסטוריה שלה.')) {
      try {
        const response = await fetch(`http://localhost:5000/api/apartments/${id}`, {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error('שגיאה במחיקת הדירה מהשרת');

        const updatedApartments = localApartments.filter(a => a.id !== id);
        setLocalApartments(updatedApartments); 
      } catch (error) {
        console.error('שגיאה במחיקה:', error);
        alert('אירעה שגיאה במחיקת הדירה ממסד הנתונים.');
      }
    }
  };

  const openEditModal = (e, apt) => {
    e.stopPropagation();
    setApartmentToEdit(apt);
    setEditName(apt.name);
    setEditImage(apt.image);
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // שמירת עריכת הדירה בשרת ובמסד הנתונים
  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5000/api/apartments/${apartmentToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, image_url: editImage })
      });

      if (!response.ok) throw new Error('שגיאה בעדכון הדירה בשרת');

      const updatedApartments = localApartments.map(apt => 
        apt.id === apartmentToEdit.id ? { ...apt, name: editName, image: editImage } : apt
      );
      setLocalApartments(updatedApartments); 
      setApartmentToEdit(null); 
    } catch (error) {
      console.error('שגיאה בעריכה:', error);
      alert('אירעה שגיאה בשמירת השינויים במסד הנתונים.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2rem', color: '#6b7280' }}>
        טוען דירות מהשרת המקומי... 🔄
      </div>
    );
  }

  return (
    <div className="apartment-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <motion.h2 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ margin: 0, color: '#111827', fontWeight: '600', fontSize: '1.8rem' }}
        >
          הנכסים שלי
        </motion.h2>
        
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary"
          onClick={() => setIsAddingApartment(true)}
          style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          <span style={{ fontSize: '1.4rem', lineHeight: '1' }}>+</span>
          הוסף נכס חדש
        </motion.button>
      </div>
      
      <motion.div className="cards-grid" variants={containerVariants} initial="hidden" animate="visible">
        {localApartments.map((apt) => (
          <motion.div key={apt.id} variants={cardVariants} className="premium-card" onClick={() => setSelectedApartment(apt)} style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, display: 'flex', gap: '8px' }}>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => openEditModal(e, apt)}
                title="ערוך דירה"
                style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(4px)', border: '1px solid #e5e7eb', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}
              >
                <span style={{ fontSize: '18px', display: 'block', lineHeight: '1' }}>✏️</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => handleDelete(e, apt.id)}
                title="מחק דירה"
                style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(4px)', border: '1px solid #fee2e2', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}
              >
                <span style={{ fontSize: '18px', display: 'block', lineHeight: '1' }}>🗑️</span>
              </motion.button>
            </div>

            <div className="card-image-container">
              <img src={apt.image} alt={apt.name} className="card-image" />
            </div>
            
            <div className="card-content">
              <h3 className="card-title">{apt.name}</h3>
              <p className="card-info">בדיקה אחרונה: {apt.lastChecked}</p>
              
              {apt.hasCriticalIssue ? (
                <span className="status-badge status-critical">
                  <span style={{ marginRight: '5px' }}>🔴</span> דורש טיפול קריטי
                </span>
              ) : (
                <span className="status-badge status-ok">
                  <span style={{ marginRight: '5px' }}>🟢</span> הכל תקין
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {apartmentToEdit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setApartmentToEdit(null)}
          >
            <motion.div 
              className="details-card"
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '500px', margin: 0, padding: '40px' }}
            >
              <h2 style={{ color: '#111827', marginTop: 0, marginBottom: '25px', fontSize: '1.6rem', fontWeight: '600' }}>
                עריכת דירה
              </h2>
              
              <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.95rem', color: '#4b5563', fontWeight: '500' }}>שם הדירה</label>
                  <input type="text" required className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.95rem', color: '#4b5563', fontWeight: '500' }}>תמונת הדירה</label>
                  
                  <label 
                    style={{ border: '2px dashed #d1d5db', padding: '15px', textAlign: 'center', borderRadius: '12px', cursor: 'pointer', backgroundColor: '#f9fafb', transition: 'all 0.3s ease' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#4f46e5'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  >
                    <input type="file" accept="image/*" onChange={handleEditImageUpload} style={{ display: 'none' }} />
                    {editImage ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <img src={editImage} alt="תצוגה מקדימה" style={{ width: '100px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                        <span style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'underline' }}>החלף תמונה</span>
                      </div>
                    ) : (
                      <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>לחץ לבחירת תמונה חדשה</div>
                    )}
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px' }}>שמור שינויים</button>
                  <button type="button" className="btn-secondary" onClick={() => setApartmentToEdit(null)} style={{ flex: 1, padding: '12px' }}>ביטול</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ApartmentList;