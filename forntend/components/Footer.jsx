export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer" style={{
      position: 'absolute',
      bottom: '-70px',
      left: 0,
      right: 0,
      width: '100%',
      background: 'transparent',
      padding: '10px 0',
      textAlign: 'center',
      color: '#495057',
      fontWeight: 600,
      fontSize: 16,
      letterSpacing: 0.5,
      borderTop: '2px solid #e9ecef',
      zIndex: 1
    }}>
      Copyright &copy; {year} - TopPhysics

      <style jsx>{`
        @media (max-width: 768px) {
          span {
            font-size: 20px !important;
            letter-spacing: 0.8px !important;
          }
        }
        @media (max-width: 480px) {
          .footer {
            bottom: -10px !important;
          }
        }
      `}</style>
    </footer>
  );
} 