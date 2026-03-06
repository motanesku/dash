import useStore from '../lib/store.js'
import { USE_CLOUD } from '../config.js'

export default function Header({ onPinClick, onAddTx, onImport, onAlerts, onRefresh }) {
  const { isAdmin, cloudLoading, cloudErr, pricesUpdated, pricesLoading, alerts } = useStore()
  const triggered = alerts.filter(a => a.triggered && !a.seen).length
  const untriggered = alerts.filter(a => !a.triggered).length

  return (
    <header style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'0 20px',height:56,
      background:'rgba(10,14,26,0.92)',backdropFilter:'blur(12px)',
      borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:50,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#4d9fff,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>📈</div>
        <div>
          <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:700,letterSpacing:1}}>PORTFOLIO</div>
          <div style={{fontSize:9,color:'var(--text3)',letterSpacing:2,fontWeight:600}}>TRACKER · LIVE</div>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span className="hide-mobile" style={{fontSize:10,fontFamily:'var(--mono)',padding:'3px 8px',borderRadius:4,
          background:cloudLoading?'var(--gold-bg)':cloudErr?'var(--red-bg)':'var(--green-bg)',
          color:cloudLoading?'var(--gold)':cloudErr?'var(--red)':'var(--green)',
          border:`1px solid ${cloudLoading?'rgba(240,180,41,0.2)':cloudErr?'var(--red-b)':'var(--green-b)'}`}}>
          {USE_CLOUD?(cloudLoading?'⟳ sync':cloudErr?'⚠ offline':'☁ synced'):'💾 local'}
        </span>
        {pricesUpdated&&<span className="hide-mobile" style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)'}}>
          ↻ {pricesUpdated.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}
        </span>}
        <button className="btn btn-ghost btn-sm" onClick={onAlerts} style={{position:'relative',padding:'6px 8px'}}>
          🔔
          {(untriggered>0||triggered>0)&&<span style={{position:'absolute',top:2,right:2,width:7,height:7,borderRadius:'50%',background:triggered>0?'var(--red)':'var(--blue)'}}/>}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh} style={{padding:'6px 10px'}}>
          <span style={{display:'inline-block',animation:pricesLoading?'pulse 1s infinite':'none'}}>⟳</span>
        </button>
        {isAdmin&&<><button className="btn btn-ghost btn-sm hide-mobile" onClick={onImport}>⬆ Import</button>
        <button className="btn btn-primary btn-sm" onClick={onAddTx}>+ Tranzacție</button></>}
        {!isAdmin?<button className="btn btn-ghost btn-sm" onClick={onPinClick}>🔐 Edit</button>
          :<button className="btn btn-ghost btn-sm" style={{color:'var(--red)'}} onClick={()=>useStore.getState().setAdmin(false)}>Logout</button>}
      </div>
    </header>
  )
}
