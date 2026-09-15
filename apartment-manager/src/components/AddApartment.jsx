import { useState } from 'react';
import { motion } from 'framer-motion';

function AddApartment({ setIsAddingApartment }) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalImage = image !== '' ? image : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

    try {
      // שליחת הנתונים לשרת ולמסד הנתונים
      const response = await fetch('http://localhost:5000/api/apartments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name, image_url: finalImage })
      });

      if (!response.ok) {
        throw new Error('שגיאה בשמירת הדירה בשרת');
      }

      // חזרה למסך הראשי (שיגרום לריאקט למשוך את הרשימה המעודכנת מהשרת)
      setIsAddingApartment(false);
    } catch (error) {
      console.error('שגיאה:', error);
      alert('אירעה שגיאה בשמירת הדירה במסד הנתונים. ודא שהשרת פועל.');
    }
  };

  return (
    <motion.div 
      className="details-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ maxWidth: '600px', margin: '0 auto' }}
    >
      <h2 style={{ color: '#111827', marginTop: 0, marginBottom: '25px', fontSize: '1.8rem', fontWeight: '600' }}>
        הוספת דירה חדשה
      </h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.95rem', color: '#4b5563', fontWeight: '500' }}>שם הדירה</label>
          <input type="text" required className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.95rem', color: '#4b5563', fontWeight: '500' }}>תמונת הדירה (אופציונלי)</label>
          
          <label 
            style={{ border: '2px dashed #d1d5db', padding: '20px', textAlign: 'center', borderRadius: '12px', cursor: 'pointer', backgroundColor: '#f9fafb', transition: 'all 0.3s ease' }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#4f46e5'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
          >
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            {image ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <img src={image} alt="תצוגה מקדימה" style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <span style={{ fontSize: '0.9rem', color: '#6b7280', textDecoration: 'underline' }}>החלף תמונה</span>
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>
                <span style={{ display: 'block', fontSize: '1.8rem', marginBottom: '5px' }}>📸</span>
                לחץ כאן כדי לבחור תמונה מהמחשב
              </div>
            )}
          </label>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>שמור והוסף דירה</button>
          <button type="button" className="btn-secondary" onClick={() => setIsAddingApartment(false)} style={{ flex: 1 }}>ביטול</button>
        </div>
      </form>
    </motion.div>
  );
}

export default AddApartment;