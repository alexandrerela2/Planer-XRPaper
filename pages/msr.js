import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import Protected from '@/components/Protected';
import Header from '@/components/Header';

const TF_OPTIONS = ['1m','5m','15m','30m','1h','1d','1w','1mo','1y'];

export default function MSR(){
  return (
    <Protected>
      <Header />
      <MSRContent />
    </Protected>
  );
}

function MSRContent(){
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);

  // formulário de cadastro
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [price, setPrice] = useState('');
  const [timeframe, setTimeframe] = useState('5m');
  const [type, setType] = useState('support');
  const [at, setAt] = useState('');

  // filtro TF e período
  const [tfFilter, setTfFilter] = useState(''); // '' = todos
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => { if (session) fetchRows(); }, [session, symbol, tfFilter, dateFrom, dateTo]);

  function toIsoOrNull(v){
    if(!v) return null;
    const d = new Date(v);
    return isNaN(+d) ? null : d.toISOString();
  }

  async function fetchRows(){
    let q = getSupabase()
      .from('hl_lines')
      .select('*')
      .eq('symbol', symbol);

    if (tfFilter) q = q.eq('timeframe', tfFilter);

    const fIso = toIsoOrNull(dateFrom);
    const tIso = toIsoOrNull(dateTo);
    if (fIso) q = q.gte('at', fIso);
    if (tIso) q = q.lte('at', tIso);

    q = q.order('price', { ascending: false });

    const { data, error } = await q;
    if (!error) setRows(data || []);
  }

  async function addRow(){
    if (!price) return;
    const user_id = session.user.id;
    const payload = { user_id, symbol, timeframe, type, price: Number(String(price).replace(',','.')) };
    if (at) payload.at = new Date(at).toISOString();
    const { error } = await getSupabase().from('hl_lines').insert(payload);
    if (!error){ setPrice(''); setAt(''); fetchRows(); }
  }

  async function removeRow(id){
    await getSupabase().from('hl_lines').delete().eq('id', id);
    fetchRows();
  }

  const filtered = useMemo(() => rows, [rows]);

  return (
    <main className="container">
      {/* Painel de cadastro */}
      <div className="pane" style={{marginBottom:12}}>
        <h2>MSR — Suportes &amp; Resistências</h2>

        <div className="controls" style={{marginTop:10}}>
          <input placeholder="Preço do ativo" value={price} onChange={e=>setPrice(e.target.value)} />
          <select value={timeframe} onChange={e=>setTimeframe(e.target.value)}>
            {TF_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="support">suporte</option>
            <option value="resistance">resistência</option>
            <option value="undefined">indefinido</option>
          </select>
          <div className="grid-5">
            <input type="datetime-local" value={at} onChange={e=>setAt(e.target.value)} />
            <button onClick={addRow}>Gravar</button>
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="pane" style={{marginBottom:12}}>
        <div style={{display:'grid', gridTemplateColumns:'160px 160px 200px 200px auto', gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <label>TF:</label>
            <select value={tfFilter} onChange={e=>setTfFilter(e.target.value)}>
              <option value="">(todos)</option>
              {TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <span></span>
          <div>
            <label style={{display:'block', fontSize:12, color:'var(--muted)'}}>De</label>
            <input type="datetime-local" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          </div>
          <div>
            <label style={{display:'block', fontSize:12, color:'var(--muted)'}}>Até</label>
            <input type="datetime-local" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          </div>
          <div style={{display:'flex', alignItems:'end'}}>
            <button onClick={()=>{ setDateFrom(''); setDateTo(''); }}>Limpar período</button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="pane">
        <table className="table">
          <thead>
            <tr>
              <th>Preço</th>
              <th className="center">TF</th>
              <th className="center">Tipo</th>
              <th className="center">Data</th>
              <th className="right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const cls = r.type==='support' ? 'support' : (r.type==='resistance' ? 'resistance' : 'undefined');
              return (
                <tr key={r.id}>
                  <td><span className={`pill ${cls}`}>{Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</span></td>
                  <td className="center"><span className="badge tf">{r.timeframe}</span></td>
                  <td className="center"><span className={`badge ${cls}`}>{r.type}</span></td>
                  <td className="center">{new Date(r.at).toLocaleString('pt-BR')}</td>
                  <td className="right"><button onClick={()=>removeRow(r.id)}>Excluir</button></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{opacity:.7,padding:'12px 8px'}}>Sem resultados para os filtros aplicados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
