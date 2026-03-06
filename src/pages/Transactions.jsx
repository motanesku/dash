import { useMemo, useState } from 'react'
import useStore from '../lib/store.js'
import { fmtC } from '../lib/portfolio.js'

export default function Transactions({ onEditTx }) {
  const { txs, deleteTx, isAdmin } = useStore()
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const sorted = useMemo(() => {
    return [...txs]
      .filter(t => filter==='ALL'||t.type===filter)
      .filter(t => !search || t.symbol?.toLowerCase().includes(search.toLowerCase()) || t.broker?.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => new Date(b.date)-new Date(a.date))
  }, [txs, filter, search])

  const TYPE_COLORS = { BUY:'var(--green)', SELL:'var(--red)', DEPOSIT:'var(--blue)' }
  const TYPE_BG = { BUY:'var(--green-bg)', SELL:'var(--red-bg)', DEPOSIT:'var(--blue-bg)' }
  const TYPE_BORDER = { BUY:'var(--green-b)', SELL:'var(--red-b)', DEPOSIT:'var(--blue-b)' }

  return (
    <div className="fade-up">
      {/* Controls */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input className="input" placeholder="🔍 Caută symbol, broker..." value={search}
          onChange={e=>setSearch(e.target.value)} style={{maxWidth:240,flex:1}}/>
        <div style={{display:'flex',gap:6}}>
          {['ALL','BUY','SELL','DEPOSIT'].map(t=>(
            <button key={t} onClick={()=>setFilter(t)} style={{
              padding:'7px 12px',borderRadius:6,border:`1px solid ${filter===t?(TYPE_BORDER[t]||'var(--blue-b)'):'var(--border2)'}`,
              background:filter===t?(TYPE_BG[t]||'var(--blue-bg)'):'var(--surface)',
              color:filter===t?(TYPE_COLORS[t]||'var(--blue)'):'var(--text3)',
              fontSize:11,fontWeight:600,cursor:'pointer',transition:'all .15s',
            }}>{t}</button>
          ))}
        </div>
        <span style={{marginLeft:'auto',fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>{sorted.length} tranzacții</span>
      </div>

      <div className="card" style={{overflow:'hidden'}}>
        <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
          <table className="data-table" style={{minWidth:580}}>
            <thead><tr>
              <th>Dată</th>
              <th>Tip</th>
              <th>Symbol</th>
              <th>Acțiuni</th>
              <th>Preț</th>
              <th>Total</th>
              <th>Broker</th>
              {isAdmin&&<th/>}
            </tr></thead>
            <tbody>
              {sorted.map(tx=>(
                <tr key={tx.id}>
                  <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{tx.date}</td>
                  <td>
                    <span style={{
                      display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:4,
                      fontSize:10,fontWeight:700,
                      background:TYPE_BG[tx.type]||'var(--surface2)',
                      color:TYPE_COLORS[tx.type]||'var(--text)',
                      border:`1px solid ${TYPE_BORDER[tx.type]||'var(--border)'}`,
                    }}>{tx.type}</span>
                  </td>
                  <td style={{fontFamily:'var(--mono)',fontWeight:700}}>{tx.symbol||'—'}</td>
                  <td style={{fontFamily:'var(--mono)',color:'var(--text2)'}}>{tx.type==='DEPOSIT'?'—':tx.shares}</td>
                  <td style={{fontFamily:'var(--mono)',color:'var(--text2)'}}>{fmtC(tx.price)}</td>
                  <td style={{fontFamily:'var(--mono)',fontWeight:600}}>{tx.type==='DEPOSIT'?fmtC(tx.price):fmtC(tx.shares*tx.price)}</td>
                  <td>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:3,background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text3)'}}>{tx.broker}</span>
                  </td>
                  {isAdmin&&<td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-ghost btn-sm" style={{padding:'3px 7px',fontSize:11}} onClick={()=>onEditTx(tx)}>✏</button>
                      <button className="btn btn-danger btn-sm" style={{padding:'3px 7px',fontSize:11}} onClick={()=>{ if(confirm('Ștergi tranzacția?')) deleteTx(tx.id) }}>✕</button>
                    </div>
                  </td>}
                </tr>
              ))}
              {sorted.length===0&&<tr><td colSpan={isAdmin?8:7} style={{textAlign:'center',color:'var(--text3)',padding:'40px'}}>Nicio tranzacție</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
