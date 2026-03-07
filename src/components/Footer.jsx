// Footer cu logo Motanescu

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer style={{
      width: '100%',
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      borderTop: '1px solid var(--border)',
      background: 'var(--bg)',
      marginTop: 'auto',
    }}>
      {/* Motanul SVG - văzut din spate, cu coada ridicată */}
      <svg width="38" height="34" viewBox="0 0 38 34" fill="none" style={{opacity:0.7}}>
        {/* Corp */}
        <ellipse cx="17" cy="22" rx="10" ry="8" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        {/* Cap */}
        <ellipse cx="7" cy="15" rx="6" ry="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        {/* Ureche stânga */}
        <path d="M3 11 L1 6 L6 10" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round"/>
        {/* Ureche dreapta */}
        <path d="M9 10 L11 5.5 L13 10" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round"/>
        {/* Ochi x */}
        <path d="M5 14.5 L6.2 15.7 M6.2 14.5 L5 15.7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        {/* Bot/mustati */}
        <path d="M7 17 L4 17.5 M7 17 L10 17.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
        <circle cx="7" cy="17" r="0.7" fill="currentColor"/>
        {/* Picioare față */}
        <path d="M10 29 L10 34" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M15 30 L15 34" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        {/* Picioare spate */}
        <path d="M20 30 L20 34" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M25 29 L25 34" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        {/* Coada ridicată */}
        <path d="M27 20 Q34 14 33 7 Q32.5 4 30 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        {/* Linii pe fund (detaliu comic) */}
        <path d="M28 21 L31 19.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
        <path d="M28 23 L32 22" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
      </svg>

      <div style={{display:'flex',flexDirection:'column',gap:1}}>
        <span style={{
          fontFamily:'Georgia, serif',
          fontStyle:'italic',
          fontSize:13,
          letterSpacing:'0.12em',
          color:'var(--text3)',
          fontWeight:400,
        }}>
          MOTANESKU — {year}
        </span>
        <span style={{
          fontFamily:'var(--mono)',
          fontSize:9,
          color:'var(--text3)',
          opacity:0.5,
          letterSpacing:'0.08em',
        }}>
            - PORTFOLIO TRACKER -
        </span>
      </div>
    </footer>
  )
}
