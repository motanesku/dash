import useStore from '../lib/store.js'

const TABS = [
  { id:'dashboard',   icon:'◈', label:'Dashboard' },
  { id:'positions',   icon:'▦', label:'Poziții' },
  { id:'transactions',icon:'≡', label:'Tranzacții' },
  { id:'club',        icon:'◉', label:'Club' },
]

export default function Nav() {
  const { tab, setTab, isAdmin } = useStore()
  return (
    <nav style={{display:'flex',alignItems:'center',padding:'0 20px',borderBottom:'1px solid var(--border)',background:'rgba(10,14,26,0.7)',backdropFilter:'blur(8px)',overflowX:'auto',WebkitOverflowScrolling:'touch',gap:2}}>
      {TABS.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{
          display:'flex',alignItems:'center',gap:6,padding:'14px 16px',
          background:'none',border:'none',borderBottom:`2px solid ${tab===t.id?'var(--blue)':'transparent'}`,
          color:tab===t.id?'var(--text)':'var(--text3)',
          fontFamily:'var(--sans)',fontSize:12,fontWeight:tab===t.id?600:400,
          cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s',
        }}>
          <span style={{fontFamily:'var(--mono)',fontSize:14,color:tab===t.id?'var(--blue)':'var(--text3)'}}>{t.icon}</span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
      {!isAdmin&&<span style={{marginLeft:'auto',fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',padding:'4px 8px',borderRadius:4,background:'var(--surface)',border:'1px solid var(--border)',whiteSpace:'nowrap'}}>👁 VIEW ONLY</span>}
    </nav>
  )
}
