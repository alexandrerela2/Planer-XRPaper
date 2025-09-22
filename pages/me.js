import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
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

  useEffect(() => { supabase.auth.getSession().then(({data})=>setSession(data.session)); }, []);
  useEffect(() => { if (session) fetchRows(); }, [session, symbol, tf]);

  async function fetchRows(){
    const { data } = await supabase
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
      user_id,
      symbol,
      timeframe: tf,
      price_now: numOrNull(priceNow),
      ema20: numOrNull(ema20),
      ema200: numOrNull(ema200),
      vol_avg: numOrNull(volAvg),
      rsi_k: numOrNull(rsiK),
      rsi_d: numOrNull(rsiD)
    };
    const { data, error } = await supabase.from('strategies').insert(payload).select('*').single();
    if (!error) setSaved(data);
  }

  const overlay = useMemo(() => ([
    { label: '[Valor Atual]', value: priceNow },
    { label: '[EMA20]', value: ema20 },
    { label: '[EMA200]', value: ema200 }
  ]), [priceNow, ema20, ema200]);

  return (
    <main style={{maxWidth:960,margin:'20px auto',padding:16}}>
      <h2>ME — Estratégias</h2>

      <section style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,margin:'12px 0'}}>
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
        <button onClick={save}>Salvar Valores</button>
      </section>

      {saved && (
        <div style={{padding:12, background:'#f6f8fa', border:'1px solid #eaecef', borderRadius:8, marginBottom:12}}>
          <strong>Resumo salvo:</strong>
          <div>Volume médio: {saved.vol_avg ?? '-'}</div>
          <div>RSI K/D: {saved.rsi_k ?? '-'} / {saved.rsi_d ?? '-'}</div>
        </div>
      )}

      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr>
            <th style={{textAlign:'left'}}>Preço</th>
            <th>TF</th>
            <th>Tipo</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {overlay.map((o, idx) => (
            <tr key={`ov-${idx}`} style={{borderTop:'1px solid #eee', background:'#fffdf5'}}>
              <td colSpan={2}>{o.label}</td>
              <td colSpan={2} style={{textAlign:'right'}}>{o.value || '-'}</td>
            </tr>
          ))}

          {rows.map(r => (
            <tr key={r.id} style={{borderTop:'1px solid #eee'}}>
              <td>{Number(r.price).toLocaleString()}</td>
              <td style={{textAlign:'center'}}>{r.timeframe}</td>
              <td style={{textAlign:'center', color: r.type==='support'?'green':r.type==='resistance'?'crimson':'#b8860b'}}>{r.type}</td>
              <td style={{textAlign:'center'}}>{new Date(r.at).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} style={{padding:12,opacity:.7}}>Sem HL para este timeframe.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function numOrNull(v){
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
