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

  // filtros / formulário
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tf, setTf] = useState('5m');

  const [priceNow, setPriceNow] = useState('');
  const [ema20, setEma20] = useState('');
  const [ema200, setEma200] = useState('');
  const [volAvg, setVolAvg] = useState('');
  const [rsiK, setRsiK] = useState('');
  const [rsiD, setRsiD] = useState('');

  const [rowsHL, setRowsHL] = useState([]);   // HL do banco (todas os TFs)
  const [saved, setSaved] = useState(null);

  useEffect(() => { getSupabase().auth.getSession().then(({data})=>setSession(data.session)); }, []);
  useEffect(() => { if (session) fetchHL(); }, [session, symbol]);

  async function fetchHL(){
    // pega TODAS as HL do símbolo para poder intercalar com os overlays
    const { data } = await getSupabase()
      .from('hl_lines')
      .select('*')
      .eq('symbol', symbol);
    setRowsHL(data || []);
  }

  function numOrNull(v){
    if (v === '' || v === null || v === undefined) return null;
    const s = String(v).trim().replace(/\s+/g,'').replace(/%/g,'');
    // aceita vírgula brasileira
    const hasDot = s.includes('.'), hasComma = s.includes(',');
    let t = s;
    if(hasDot && hasComma){
      const lastDot = s.lastIndexOf('.'); const lastComma = s.lastIndexOf(',');
      t = (lastComma > lastDot) ? s.replace(/\./g,'').replace(/,/g,'.') : s.replace(/,/g,'');
    }else if(hasComma){ t = s.replace(/\./g,'').replace(/,/g,'.'); }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
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
    const { data, error } = await getSupabase().from('strategies').insert(payload).select('*').single();
    if (!error) setSaved(data);
  }

  // === OVERLAYS (linhas sintéticas) ===
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

  // === MERGE (HL + overlays) e ordenação por preço desc ===
  const mergedRows = useMemo(() => {
    const normalizedHL = (rowsHL || []).map(r => ({
      kind: 'hl',
      id: r.id,
      price: Number(r.price),
      timeframe: r.timeframe,
      type: r.type,           // 'support' | 'resistance' | 'undefined'
      at: r.at
    }));
    const normOver = overlays.map((o, idx) => ({
      kind:'overlay',
      id: `ov-${idx}`,
      price: o.price,
      timeframe: null,        // overlay não tem TF específico
      type: 'undefined',      // cor "amarelo" por padrão (podemos mapear diferente depois)
      label: o.label,
      at: null
    }));
    const all = [...normalizedHL, ...normOver];
    // ordena por preço (desc)
    all.sort((a,b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    return all;
  }, [rowsHL, overlays]);

  // === Render ===
  return (
    <main className="container">
      {/* FORM: grid agradável, alinhado e responsivo */}
      <div className="pane" style={{marginBottom:12}}>
        <h2>ME — Estratégias</h2>
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
          <div className="form-actions">
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

      {/* LISTA: HL de qualquer TF + overlays intercalados por preço desc */}
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
              // define classe de cor p/ pills/badges
              const cls = (r.type === 'support') ? 'support' :
                          (r.type === 'resistance') ? 'resistance' : 'undefined';

              const priceText = Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2});
              const isOverlay = r.kind === 'overlay';

              return (
                <tr key={r.id}>
                  {/* PREÇO com pastilha colorida */}
                  <td>
                    <span className={`pill ${cls}`}>{priceText}</span>
                  </td>

                  {/* TF: badge azul p/ HL, “—” p/ overlay */}
                  <td className="center">
                    {isOverlay
                      ? <span className="badge tf">—</span>
                      : <span className="badge tf">{r.timeframe}</span>}
                  </td>

                  {/* Tipo: HL mostra o tipo; overlay mostra a descrição ([Valor Atual]/[EMA20]/[EMA200]) */}
                  <td className="center">
                    {isOverlay
                      ? <span className={`badge ${cls}`}>{r.label}</span>
                      : <span className={`badge ${cls}`}>{r.type}</span>}
                  </td>

                  {/* Data: vazia para overlay */}
                  <td className="center">
                    {isOverlay || !r.at ? '—' : new Date(r.at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              );
            })}

            {mergedRows.length === 0 && (
              <tr><td colSpan={4} style={{opacity:.7,padding:'12px 8px'}}>Sem dados. Preencha os campos ou cadastre HL no MSR.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

