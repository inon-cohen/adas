function Login({ email, setEmail, password, setPassword, handleLogin, loginError }) {
  return (
    <div className="login-page">
      {/* שכבת הכהות/גוון המותג מוגדרת כעת ב-App.css (login-overlay) */}
      <div className="login-overlay">
        <div className="login-content">
          <h1 className="login-title">מערכת ניהול ותחזוקת נכסים</h1>
          <div className="login-card glass-effect">
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <input 
                type="email" 
                placeholder="אימייל" 
                className="input-field" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
              <input 
                type="password" 
                placeholder="סיסמה" 
                className="input-field" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              {loginError && <p style={{ color: '#ef4444', margin: 0, fontSize: '0.9rem' }}>{loginError}</p>}
              <button type="submit" className="btn-primary">התחבר</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;