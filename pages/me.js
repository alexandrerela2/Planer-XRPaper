import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import Protected from '@/components/Protected';
import Header from '@/components/Header';

const TF_OPTIONS = ['1m','5m','15m','30m','1h','1d','1w','1mo','1y'];

export default function ME(){
  return (
    <Protected>
      <Header />
      <MEContent />
    </Protected>
  );
}

function MEContent(){
  const [session, setSession] = useState(null);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tf, setTf] = useState('5m');
  const [priceNow, setPriceNow] = useState('');
  const [ema20, setEma20] = useState('');
  const [ema200, setEma200] = useState('');
  const [volAvg, setVolAvg] = useState('');
  const [rsiK, setRsiK] = useState('');
  const [rsiD, setRsiD] = useState('');
  const [saved, setSaved] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => { getSupabase().auth.getSession().then(({data})=>setSession(data.session)); }, []);
  useEffect(() => { if (session) fetchRows(); }, [session, symbol, tf]);

  async function fetchRows(){
    const { data } = await getSupabase()
      .from('hl_lines')
      .select('*')
      .eq('symbol', symbol)
      .eq('timeframe', tf)
      .order('price', { ascending: false });
    setRows(data || []);
  }

  async function save(){
    const user_id = session.user.id;
    const payload = {
      user_id, symbol, timeframe: tf,
      price_now: numOrNull(priceNow),
      ema20: numOrNull(ema20),
      ema200: numOrNull(ema200),
      vol_avg: numOrNull(volAvg),
      rsi_k: numOrNull(rsiK),
      rsi_d: numOrNull(rsiD)
    };
    const { data, error } = await getSupabase().from('strategies').insert(payload).select('*').single();
    if (!error) setSaved(data);
  }

  const overlay = useMemo(() => ([
    { label: '[Valor Atual]', value: priceNow },
    { label: '[EMA20]', value: ema20 },
    { label: '[EMA200]', value: ema200 }
  ]), [priceNow, ema20, ema200]);

  return (
    <main className="container">
      <div className="pane" style={{marginBottom:12}}>
        <h2>ME — Estratégias</h2>
        <div className="grid-2" style={{marginTop:10}}>
          <div className="grid-2" style={{gap:8}}>
            <label> Símbolo <input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} /></label>
            <label> Tempo Gráfico
              <select value={tf} onChange={e=>setTf(e.target.value)}>
                {TF_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label> Valor Atual <input value={priceNow} onChange={e=>setPriceNow(e.target.value)} /></label>
            <label> EMA20 <input value={ema20} onChange={e=>setEma20(e.target.value)} /></label>
            <label> EMA200 <input value={ema200} onChange={e=>setEma200(e.target.value)} /></label>
            <label> Volume médio <input value={volAvg} onChange={e=>setVolAvg(e.target.value)} /></label>
            <label> RSI K <input value={rsiK} onChange={e=>setRsiK(e.target.value)} /></label>
            <label> RSI D <input value={rsiD} onChange={e=>setRsiD(e.target.value)} /></label>
          </div>
          <div style={{display:'flex',alignItems:'end'}}>
            <button onClick={save}>Salvar Valores</button>
          </div>
        </div>
      </div>

      {saved && (
        <div className="pane" style={{marginBottom:12}}>
          <strong>Resumo salvo:</strong>
          <div style={{marginTop:6, color:'var(--muted)'}}>Volume médio: <b>{saved.vol_avg ?? '-'}</b></div>
          <div style={{color:'var(--muted)'}}>RSI K/D: <b>{saved.rsi_k ?? '-'}</b> / <b>{saved.rsi_d ?? '-'}</b></div>
        </div>
      )}

      <div className="pane">
        <table className="table">
          <thead>
            <tr>
              <th>Preço</th>
              <th className="center">TF</th>
              <th className="center">Tipo</th>
              <th className="center">Data</th>
            </tr>
          </thead>
          <tbody>
            {/* Linhas informativas (sem edição) */}
            {overlay.map((o, idx) => (
              <tr key={`ov-${idx}`} style={{background:'#0b1425'}}>
                <td colSpan={2}>{o.label}</td>
                <td colSpan={2} className="right">{o.value || '-'}</td>
              </tr>
            ))}
            {/* HL do timeframe */}
            {rows.map(r => (
              <tr key={r.id}>
                <td>{Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td className="center">{r.timeframe}</td>
                <td className="center">
                  <span className={`badge ${r.type==='support'?'support':r.type==='resistance'?'resistance':'undefined'}`}>
                    {r.type}
                  </span>
                </td>
                <td className="center">{new Date(r.at).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{opacity:.7,padding:'12px 8px'}}>Sem HL para este timeframe.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function numOrNull(v){
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',','.'));
  return Number.isFinite(n) ? n : null;
}

