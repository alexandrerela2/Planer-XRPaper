import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Protected from '@/components/Protected';
import Header from '@/components/Header';
import { getSupabase } from '@/lib/supabaseClient';

export default function ME() {
  return (
    <Protected>
      <Header />
      <MEContent />
    </Protected>
  );
}

const TF_OPTIONS = ['1m','5m','15m','1h','4h','1d'];

function MEContent(){
  const router = useRouter();
  const supabase = getSupabase();

  // filtros básicos
  const [symbol, setSymbol] = useState('WIN');
  const [timeframe, setTimeframe] = useState('5m');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // valores do mercado
  const [priceNow, setPriceNow] = useState('');
  const [atrPct, setAtrPct] = useState('');
  const [rsiK, setRsiK] = useState('');
  const [rsiD, setRsiD] = useState('');
  const [ema20, setEma20] = useState('');
  const [ema200, setEma200] = useState('');
  const [volAvg, setVolAvg] = useState('');
  const [vwap, setVwap] = useState('');          // <-- NOVO

  // HL visíveis (use as linhas que você já exibe no ME; pode colar aqui)
  const [hlRows, setHlRows] = useState([]); // [{id?, price, timeframe, type:'support'|'resistance'|'undefined', at?}, ...]

  // resultado do "Calcular" (sinal simples para iniciante)
  const [signal, setSignal] = useState(null); // 'favoravel' | 'desfavoravel' | 'neutro'

  useEffect(() => {
    // se você já tem as HL em outro estado/consulta no ME, jogue aqui:
    // setHlRows(existingHlArray)
  }, []);

  function num(x){ const n = Number(x); return Number.isFinite(n) ? n : null; }

  function calcular(){
    // regra ultra simples para iniciante: cruzamento RSI + posição vs EMA20
    const k = num(rsiK), d = num(rsiD), px = num(priceNow), e20 = num(ema20), e200 = num(ema200);
    if (k==null || d==null || px==null || e20==null || e200==null) {
      setSignal('neutro');
      return;
    }

    const acima20 = px >= e20;
    const acima200 = px >= e200;
    const cruzouCima = k > d;
    const cruzouBaixo = k < d;

    if (acima20 && cruzouCima) return setSignal('favoravel');
    if (!acima200 && cruzouBaixo) return setSignal('desfavoravel');
    setSignal('neutro');
  }

  async function proximo(){
    // grava snapshot em mex_runs e redireciona para /mex?id=...
    const payload = {
      symbol,
      timeframe,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
      date_to:   dateTo   ? new Date(dateTo).toISOString()   : null,
      price_now: num(priceNow),
      atr_pct:   num(atrPct),
      rsi_k:     num(rsiK),
      rsi_d:     num(rsiD),
      ema20:     num(ema20),
      ema200:    num(ema200),
      vol_avg:   num(volAvg),
      vwap:      num(vwap),        // <-- NOVO (vai para o MEX)
      mex_signal: signal,
      hl_rows:   hlRows && Array.isArray(hlRows) ? hlRows : []
    };

    const { data, error } = await supabase
      .from('mex_runs')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      alert('Erro ao salvar: ' + (error.message || error));
      return;
    }
    router.push(`/mex?id=${data.id}`);
  }

  // UI – layout compacto e alinhado
  return (
    <main className="container">
      <div className="pane" style={{ marginBottom: 12 }}>
        <h2>ME — Módulo de Estudo</h2>

        {/* filtros de data iguais ao MSR */}
        <div className="grid-3" style={{ marginTop: 12 }}>
          <div>
            <label>Símbolo</label>
            <input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="WIN / BTCUSDT..." />
          </div>
          <div>
            <label>Tempo Gráfico</label>
            <select value={timeframe} onChange={e=>setTimeframe(e.target.value)}>
              {TF_OPTIONS.map(tf => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </div>
          <div />
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          <div>
            <label>De</label>
            <input type="datetime-local" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          </div>
          <div>
            <label>Até</label>
            <input type="datetime-local" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          </div>
          <div />
        </div>
      </div>

      <div className="pane" style={{ marginBottom: 12 }}>
        <h3>Valores (copie da corretora/TradingView)</h3>
        <div className="grid-3" style={{ marginTop: 8 }}>
          <div><label>Preço Atual</label><input inputMode="decimal" value={priceNow} onChange={e=>setPriceNow(e.target.value)} /></div>
          <div><label>ATR %</label><input inputMode="decimal" value={atrPct} onChange={e=>setAtrPct(e.target.value)} placeholder="ex.: 0.80 para 0,80%" /></div>
          <div><label>VWAP</label><input inputMode="decimal" value={vwap} onChange={e=>setVwap(e.target.value)} /></div>
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          <div><label>RSI K</label><input inputMode="decimal" value={rsiK} onChange={e=>setRsiK(e.target.value)} /></div>
          <div><label>RSI D</label><input inputMode="decimal" value={rsiD} onChange={e=>setRsiD(e.target.value)} /></div>
          <div><label>Volume médio</label><input inputMode="decimal" value={volAvg} onChange={e=>setVolAvg(e.target.value)} /></div>
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          <div><label>EMA20</label><input inputMode="decimal" value={ema20} onChange={e=>setEma20(e.target.value)} /></div>
          <div><label>EMA200</label><input inputMode="decimal" value={ema200} onChange={e=>setEma200(e.target.value)} /></div>
          <div />
        </div>

        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          <button onClick={calcular}>Calcular</button>
          <button onClick={proximo}>Próximo</button>
          {signal && (
            <span className={`badge ${
              signal==='favoravel' ? 'good' : signal==='desfavoravel' ? 'bad' : 'warn'
            }`}>
              {signal==='favoravel'?'Favorável':signal==='desfavoravel'?'Desfavorável':'Neutro'}
            </span>
          )}
        </div>
      </div>

      {/* Opcional: liste/edite suas HL aqui */}
      <div className="pane">
        <h3>HL usadas (opcional)</h3>
        {(!hlRows || hlRows.length===0) ? (
          <div style={{opacity:.7}}>Sem HL. Você pode manter vazio ou preencher na lógica atual do seu ME.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Preço</th><th>TF</th><th>Tipo</th><th>Data</th></tr></thead>
            <tbody>
              {hlRows.map((r,i)=>(
                <tr key={r.id ?? i}>
                  <td>{Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td>{r.timeframe}</td>
                  <td>{r.type}</td>
                  <td>{r.at ? new Date(r.at).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

