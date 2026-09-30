import {useState, useEffect} from 'react'
import {Routes, Route, NavLink, Navigate, Link, useParams} from 'react-router-dom'
import {ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend} from 'recharts'
import api from './api'

const DISC = 'AI-assisted analysis. Final assessment and safety decisions remain with authorized HSE personnel.'
const SITES = ['Duliajan', 'Digboi', 'Jorhat']
const TYPES = ['Unsafe Act', 'Unsafe Condition', 'Near Miss', 'Incident']
const RULES = ['Energy Isolation', 'Hot Work', 'Confined Space', 'Line of Fire', 'Work at Height', 'Other']
const STATUS = ['Pending Review', 'Under Review', 'Reviewed', 'Further Investigation Required', 'Action Initiated', 'Closed']
const STEPS = ['Report Received', 'Text Processing', 'NLP Analysis', 'ML Prediction', 'Rule Mapping', 'Pattern Detection', 'Result Generated']
const arr = o => Object.entries(o || {}).map(([name, value]) => ({name, value}))
const err = x => x.response?.data?.detail || 'Something went wrong. Check the backend is running.'

const useGet = (url, p) => {
  const [d, setD] = useState(null), [e, setE] = useState('')
  useEffect(() => { setD(null); api.get(url, {params: p}).then(r => setD(r.data)).catch(x => setE(err(x))) }, [url, JSON.stringify(p)])
  return [d, e]
}

const Badge = ({t}) => {
  const c = ['YES', 'High'].includes(t) ? 'bg-red-100 text-red-700' : t === 'Medium' || t?.includes('Pending') || t?.includes('Further') ? 'bg-orange-100 text-orange-700'
    : ['Reviewed', 'Closed', 'NO', 'Low'].includes(t) ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${c}`}>{t}</span>
}
const Kpi = ({l, v, c = 'border-blue-500'}) => <div className={`card border-l-4 ${c}`}><div className="text-3xl font-semibold">{v ?? '-'}</div><div className="text-sm text-slate-500">{l}</div></div>
const Note = () => <p className="text-xs text-slate-500 mt-2">{DISC}</p>
const Msg = ({e}) => e ? <div className="card text-red-700 text-sm">{e}</div> : <div className="text-slate-500 text-sm p-4">Loading...</div>
const Hl = ({t = '', k = []}) => {
  if (!k.length) return t
  const re = new RegExp('(' + k.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi')
  return t.split(re).map((s, i) => i % 2 ? <mark key={i} className="bg-amber-200 px-0.5">{s}</mark> : s)
}

/* ---------- Login ---------- */
function Login({onLogin}) {
  const [f, setF] = useState({email: '', password: ''}), [show, setShow] = useState(false), [e, setE] = useState('')
  const go = async ev => {
    ev.preventDefault(); setE('')
    try { const r = (await api.post('/auth/login', f)).data; localStorage.setItem('token', r.token); localStorage.setItem('user', JSON.stringify(r.user)); onLogin(r.user) }
    catch (x) { setE(err(x)) }
  }
  return <div className="min-h-screen bg-navy flex items-center justify-center p-4">
    <form onSubmit={go} className="bg-white rounded-lg p-8 w-full max-w-sm space-y-4">
      <div className="flex items-center gap-3"><div className="w-12 h-12 rounded bg-navy text-white grid place-items-center font-bold">OIL</div>
        <div><div className="font-semibold leading-tight">SIF Precursor Detection</div><div className="text-xs text-slate-500">Oil India Limited - HSE</div></div></div>
      <div><label className="lbl">Email</label><input className="inp" value={f.email} onChange={x => setF({...f, email: x.target.value})} required/></div>
      <div><label className="lbl">Password</label><div className="flex gap-2"><input className="inp" type={show ? 'text' : 'password'} value={f.password} onChange={x => setF({...f, password: x.target.value})} required/>
        <button type="button" className="btn2" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div></div>
      {e && <p className="text-sm text-red-600">{e}</p>}
      <button className="btn w-full">Log in</button>
      <p className="text-xs text-slate-500 text-center">Forgot password? Contact your HSE administrator.</p>
      <div className="text-xs text-slate-500 border-t pt-3 space-y-1">Demo logins:
        <button type="button" className="block underline" onClick={() => setF({email: 'manager@oilindia.com', password: 'Manager@123'})}>Fill Manager</button>
        <button type="button" className="block underline" onClick={() => setF({email: 'hseadmin@oilindia.com', password: 'Admin@123'})}>Fill HSE Admin</button></div>
    </form></div>
}

/* ---------- Charts ---------- */
const BarC = ({data, keys = [['value', '#2563eb']], h = 230}) => <ResponsiveContainer height={h}><BarChart data={data}><CartesianGrid strokeDasharray="3 3"/>
  <XAxis dataKey="name" fontSize={11}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/>{keys.length > 1 && <Legend/>}{keys.map(([k, c]) => <Bar key={k} dataKey={k} fill={c}/>)}</BarChart></ResponsiveContainer>
const Box = ({t, children}) => <div className="card"><div className="text-sm font-medium mb-2">{t}</div>{children}</div>

function Charts({s, tr, ru}) {
  const sites = Object.entries(s.by_site).map(([name, v]) => ({name, Total: v.total, 'SIF potential': v.sif}))
  return <div className="grid md:grid-cols-2 gap-4">
    <Box t="SIF potential distribution"><ResponsiveContainer height={230}><PieChart><Pie data={[{name: 'SIF potential', value: s.sif}, {name: 'Non-SIF', value: s.non_sif}]} dataKey="value" innerRadius={55} outerRadius={85} label>
      <Cell fill="#dc2626"/><Cell fill="#94a3b8"/></Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></Box>
    <Box t="Reports by type"><BarC data={arr(s.by_type)}/></Box>
    <Box t="SIF-potential reports by activity"><BarC data={arr(s.sif_by_activity)} keys={[['value', '#dc2626']]}/></Box>
    <Box t="Reports by site"><BarC data={sites} keys={[['Total', '#2563eb'], ['SIF potential', '#dc2626']]}/></Box>
    <Box t="Life-Saving Rule distribution"><BarC data={arr(ru)} keys={[['value', '#ea580c']]}/></Box>
    <Box t="Monthly trend"><ResponsiveContainer height={230}><LineChart data={tr}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" fontSize={11}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/><Legend/>
      <Line dataKey="total" name="Total" stroke="#2563eb"/><Line dataKey="sif" name="SIF potential" stroke="#dc2626"/></LineChart></ResponsiveContainer></Box></div>
}

function Patterns({p}) {
  const G = ({t, items}) => <Box t={t}>{items.length ? items.map(i => <div key={i.name} className="mb-2"><div className="flex justify-between text-sm"><span>{i.name}</span><b>{i.count}</b></div>
    <div className="h-1.5 bg-slate-100 rounded"><div className="h-1.5 bg-red-500 rounded" style={{width: `${(i.count / items[0].count) * 100}%`}}/></div></div>) : <p className="text-sm text-slate-500">No data yet.</p>}</Box>
  return <div className="grid md:grid-cols-2 gap-4"><G t="Repeated activity" items={p.activities}/><G t="Repeated location" items={p.locations}/>
    <G t="Repeated barrier failure" items={p.barrier_failures}/><G t="Repeated hazard" items={p.hazards}/></div>
}

/* ---------- Tables / lists ---------- */
function Table({rows}) {
  if (!rows.length) return <div className="card text-sm text-slate-500">No reports match. Submit a report or change the filters.</div>
  return <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
    {['Report ID', 'Date', 'Site', 'Location', 'Type', 'Activity', 'SIF', 'Conf.', 'Life-Saving Rule', 'Priority', 'Review'].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id} className="border-t hover:bg-slate-50">
      <td className="px-3 py-2"><Link className="text-blue-700 underline" to={`/reports/${r.id}`}>{r.report_id}</Link></td><td className="px-3">{r.date}</td><td className="px-3">{r.site}</td><td className="px-3">{r.location}</td>
      <td className="px-3">{r.type}</td><td className="px-3">{r.activity}</td><td className="px-3"><Badge t={r.analysis.sif_potential}/></td><td className="px-3">{r.analysis.confidence}%</td>
      <td className="px-3">{r.analysis.life_saving_rule}</td><td className="px-3"><Badge t={r.analysis.priority}/></td><td className="px-3"><Badge t={r.review.status}/></td></tr>)}</tbody></table></div>
}

function Reports({title, preset = {}, admin, batch}) {
  const [f, setF] = useState({q: '', type: '', site: '', sif: '', priority: '', rule: '', status: ''}), [bs, setBs] = useState(null), [be, setBe] = useState(''), [n, setN] = useState(0)
  const p = {...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), ...preset, n}
  const [rows, e] = useGet('/reports', p)
  const Sel = ({k, o, l}) => <select className="inp" value={f[k]} onChange={x => setF({...f, [k]: x.target.value})}><option value="">{l}</option>{o.map(x => <option key={x}>{x}</option>)}</select>
  const up = async ev => {
    const fd = new FormData(); fd.append('file', ev.target.files[0]); setBe(''); setBs(null)
    try { setBs((await api.post('/reports/batch', fd)).data); setN(n + 1) } catch (x) { setBe(err(x)) }
  }
  return <div className="space-y-4"><div className="flex justify-between items-center flex-wrap gap-2"><h1 className="text-xl font-semibold">{title}</h1>
    {batch && <label className="btn cursor-pointer">Upload historical reports (CSV)<input type="file" accept=".csv" hidden onChange={up}/></label>}</div>
    {be && <Msg e={be}/>}
    {bs && <div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Kpi l="Total records" v={bs.total}/><Kpi l="Processed" v={bs.processed} c="border-green-500"/><Kpi l="Failed" v={bs.failed} c="border-orange-500"/><Kpi l="SIF potential" v={bs.sif} c="border-red-500"/><Kpi l="Non-SIF" v={bs.non_sif}/></div>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><input className="inp col-span-2" placeholder="Search ID, location, activity, description, reporter" value={f.q} onChange={x => setF({...f, q: x.target.value})}/>
      <Sel k="type" o={TYPES} l="All types"/><Sel k="site" o={SITES} l="All sites"/><Sel k="sif" o={['YES', 'NO']} l="SIF: any"/><Sel k="priority" o={['High', 'Medium', 'Low']} l="All priorities"/>
      <Sel k="rule" o={RULES} l="All rules"/><Sel k="status" o={STATUS} l="All statuses"/></div>
    {rows ? <Table rows={rows}/> : <Msg e={e}/>}<Note/></div>
}

/* ---------- Analysis result ---------- */
function Analysis({a, text}) {
  const Info = ([l, v]) => <div key={l} className="card"><div className="text-xs text-slate-500">{l}</div><div className="text-sm mt-1">{v || 'Not detected'}</div></div>
  return <div className="space-y-4"><div className="card bg-navy text-white"><div className="text-sm opacity-80 mb-2">AI Safety Analysis</div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['SIF potential', a.sif_potential], ['Priority', a.priority], ['Confidence', a.confidence + '%'], ['Life-Saving Rule', a.life_saving_rule]].map(([l, v]) =>
      <div key={l}><div className="text-xs opacity-70">{l}</div><div className={`text-xl font-semibold ${v === 'YES' || v === 'High' ? 'text-red-300' : ''}`}>{v}</div></div>)}</div></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['Hazard', a.hazard], ['Unsafe action', a.unsafe_action], ['Unsafe condition', a.unsafe_condition], ['Barrier failure', a.barrier_failure], ['Potential consequence', a.potential_consequence]].map(Info)}</div>
    <div className="card"><div className="text-sm font-medium mb-2">Key evidence</div>{a.evidence.length ? a.evidence.map((s, i) => <p key={i} className="text-sm mb-1"><Hl t={s} k={a.keywords}/></p>) : <p className="text-sm text-slate-500">No key phrases found.</p>}</div>
    {text && <div className="card"><div className="text-sm font-medium mb-2">Original report</div><p className="text-sm"><Hl t={text} k={a.keywords}/></p></div>}
    {a.sif_potential === 'YES' && <div className="card border-red-300 bg-red-50 text-sm">This report has been identified as having potential SIF indicators and should be reviewed by the HSE team.</div>}<Note/></div>
}

/* ---------- Submit ---------- */
function Submit() {
  const empty = {report_type: 'Unsafe Condition', date: new Date().toISOString().slice(0, 10), site: 'Duliajan', location: '', activity: '', description: '', immediate_action: '', equipment: '', barrier_failure: ''}
  const [f, setF] = useState(empty), [busy, setBusy] = useState(null), [res, setRes] = useState(null), [e, setE] = useState('')
  const set = k => x => setF({...f, [k]: x.target.value})
  const go = async ev => {
    ev.preventDefault(); setE(''); setBusy(0)
    const t = setInterval(() => setBusy(b => Math.min(b + 1, STEPS.length - 2)), 600)
    try { const r = (await api.post('/reports', f)).data; clearInterval(t); setBusy(STEPS.length - 1); await new Promise(s => setTimeout(s, 600)); setRes(r) }
    catch (x) { clearInterval(t); setE(err(x)) }
    setBusy(null)
  }
  if (busy !== null) return <div className="card max-w-xl mx-auto"><h2 className="font-semibold mb-4">Analyzing report</h2>{STEPS.map((s, i) => <div key={s} className="flex items-center gap-3 mb-2">
    <span className={`w-5 h-5 rounded-full grid place-items-center text-xs ${i < busy ? 'bg-green-500 text-white' : i === busy ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200'}`}>{i < busy ? '✓' : ''}</span>
    <span className={`text-sm ${i > busy ? 'text-slate-400' : ''}`}>{s}</span></div>)}</div>
  if (res) return <div className="space-y-4"><div className="flex justify-between items-center"><h1 className="text-xl font-semibold">Analysis for {res.report_id}</h1>
    <button className="btn2" onClick={() => { setRes(null); setF(empty) }}>Submit another</button></div><Analysis a={res.analysis} text={res.description}/></div>
  const I = ({k, l, ...r}) => <div><label className="lbl">{l}</label><input className="inp" value={f[k]} onChange={set(k)} {...r}/></div>
  return <form onSubmit={go} className="space-y-4 max-w-4xl"><h1 className="text-xl font-semibold">Submit safety report</h1>
    <div className="card grid md:grid-cols-3 gap-3"><div><label className="lbl">Report type</label><select className="inp" value={f.report_type} onChange={set('report_type')}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
      <I k="date" l="Date" type="date" required/><div><label className="lbl">Site</label><select className="inp" value={f.site} onChange={set('site')}>{SITES.map(t => <option key={t}>{t}</option>)}</select></div>
      <I k="location" l="Location" required/><I k="activity" l="Activity (optional, detected if empty)"/><I k="equipment" l="Equipment involved"/></div>
    <div className="card"><label className="lbl">Describe the unsafe act, unsafe condition, near miss or incident</label>
      <textarea className="inp h-32" required minLength={15} value={f.description} onChange={set('description')} placeholder="During maintenance work, an employee was working near an energized electrical panel without proper isolation. The area was not barricaded."/></div>
    <div className="card grid md:grid-cols-2 gap-3"><I k="immediate_action" l="Immediate action taken"/><I k="barrier_failure" l="Barrier failure observed"/></div>
    {e && <Msg e={e}/>}<button className="btn">Analyze report</button></form>
}

/* ---------- Detail + review ---------- */
function Detail({admin}) {
  const {id} = useParams(), [r, e] = useGet(`/reports/${id}`), [v, setV] = useState(null), [saved, setSaved] = useState('')
  useEffect(() => { if (r) setV({status: r.review.status, comments: r.review.comments || '', action_required: r.review.action_required || '', action_owner: r.review.action_owner || ''}) }, [r])
  if (!r || !v) return <Msg e={e}/>
  const save = async status => {
    try { await api.put(`/reviews/${id}`, {...v, status}); setV({...v, status}); setSaved('Saved') } catch (x) { setSaved(err(x)) }
  }
  return <div className="space-y-4"><h1 className="text-xl font-semibold">{r.report_id}</h1>
    <div className="card grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">{[['Reporter', r.reporter], ['Date', r.date], ['Site', r.site], ['Location', r.location], ['Type', r.type], ['Activity', r.activity]].map(([l, x]) => <div key={l}><div className="text-xs text-slate-500">{l}</div>{x}</div>)}</div>
    <Analysis a={r.analysis} text={r.description}/>
    <div className="card space-y-3"><div className="flex items-center gap-2"><h2 className="font-medium">HSE review</h2><Badge t={v.status}/></div>
      {admin ? <>
        <div className="grid md:grid-cols-2 gap-3"><div><label className="lbl">Status</label><select className="inp" value={v.status} onChange={x => setV({...v, status: x.target.value})}>{STATUS.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className="lbl">Action owner</label><input className="inp" value={v.action_owner} onChange={x => setV({...v, action_owner: x.target.value})}/></div></div>
        <div><label className="lbl">HSE comments</label><textarea className="inp" value={v.comments} onChange={x => setV({...v, comments: x.target.value})}/></div>
        <div><label className="lbl">Action required</label><textarea className="inp" value={v.action_required} onChange={x => setV({...v, action_required: x.target.value})}/></div>
        <div className="flex gap-2 flex-wrap"><button className="btn" onClick={() => save('Reviewed')}>Mark as reviewed</button>
          <button className="btn2" onClick={() => save('Further Investigation Required')}>Request further investigation</button>
          <button className="btn2" onClick={() => save('Action Initiated')}>Add preventive action</button><button className="btn2" onClick={() => save(v.status)}>Save changes</button></div>
        {saved && <p className="text-sm text-slate-600">{saved}</p>}</> : <p className="text-sm text-slate-500">HSE comments: {v.comments || 'None yet'}</p>}</div></div>
}

/* ---------- Dashboards ---------- */
function useAdmin() {
  const [s, e1] = useGet('/dashboard/summary'), [tr] = useGet('/dashboard/trends'), [ru] = useGet('/dashboard/life-saving-rules'), [p] = useGet('/dashboard/precursors')
  return {s, tr, ru, p, e: e1, ready: s && tr && ru && p}
}
function AdminDash() {
  const d = useAdmin(), [rows] = useGet('/reports', {sif: 'YES', status: 'Pending Review'})
  if (!d.ready) return <Msg e={d.e}/>
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">HSE dashboard</h1>
    <p className="text-sm text-slate-500">Safety report → AI/NLP analysis → SIF detection → Life-Saving Rule → precursor patterns → HSE review</p></div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Kpi l="Total reports" v={d.s.total}/><Kpi l="SIF potential" v={d.s.sif} c="border-red-500"/><Kpi l="Non-SIF potential" v={d.s.non_sif} c="border-green-500"/>
      <Kpi l="High priority" v={d.s.high_priority} c="border-red-500"/><Kpi l="Pending HSE review" v={d.s.pending_review} c="border-orange-500"/></div>
    <Note/><h2 className="font-medium pt-2">Needs HSE attention</h2>{rows ? <Table rows={rows.slice(0, 6)}/> : <Msg/>}
    <h2 className="font-medium pt-2">Recurring precursor patterns</h2><Patterns p={d.p}/><h2 className="font-medium pt-2">Charts</h2><Charts {...d}/></div>
}
function ManagerDash() {
  const [rows, e] = useGet('/reports')
  if (!rows) return <Msg e={e}/>
  return <div className="space-y-4"><div className="flex justify-between items-center"><h1 className="text-xl font-semibold">My dashboard</h1><Link to="/submit" className="btn">+ Submit new report</Link></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Kpi l="Reports submitted" v={rows.length}/><Kpi l="Reports analyzed" v={rows.length} c="border-green-500"/>
      <Kpi l="SIF potential" v={rows.filter(r => r.analysis.sif_potential === 'YES').length} c="border-red-500"/><Kpi l="Pending review" v={rows.filter(r => r.review.status === 'Pending Review').length} c="border-orange-500"/></div>
    <h2 className="font-medium">Recent reports</h2><Table rows={rows.slice(0, 8)}/><Note/></div>
}
function Analytics() {
  const d = useAdmin()
  if (!d.ready) return <Msg e={d.e}/>
  return <div className="space-y-4"><h1 className="text-xl font-semibold">Analytics</h1><div className="grid grid-cols-2 md:grid-cols-3 gap-3"><Kpi l="SIF percentage" v={d.s.total ? Math.round(d.s.sif / d.s.total * 100) + '%' : '0%'} c="border-red-500"/>
    <Kpi l="Reports" v={d.s.total}/><Kpi l="SIF reports" v={d.s.sif} c="border-red-500"/></div><Charts {...d}/><Patterns p={d.p}/><Note/></div>
}
const DESC = {'Energy Isolation': 'Verify isolation and zero energy before work starts.', 'Hot Work': 'Control ignition sources and hold a valid permit.', 'Confined Space': 'Test the atmosphere and hold a permit before entry.',
  'Line of Fire': 'Keep people clear of suspended, moving or falling loads.', 'Work at Height': 'Use protection against falls when working at height.', 'Other': 'Reports with no matching Life-Saving Rule.'}
function RulesPage() {
  const [ru, e] = useGet('/dashboard/life-saving-rules')
  if (!ru) return <Msg e={e}/>
  return <div className="space-y-4"><h1 className="text-xl font-semibold">Life-Saving Rules</h1><Box t="SIF-potential reports by rule"><BarC data={arr(ru)} keys={[['value', '#ea580c']]}/></Box>
    <div className="grid md:grid-cols-3 gap-3">{RULES.map(r => <div key={r} className="card"><div className="flex justify-between"><b className="text-sm">{r}</b><Badge t={String(ru[r] || 0)}/></div><p className="text-xs text-slate-500 mt-1">{DESC[r]}</p></div>)}</div><Note/></div>
}
function Patt() { const [p, e] = useGet('/dashboard/precursors'); return p ? <div className="space-y-4"><h1 className="text-xl font-semibold">Precursor patterns</h1><Patterns p={p}/><Note/></div> : <Msg e={e}/> }
const Profile = ({u}) => <div className="card max-w-sm"><div className="font-semibold">{u.name}</div><div className="text-sm text-slate-500">{u.role === 'hse_admin' ? 'HSE Admin' : 'Manager'}</div></div>

/* ---------- Shell ---------- */
export default function App() {
  const [u, setU] = useState(() => JSON.parse(localStorage.getItem('user') || 'null')), [open, setOpen] = useState(false)
  if (!u) return <Login onLogin={setU}/>
  const admin = u.role === 'hse_admin'
  const nav = admin ? [['/', 'Dashboard'], ['/submit', 'Submit Report'], ['/reports', 'All Reports'], ['/sif', 'SIF Analysis'], ['/precursors', 'Precursor Patterns'], ['/rules', 'Life-Saving Rules'], ['/analytics', 'Analytics'], ['/review', 'HSE Review'], ['/profile', 'Profile']]
    : [['/', 'Dashboard'], ['/submit', 'Submit Report'], ['/reports', 'My Reports'], ['/profile', 'Profile']]
  const out = () => { localStorage.clear(); setU(null) }
  return <div className="md:flex min-h-screen">
    <div className="md:hidden bg-navy text-white p-3 flex justify-between"><b>OIL SIF Detection</b><button onClick={() => setOpen(!open)}>Menu</button></div>
    <aside className={`${open ? 'block' : 'hidden'} md:block w-full md:w-60 bg-navy text-white p-4 space-y-1 shrink-0`}>
      <div className="hidden md:block font-semibold mb-4">OIL SIF Detection<div className="text-xs font-normal opacity-60">{u.name}</div></div>
      {nav.map(([to, l]) => <NavLink key={to} to={to} end onClick={() => setOpen(false)} className={({isActive}) => `block px-3 py-2 rounded text-sm ${isActive ? 'bg-white/15' : 'hover:bg-white/10'}`}>{l}</NavLink>)}
      <button className="block w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10" onClick={out}>Logout</button></aside>
    <main className="flex-1 p-4 md:p-6 min-w-0"><Routes>
      <Route path="/" element={admin ? <AdminDash/> : <ManagerDash/>}/><Route path="/submit" element={<Submit/>}/>
      <Route path="/reports" element={<Reports title={admin ? 'All reports' : 'My reports'} batch={admin}/>}/><Route path="/reports/:id" element={<Detail admin={admin}/>}/>
      <Route path="/profile" element={<Profile u={u}/>}/>
      {admin && <><Route path="/sif" element={<Reports title="SIF analysis: reports with SIF potential" preset={{sif: 'YES'}}/>}/>
        <Route path="/precursors" element={<Patt/>}/><Route path="/rules" element={<RulesPage/>}/><Route path="/analytics" element={<Analytics/>}/>
        <Route path="/review" element={<Reports title="HSE review queue" preset={{status: 'Pending Review'}}/>}/></>}
      <Route path="*" element={<Navigate to="/"/>}/></Routes></main></div>
}
