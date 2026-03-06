import { useState } from 'react'
import useStore from '../lib/store.js'
import { parseImportFile } from '../lib/sheets.js'
import { excelDate } from '../lib/portfolio.js'

export default function ImportModal({ onClose }) {
  const { bulkAddTxs, brokers } = useStore()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [drag, setDrag] = useState(false)

  const handleFile = file => {
    if (!file) return
    setErr(''); setRows(null)
    // inline parseImport since we need excelDate
    import('xlsx').then(XLSX => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, {type:'binary'})
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, {header:1,defval:''})
          let hi = 0
          for(let i=0;i<Math.min(data.length,10);i++){
            if(data[i].some(c=>['symbol','ticker','simbol'].includes(String(c).toLowerCase()))){hi=i;break}
          }
          const headers = data[hi].map(c=>String(c).toLowerCase().trim())
          const col = k => ['symbol','ticker','simbol','shares','qty','quantity','price','pret','date','data','type','tip','broker','notes','note'].reduce((a,_,__,arr)=>{
            const keys = {sym:['symbol','ticker','simbol'],shares:['shares','qty','quantity','cantitate'],price:['price','pret','avg price'],date:['date','data'],type:['type','tip'],broker:['broker'],notes:['notes','note','observatii']}
            return a
          }, {})
          const idx = {
            sym: ['symbol','ticker','simbol'].map(k=>headers.indexOf(k)).find(i=>i>=0)??-1,
            shares: ['shares','qty','quantity'].map(k=>headers.indexOf(k)).find(i=>i>=0)??-1,
            price: ['price','pret','avg price','avgprice'].map(k=>headers.indexOf(k)).find(i=>i>=0)??-1,
            date: ['date','data'].map(k=>headers.indexOf(k)).find(i=>i>=0)??-1,
            type: ['type','tip'].map(k=>headers.indexOf(k)).find(i=>i>=0)??-1,
            broker: ['broker'].map(k=>headers.indexOf(k)).find(i=>i>=0)??-1,
            notes: ['notes','note'].map(k=>headers.indexOf(k)).find(i=>i>=0)??-1,
          }
          if(idx.sym<0||idx.shares<0||idx.price<0){setErr('Coloane lipsă: symbol, shares, price');return}
          const out = []
          for(let i=hi+1;i<data.length;i++){
            const r=data[i]; if(!r[idx.sym])continue
            const sym=String(r[idx.sym]).toUpperCase().trim()
            const shares=parseFloat(r[idx.shares])
            const price=parseFloat(r[idx.price])
            const date=idx.date>=0?excelDate(r[idx.date]):new Date().toISOString().split('T')[0]
            const rawType=idx.type>=0?String(r[idx.type]).toUpperCase():'BUY'
            const type=rawType.includes('SELL')?'SELL':rawType.includes('DEP')?'DEPOSIT':'BUY'
            const broker=idx.broker>=0?(String(r[idx.broker]).trim()||brokers[0]):brokers[0]
            const notes=idx.notes>=0?String(r[idx.notes]):''
            const errors=[]
            if(!sym)errors.push('symbol lipsă')
            if(isNaN(shares)||shares<=0)errors.push('shares invalid')
            if(isNaN(price)||price<=0)errors.push('price invalid')
            out.push({sym,shares,price,date,type,broker,notes,errors,selected:errors.length===0})
          }
          setRows(out)
        } catch(e){setErr('Eroare: '+e.message)}
      }
      reader.readAsBinaryString(file)
    })
  }

  const toggleRow = i => setRows(p=>p.map((r,j)=>j===i?{...r,selected:!r.selected}:r))
  const toggleAll = v => setRows(p=>p.map(r=>r.errors.length===0?{...r,selected:v}:r))

  const doImport = async () => {
    const add = rows.filter(r=>r.selected&&r.errors.length===0)
    await bulkAddTxs(add.map(r=>({type:r.type,symbol:r.sym,shares:r.shares,price:r.price,date:r.date,broker:r.broker,notes:r.notes})))
    onClose()
  }

  const okRows = rows?.filter(r=>r.errors.length===0)||[]
  const selRows = rows?.filter(r=>r.selected)||[]

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:700,width:'95vw'}}>
        <div className="modal-title">⬆ Import Excel / CSV</div>

        {!rows ? (
          <div
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0])}}
            onDragOver={e=>{e.preventDefault();setDrag(true)}}
            onDragLeave={()=>setDrag(false)}
            onClick={()=>document.getElementById('imp-file').click()}
            style={{
              border:`2px dashed ${drag?'var(--blue)':'var(--border2)'}`,
              borderRadius:12,padding:'40px 20px',textAlign:'center',cursor:'pointer',
              background:drag?'var(--blue-bg)':'var(--surface2)',transition:'all .15s'
            }}
          >
            <div style={{fontSize:32,marginBottom:10}}>📁</div>
            <div style={{fontWeight:600,marginBottom:4}}>Trage fișierul aici sau click</div>
            <div style={{color:'var(--text3)',fontSize:12}}>Suportat: .xlsx, .xls, .csv</div>
            <div style={{color:'var(--text3)',fontSize:11,marginTop:8}}>Coloane necesare: symbol, shares, price | Opționale: date, type, broker, notes</div>
            <input id="imp-file" type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
          </div>
        ) : (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:13,color:'var(--text2)'}}>
                <span style={{color:'var(--green)',fontWeight:600}}>{okRows.length}</span> valide · <span style={{color:'var(--blue)',fontWeight:600}}>{selRows.length}</span> selectate
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>toggleAll(true)}>Selectează tot</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>toggleAll(false)}>Deselectează</button>
              </div>
            </div>
            <div style={{maxHeight:'50vh',overflowY:'auto',border:'1px solid var(--border)',borderRadius:8}}>
              <table className="data-table" style={{fontSize:11}}>
                <thead><tr>
                  <th>✓</th><th>Symbol</th><th>Tip</th><th>Acțiuni</th><th>Preț</th><th>Dată</th><th>Broker</th><th>Erori</th>
                </tr></thead>
                <tbody>
                  {rows.map((r,i)=>(
                    <tr key={i} style={{opacity:r.errors.length?0.4:1}}>
                      <td><input type="checkbox" checked={r.selected} onChange={()=>toggleRow(i)} disabled={r.errors.length>0}/></td>
                      <td style={{fontFamily:'var(--mono)',fontWeight:600}}>{r.sym}</td>
                      <td><span className={`badge ${r.type==='BUY'?'badge-green':r.type==='SELL'?'badge-red':'badge-blue'}`}>{r.type}</span></td>
                      <td style={{fontFamily:'var(--mono)'}}>{r.shares}</td>
                      <td style={{fontFamily:'var(--mono)'}}>{r.price}</td>
                      <td>{r.date}</td>
                      <td>{r.broker}</td>
                      <td style={{color:'var(--red)'}}>{r.errors.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {err&&<div style={{color:'var(--red)',fontSize:12,marginTop:10,padding:'8px 12px',background:'var(--red-bg)',borderRadius:6}}>{err}</div>}

        <div className="modal-footer">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Anulează</button>
          {rows&&<button className="btn btn-primary" style={{flex:1}} onClick={doImport} disabled={!selRows.length}>
            Import {selRows.length} tranzacții
          </button>}
        </div>
      </div>
    </div>
  )
}
