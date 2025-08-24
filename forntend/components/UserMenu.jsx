import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

function decodeJWT(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState({ name: '', assistant_id: '', phone: '', role: '' });
  const menuRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (token) {
      const decoded = decodeJWT(token);
      setUser({
        name: decoded?.name || '',
        assistant_id: decoded?.assistant_id || '',
        phone: decoded?.phone || '',
        role: decoded?.role || ''
      });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    router.push('/');
  };

  const handleManageAssistants = () => {
    router.push('/manage_assistants');
  };

  const handleEditProfile = () => {
    router.push('/manage_assistants/edit_my_profile');
  };

  const handleContactDeveloper = () => {
    router.push('/contact_developer');
  };

  return (
    <div style={{ position: 'relative', marginRight: 32 }} ref={menuRef}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? '0 2px 8px rgba(31,168,220,0.15)' : 'none',
          border: open ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          transition: 'box-shadow 0.2s, border 0.2s'
        }}
        onClick={() => setOpen((v) => !v)}
        title={user.name || user.assistant_id}
      >
        {/* Use user image if available, else fallback to initial */}
        <span style={{ 
          fontWeight: 700, 
          fontSize: 22, 
          color: '#1FA8DC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          lineHeight: 1,
          textAlign: 'center'
        }}>
          {user.name ? user.name[0].toUpperCase() : (user.assistant_id ? user.assistant_id[0].toUpperCase() : 'U')}
        </span>
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: 54,
          right: 0,
          minWidth: 270,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(31,168,220,0.18)',
          border: '1.5px solid #e9ecef',
          zIndex: 100,
          padding: '0 0 8px 0',
        }}>
          <div style={{
            padding: '18px 20px 12px 20px',
            borderBottom: '1px solid #e9ecef',
            textAlign: 'left',
            marginBottom: 8
          }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1FA8DC', marginBottom: 2 }}>{user.name || user.assistant_id}</div>
            <div style={{ color: '#495057', fontSize: 15, fontWeight: 600 }}>
              {user.assistant_id ? `ID: ${user.assistant_id}` : 'No ID'}
            </div>
          </div>
          <button style={menuBtnStyle} onClick={handleLogout}>Logout</button>
          {user.role === 'admin' && (
            <button style={menuBtnStyle} onClick={handleManageAssistants}>Manage Assistants</button>
          )}
          <button style={menuBtnStyle} onClick={handleEditProfile}>Edit My Profile</button>
          <button style={menuBtnStyle} onClick={handleContactDeveloper}>Contact Developer</button>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle = {
  width: '100%',
  background: 'none',
  border: 'none',
  color: '#1FA8DC',
  fontWeight: 700,
  fontSize: 16,
  padding: '10px 20px',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 8,
  transition: 'background 0.15s',
  marginBottom: 2,
  outline: 'none',
}; 