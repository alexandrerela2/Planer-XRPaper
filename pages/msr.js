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

  // FILTRO TF — agora select simples (igual ao cadastro)
  const [tfFilter, setTfFilter] = useState(''); // '' = sem filtro

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => { if (session) fetchRows(); }, [session, symbol]);

  async function fetchRows(){
    const { data, error } = await getSupabase()
      .from('hl_lines')
      .select('*')
      .eq('symbol', symbol)
      .order('price', { ascending: false });
    if (!error) setRows(data || []);
  }

  async function addRow(){
    if (!price) return;
    const user_id = session.user.id;
    const payload = { user_id, symbol, timeframe, type, price: Number(String(price).replace(',','.')) };
    if (at) payload.at = new Date(at).toISOString();
    const { error } = await getSupabase().from('hl_lines').insert(payload);
    if (!error){
      setPrice(''); setAt('');
      fetchRows();
    }
  }

  async function removeRow(id){
    await getSupabase().from('hl_lines').delete().eq('id', id);
    fetchRows();
  }

  // aplica filtro simples
  const filtered = useMemo(() => {
    if (!tfFilter) return rows;
    return rows.filter(r => r.timeframe === tfFilter);
  }, [rows, tfFilter]);

  return (
    <main className="container">
      {/* Painel de cadastro */}
      <div className="pane" style={{marginBottom:12}}>
        <h2>MSR — Suportes &amp; Resistências</h2>

        <div className="controls" style={{marginTop:10}}>
          <input
            placeholder="Preço do ativo"
            value={price}
            onChange={e=>setPrice(e.target.value)}
          />
          {/* TF igual ao cadastro */}
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

      {/* Painel de listagem + filtros */}
      <div className="pane">
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
          <label>Símbolo:</label>
          <input
            value={symbol}
            onChange={e=>setSymbol(e.target.value.toUpperCase())}
            style={{width:140}}
          />

          <label style={{marginLeft:12}}>Filtro TF:</label>
          {/* ⬇️ Agora igual ao cadastro: select simples */}
          <select value={tfFilter} onChange={e=>setTfFilter(e.target.value)}>
            <option value="">(todos)</option>
            {TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <button onClick={()=>setTfFilter('')}>Limpar filtro</button>
        </div>

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
                  {/* ⬇️ Preço com a MESMA paleta do TIPO */}
                  <td>
                    <span className={`pill ${cls}`}>
                      {Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}
                    </span>
                  </td>
                  <td className="center">{r.timeframe}</td>
                  <td className="center">
                    <span className={`badge ${cls}`}>{r.type}</span>
                  </td>
                  <td className="center">{new Date(r.at).toLocaleString('pt-BR')}</td>
                  <td className="right">
                    <button onClick={()=>removeRow(r.id)}>Excluir</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{opacity:.7,padding:'12px 8px'}}>Nenhuma linha. Adicione no formulário acima.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
