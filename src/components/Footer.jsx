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
      <img src="/dash/MOTANESCU.png" alt="Motanescu" style={{width:42, height:42, objectFit:'cover', borderRadius:'50%', opacity:0.75}} />

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
