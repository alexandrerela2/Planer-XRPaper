import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
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
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tfFilter, setTfFilter] = useState([]);

  const [price, setPrice] = useState('');
  const [timeframe, setTimeframe] = useState('5m');
  const [type, setType] = useState('support');
  const [at, setAt] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => { if (session) fetchRows(); }, [session, symbol]);

  async function fetchRows(){
    const { data, error } = await supabase
      .from('hl_lines')
      .select('*')
      .eq('symbol', symbol)
      .order('price', { ascending: false });
    if (!error) setRows(data || []);
  }

  async function addRow(){
    if (!price) return;
    const user_id = session.user.id;
    const payload = { user_id, symbol, timeframe, type, price: Number(price) };
    if (at) payload.at = new Date(at).toISOString();
    const { error } = await supabase.from('hl_lines').insert(payload);
    if (!error){
      setPrice(''); setAt('');
      fetchRows();
    }
  }

  async function removeRow(id){
    await supabase.from('hl_lines').delete().eq('id', id);
    fetchRows();
  }

  const filtered = useMemo(() => {
    if (!tfFilter.length) return rows;
    return rows.filter(r => tfFilter.includes(r.timeframe));
  }, [rows, tfFilter]);

  return (
    <main style={{maxWidth:960,margin:'20px auto',padding:16}}>
      <h2>MSR — Suportes & Resistências</h2>

      <section style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:8,margin:'12px 0'}}>
        <input placeholder="Preço do ativo" value={price} onChange={e=>setPrice(e.target.value)} />
        <select value={timeframe} onChange={e=>setTimeframe(e.target.value)}>
          {TF_OPTIONS.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="support">suporte</option>
          <option value="resistance">resistência</option>
          <option value="undefined">indefinido</option>
        </select>
        <input type="datetime-local" value={at} onChange={e=>setAt(e.target.value)} />
        <button onClick={addRow}>Gravar</button>
      </section>

      <section style={{display:'flex',gap:8,alignItems:'center'}}>
        <label>Símbolo:</label>
        <input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} style={{width:120}} />
        <label>Filtro TF:</label>
        <select multiple value={tfFilter} onChange={(e)=>setTfFilter(Array.from(e.target.selectedOptions, o=>o.value))}>
          {TF_OPTIONS.map(t => <option key={t}>{t}</option>)}
        </select>
        <button onClick={()=>setTfFilter([])}>Limpar filtro</button>
      </section>

      <table style={{width:'100%',marginTop:16,borderCollapse:'collapse'}}>
        <thead>
          <tr>
            <th style={{textAlign:'left'}}>Preço</th>
            <th>TF</th>
            <th>Tipo</th>
            <th>Data</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id} style={{borderTop:'1px solid #eee'}}>
              <td>{Number(r.price).toLocaleString()}</td>
              <td style={{textAlign:'center'}}>{r.timeframe}</td>
              <td style={{textAlign:'center', color: r.type==='support'?'green':r.type==='resistance'?'crimson':'#b8860b'}}>{r.type}</td>
              <td style={{textAlign:'center'}}>{new Date(r.at).toLocaleString('pt-BR')}</td>
              <td style={{textAlign:'right'}}>
                <button onClick={()=>removeRow(r.id)}>Excluir</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={5} style={{padding:12,opacity:.7}}>Nenhuma linha. Adicione com o formulário acima.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
