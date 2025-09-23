import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
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
  const router = useRouter();
  const [session, setSession] = useState(null);

  // filtros / formulário
  const [symbol, setSymbol] = useState(router.query.symbol ? String(router.query.symbol).toUpperCase() : 'BTCUSDT');
  const [tf, setTf] = useState(router.query.tf ? String(router.query.tf) : '5m');
  const [dateFrom, setDateFrom] = useState(router.query.dateFrom ? String(router.query.dateFrom) : '');
  const [dateTo, setDateTo] = useState(router.query.dateTo ? String(router.query.dateTo) : '');

  const [priceNow, setPriceNow] = useState('');
  const [ema20, setEma20] = useState('');
  const [ema200, setEma200] = useState('');
  const [atr, setAtr] = useState('');
  const [volAvg, setVolAvg] = useState('');
  const [rsiK, setRsiK] = useState('');
  const [rsiD, setRsiD] = useState('');

  const [rowsHL, setRowsHL] = useState([]);   // HL filtradas
  const [signal, setSignal] = useState({ tag:'—', cls:'', detail:'' });

  useEffect(() => { getSupabase().auth.getSession().then(({data})=>setSession(data.session)); }, []);
  useEffect(() => { if (session) fetchHL(); }, [session, symbol, tf, dateFrom, dateTo]);

  function toIsoOrNull(v){
    if(!v) return null;
    const d = new Date(v);
    return isNaN(+d) ? null : d.toISOString();
  }
  function numOrNull(v){
    if (v === '' || v === null || v === undefined) return null;
    const s0 = String(v).trim().replace(/\s+/g,'').replace(/%/g,'');
    const hasDot = s0.includes('.'), hasComma = s0.includes(',');
    let s = s0;
    if(hasDot && hasComma){
      const d = s.lastIndexOf('.'), c = s.lastIndexOf(',');
      s = (c>d) ? s.replace(/\./g,'').replace(/,/g,'.') : s.replace(/,/g,'');
    }else if(hasComma){ s = s.replace(/\./g,'').replace(/,/g,'.'); }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function fetchHL(){
    let q = getSupabase()
      .from('hl_lines')
      .select('*')
      .eq('symbol', symbol)
      .eq('timeframe', tf);

    const fIso = toIsoOrNull(dateFrom);
    const tIso = toIsoOrNull(dateTo);
    if (fIso) q = q.gte('at', fIso);
    if (tIso) q = q.lte('at', tIso);

    q = q.order('price', { ascending: false });

    const { data } = await q;
    setRowsHL(data || []);
  }

  // === "Calcular": mantém função (gera sinal, não grava)
  function calcular(){
    const px = numOrNull(priceNow);
    const atrNum = numOrNull(atr);
    const k = numOrNull(rsiK), d = numOrNull(rsiD);
    const vol = numOrNull(volAvg);

    if (px === null || atrNum === null) {
      setSignal({ tag:'—', cls:'', detail:'Preencha Valor Atual e ATR' });
      return;
    }

    const atrPct = (atrNum/px)*100; // ATR como % do preço
    let cls = 'warn', tag = 'Neutro', reason = [];

    if (atrPct >= 1 && k !== null && d !== null && k > d && k >= 50 && k <= 80) { cls = 'good'; tag = 'Favorável'; }
    else if (atrPct < 0.5 || (k !== null && d !== null && k < d)) { cls = 'bad'; tag = 'Desfavorável'; }

    if (vol !== null) reason.push(`Vol≈${vol}`);
    if (k !== null && d !== null) reason.push(`RSI ${k}/${d}`);
    reason.push(`ATR% ${atrPct.toFixed(2).replace('.',',')}%`);

    setSignal({ tag, cls, detail: reason.join(' · ') });
  }

  // === Overlays (linhas sintéticas) — intercaladas por preço dentro do TF + período
  const overlays = useMemo(() => {
    const arr = [];
    const pn = numOrNull(priceNow);
    const e20 = numOrNull(ema20);
    const e200 = numOrNull(ema200);
    if (pn !== null)   arr.push({ kind:'overlay', label:'[Valor Atual]', price: pn });
    if (e20 !== null)  arr.push({ kind:'overlay', label:'[EMA20]',       price: e20 });
    if (e200 !== null) arr.push({ kind:'overlay', label:'[EMA200]',      price: e200 });
    return arr;
  }, [priceNow, ema20, ema200]);

  const mergedRows = useMemo(() => {
    const normHL = (rowsHL || []).map(r => ({
      kind: 'hl',
      id: r.id,
      price: Number(r.price),
      timeframe: r.timeframe,
      type: r.type,
      at: r.at
    }));
    const normOver = overlays.map((o, idx) => ({
      kind:'overlay',
      id: `ov-${idx}`,
      price: o.price,
      timeframe: tf,
      type: 'undefined',
      label: o.label,
      at: null
    }));
    const all = [...normHL, ...normOver].sort((a,b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    return all;
  }, [rowsHL, overlays, tf]);

  // === "Próximo": salva snapshot e abre MEX
  async function proximo(){
    const supabase = getSupabase();
    const user_id = session.user.id;

    const px = numOrNull(priceNow);
    const atrNum = numOrNull(atr);
    const k = numOrNull(rsiK), d = numOrNull(rsiD);
    const e20 = numOrNull(ema20), e200 = numOrNull(ema200);
    const vol = numOrNull(volAvg);

    const atrPct = (px && atrNum) ? (atrNum/px)*100 : null;

    // traduz classe do sinal para texto
    let mex_signal = null;
    if (signal.cls === 'good') mex_signal = 'favoravel';
    else if (signal.cls === 'bad') mex_signal = 'desfavoravel';
    else if (signal.cls === 'warn') mex_signal = 'neutro';

    // HL reais visíveis (já filtradas por TF/período)
    const hlReal = (rowsHL || []).map(r => ({
      id: r.id, price: r.price, timeframe: r.timeframe, type: r.type, at: r.at
    }));

    const { data, error } = await supabase
      .from('mex_runs')
      .insert({
        user_id, symbol, timeframe: tf,
        price_now: px, ema20: e20, ema200: e200,
        atr: atrNum, vol_avg: vol, rsi_k: k, rsi_d: d,
        atr_pct: atrPct, mex_signal,
        date_from: toIsoOrNull(dateFrom),
        date_to: toIsoOrNull(dateTo),
        hl_rows: hlReal
      })
      .select('id')
      .single();

    if (!error && data?.id){
      router.push(`/mex?id=${data.id}`);
    }
  }

  return (
    <main className="container">
      {/* FORM: card superior */}
      <div className="pane" style={{marginBottom:12}}>
        <h2>ME — Estratégias</h2>

        {/* grid */}
        <div className="form-grid" style={{marginTop:10}}>
          <div>
            <label> Símbolo </label>
            <input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label> Tempo Gráfico </label>
            <select value={tf} onChange={e=>setTf(e.target.value)}>
              {TF_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label> Valor Atual </label>
            <input value={priceNow} onChange={e=>setPriceNow(e.target.value)} />
          </div>

          <div>
            <label> EMA20 </label>
            <input value={ema20} onChange={e=>setEma20(e.target.value)} />
          </div>
          <div>
            <label> EMA200 </label>
            <input value={ema200} onChange={e=>setEma200(e.target.value)} />
          </div>
          <div>
            <label> ATR </label>
            <input value={atr} onChange={e=>setAtr(e.target.value)} />
          </div>

          <div>
            <label> Volume médio </label>
            <input value={volAvg} onChange={e=>setVolAvg(e.target.value)} />
          </div>
          <div>
            <label> RSI K </label>
            <input value={rsiK} onChange={e=>setRsiK(e.target.value)} />
          </div>
          <div>
            <label> RSI D </label>
            <input value={rsiD} onChange={e=>setRsiD(e.target.value)} />
          </div>

          <div>
            <label> De </label>
            <input type="datetime-local" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          </div>
          <div>
            <label> Até </label>
            <input type="datetime-local" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          </div>

          {/* Ações */}
          <div className="form-actions" style={{gap:8, flexWrap:'wrap'}}>
            <button onClick={calcular}>Calcular</button>
            <button onClick={proximo}>Próximo</button>
          </div>
        </div>

        {/* Sinal (badge) baseado em ATR + Volume + RSI */}
        <div style={{marginTop:10}}>
          <span className={`badge ${signal.cls || ''}`} style={{marginRight:8}}>{signal.tag}</span>
          <span style={{color:'var(--muted)'}}>{signal.detail}</span>
        </div>
      </div>

      {/* LISTA: HL do TF + período selecionados + overlays por preço */}
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
            {mergedRows.map(r => {
              const isOverlay = r.kind === 'overlay';
              const cls = (r.type === 'support') ? 'support'
                        : (r.type === 'resistance') ? 'resistance'
                        : 'undefined';
              return (
                <tr key={r.id}>
                  <td><span className={`pill ${cls}`}>{Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</span></td>
                  <td className="center"><span className="badge tf">{r.timeframe || '—'}</span></td>
                  <td className="center">
                    {isOverlay
                      ? <span className={`badge ${cls}`}>{r.label}</span>
                      : <span className={`badge ${cls}`}>{r.type}</span>}
                  </td>
                  <td className="center">{isOverlay || !r.at ? '—' : new Date(r.at).toLocaleString('pt-BR')}</td>
                </tr>
              );
            })}
            {mergedRows.length === 0 && (
              <tr><td colSpan={4} style={{opacity:.7,padding:'12px 8px'}}>Sem HL para o filtro atual.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

