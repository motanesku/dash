import { useEffect, useRef, useState } from 'react'
import useStore from './lib/store.js'
import Header from './components/Header.jsx'
import Nav from './components/Nav.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Positions from './pages/Positions.jsx'
import Transactions from './pages/Transactions.jsx'
import Club from './pages/Club.jsx'
import PinModal from './components/PinModal.jsx'
import AddTxModal from './components/AddTxModal.jsx'
import ImportModal from './components/ImportModal.jsx'
import AlertsPanel from './components/AlertsPanel.jsx'

export default function App() {
  const { tab, loadTxs, fetchAllPrices, loadClub: loadClubData, txs, prices, checkAlerts, pricesUpdated } = useStore()
  const [showPin, setShowPin] = useState(false)
  const [showAddTx, setShowAddTx] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const fetchRef = useRef(fetchAllPrices)

  useEffect(() => { fetchRef.current = fetchAllPrices }, [fetchAllPrices])

  useEffect(() => {
    loadTxs()
    loadClubData()
    if (Notification.permission === 'default') Notification.requestPermission()
  }, [])

  useEffect(() => {
    if (txs.length) fetchRef.current()
  }, [txs.map(t => t.symbol).join(',')])

  useEffect(() => {
    const id = setInterval(() => fetchRef.current(), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (pricesUpdated) checkAlerts(prices)
  }, [pricesUpdated])

  const openAddTx = (tx = null) => { setEditTx(tx); setShowAddTx(true) }

  return (
    <div className="app-shell">
      <div style={{
        position:'fixed',inset:0,zIndex:0,pointerEvents:'none',
        background:'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(77,159,255,0.06) 0%, transparent 70%)',
      }}/>
      <Header
        onPinClick={() => setShowPin(true)}
        onAddTx={() => openAddTx()}
        onImport={() => setShowImport(true)}
        onAlerts={() => setShowAlerts(true)}
        onRefresh={fetchAllPrices}
      />
      <Nav />
      <main style={{flex:1,padding:'20px 20px 40px',maxWidth:1400,width:'100%',margin:'0 auto',position:'relative',zIndex:1}}>
        {tab === 'dashboard'    && <Dashboard />}
        {tab === 'positions'    && <Positions onEditTx={openAddTx} />}
        {tab === 'transactions' && <Transactions onEditTx={openAddTx} />}
        {tab === 'club'         && <Club />}
      </main>
      {showPin    && <PinModal onClose={() => setShowPin(false)} />}
      {showAddTx  && <AddTxModal tx={editTx} onClose={() => { setShowAddTx(false); setEditTx(null) }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showAlerts && <AlertsPanel onClose={() => setShowAlerts(false)} />}
    </div>
  )
}
