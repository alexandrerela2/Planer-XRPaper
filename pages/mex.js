import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabaseClient';
import Protected from '@/components/Protected';
import Header from '@/components/Header';

export default function MEX() {
  return (
    <Protected>
      <Header />
      <MEXContent />
    </Protected>
  );
}

function MEXContent() {
  const router = useRouter();
  const id = router.query.id;

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [userId, setUserId] = useState(null);

  const [mode, setMode] = useState('rompimento');   // 'rompimento' | 'pullback'
  const [showT2, setShowT2] = useState(true);        // switch Mostrar T2

  const supabase = getSupabase();
  const printRef = useRef(null);

  // ===== helpers =====
  const fmtNum = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  };
  const fmtPct = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return `${num.toFixed(2).replace('.', ',')}%`;
  };
  const fmtDate = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '—');

  // ===== carregar usuário & snapshot =====
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id || null));
  }, [supabase]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('mex_runs').select('*').eq('id', id).single();
      setRun(data || null);
      setLoading(false);
    })();
  }, [id, supabase]);

  const openLast = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('mex_runs')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) router.push(`/mex?id=${data.id}`);
  };
  const gotoME = () => router.push('/me');

  // ===== níveis úteis a partir das HL =====
  function levelTargets(run) {
    if (!run?.hl_rows?.length || !run.price_now) {
      return { suporte1: null, suporte2: null, resistencia1: null, resistencia2: null };
    }
    const px = Number(run.price_now);
    const supports = run.hl_rows
      .filter((r) => r.type === 'support')
      .map((r) => Number(r.price))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a); // desc
    const resistances = run.hl_rows
      .filter((r) => r.type === 'resistance')
      .map((r) => Number(r.price))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b); // asc

    const supsAbaixo = supports.filter((p) => p <= px);
    const suporte1 = supsAbaixo[0] ?? null;
    const suporte2 = supsAbaixo[1] ?? null;

    const ressAcima = resistances.filter((p) => p >= px);
    const resistencia1 = ressAcima[0] ?? null;
    const resistencia2 = ressAcima[1] ?? null;

    return { suporte1, suporte2, resistencia1, resistencia2 };
  }

  // ===== cálculo de stop/targets por modo =====
  const px = Number(run?.price_now || 0);
  const { suporte1, suporte2, resistencia1, resistencia2 } = levelTargets(run || {});

  // Rompimento:
  const stopLongBreak       = suporte1 ?? (Number.isFinite(run?.ema20)  ? Math.min(run.ema20,  px) : null);
  const targetLongBreakT1   = resistencia1 ?? (Number.isFinite(run?.ema200) ? Math.max(run.ema200, px) : null);
  const targetLongBreakT2   = resistencia2 ?? null;

  const stopShortBreak      = resistencia1 ?? (Number.isFinite(run?.ema200) ? Math.max(run.ema200, px) : null);
  const targetShortBreakT1  = suporte1 ?? (Number.isFinite(run?.ema20)  ? Math.min(run.ema20,  px) : null);
  const targetShortBreakT2  = suporte2 ?? null;

  // Pullback:
  const stopLongPull        = suporte1 ?? (Number.isFinite(run?.ema20)  ? Math.min(run.ema20,  px) : null);
  const targetLongPullT1    = resistencia1 ?? (Number.isFinite(run?.ema200) ? Math.max(run.ema200, px) : null);
  const targetLongPullT2    = resistencia2 ?? null;

  const stopShortPull       = resistencia1 ?? (Number.isFinite(run?.ema200) ? Math.max(run.ema200, px) : null);
  const targetShortPullT1   = suporte1 ?? (Number.isFinite(run?.ema20)  ? Math.min(run.ema20,  px) : null);
  const targetShortPullT2   = suporte2 ?? null;

  // ===== RR (Risco/Retorno) =====
  function rrLong(entry, stop, target) {
    if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return null;
    const risco   = entry - stop;           // só faz sentido se stop < entry
    const retorno = target - entry;
    if (risco <= 0) return null;
    return retorno / risco;
  }
  function rrShort(entry, stop, target) {
    if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return null;
    const risco   = stop - entry;           // só faz sentido se stop > entry
    const retorno = entry - target;
    if (risco <= 0) return null;
    return retorno / risco;
  }
  const fmtRR = (v) => (v == null ? '—' : v.toFixed(2).replace('.', ','));

  // Rompimento RR
  const rrLongBreakT1  = rrLong(px,  stopLongBreak,  targetLongBreakT1);
  const rrLongBreakT2  = rrLong(px,  stopLongBreak,  targetLongBreakT2);
  const rrShortBreakT1 = rrShort(px, stopShortBreak, targetShortBreakT1);
  const rrShortBreakT2 = rrShort(px, stopShortBreak, targetShortBreakT2);

  // Pullback RR
  const rrLongPullT1   = rrLong(px,  stopLongPull,  targetLongPullT1);
  const rrLongPullT2   = rrLong(px,  stopLongPull,  targetLongPullT2);
  const rrShortPullT1  = rrShort(px, stopShortPull, targetShortPullT1);
  const rrShortPullT2  = rrShort(px, stopShortPull, targetShortPullT2);

  // ===== export PDF =====
  function exportPDF() {
    const node = printRef.current;
    if (!node) return;
    const html = `
      <html><head>
        <meta charset="utf-8"/>
        <title>XRPaper - MEX</title>
        <style>
          body{ font:14px/1.5 Inter,system-ui,Segoe UI,Roboto,Arial; color:#111; padding:24px; }
          h1,h2,h3{ margin:0 0 10px 0 }
          .section{ border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; }
          table{ width:100%; border-collapse:collapse; margin-top:8px }
          th,td{ border-top:1px solid #ddd; padding:8px 6px; text-align:left }
          .muted{ color:#555 }
          ul{ margin:8px 0 0 18px }
        </style>
      </head><body>${node.innerHTML}</body></html>`;
    const w = window.open('', '_blank');
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
  }

  // ===== estados da tela =====
  if (!id) {
    return (
      <main className="container">
        <div className="pane" style={{ marginBottom: 12 }}>
          <h2>MEX — Execução</h2>
          <p style={{ marginTop: 8, color: 'var(--muted)' }}>
            Nenhum snapshot carregado ainda. Vá ao módulo <b>ME</b>, clique <b>Calcular</b> e depois <b>Próximo</b> para enviar os valores para cá.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={gotoME}>Ir para ME</button>
            {userId && <button onClick={openLast}>Abrir último snapshot</button>}
          </div>
        </div>
      </main>
    );
  }

  if (loading)   return <main className="container"><div className="pane">Carregando…</div></main>;
  if (!run)      return <main className="container"><div className="pane">Snapshot não encontrado.</div></main>;

  const signalCls =
    run.mex_signal === 'favoravel'   ? 'good' :
    run.mex_signal === 'desfavoravel'? 'bad'  :
    run.mex_signal === 'neutro'      ? 'warn' : '';
  const signalTxt = run.mex_signal
    ? (run.mex_signal === 'favoravel' ? 'Favorável' :
       run.mex_signal === 'desfavoravel' ? 'Desfavorável' : 'Neutro')
    : '—';

  return (
    <main className="container">
      <div className="pane" style={{ marginBottom: 12 }}>
        <h2>MEX — Execução</h2>

        <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="mode"
              value="rompimento"
              checked={mode === 'rompimento'}
              onChange={() => setMode('rompimento')}
            />
            Rompimento
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="mode"
              value="pullback"
              checked={mode === 'pullback'}
              onChange={() => setMode('pullback')}
            />
            Pullback
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showT2}
              onChange={(e) => setShowT2(e.target.checked)}
            />
            Mostrar T2
          </label>

          <button onClick={exportPDF} style={{ marginLeft: 'auto' }}>Exportar PDF</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <span className={`badge ${signalCls || ''}`} style={{ marginRight: 8 }}>{signalTxt}</span>
          <span style={{ color: 'var(--muted)' }}>Resumo do ME salvo para execução.</span>
        </div>
      </div>

      {/* BLOCO IMPRIMÍVEL */}
      <div ref={printRef}>
        {/* Resumo */}
        <div className="pane" style={{ marginBottom: 12 }}>
          <h3>Resumo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }}>
            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>Símbolo</label><div>{run.symbol || '—'}</div></div>
            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>Tempo Gráfico</label><div>{run.timeframe || '—'}</div></div>
            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>Período</label><div>{fmtDate(run.date_from)} → {fmtDate(run.date_to)}</div></div>

            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>Preço</label><div>{fmtNum(run.price_now)}</div></div>
            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>ATR%</label><div>{fmtPct(run.atr_pct)}</div></div>
            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>RSI K/D</label><div>{fmtNum(run.rsi_k)} / {fmtNum(run.rsi_d)}</div></div>

            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>EMA20</label><div>{fmtNum(run.ema20)}</div></div>
            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>EMA200</label><div>{fmtNum(run.ema200)}</div></div>
            <div><label style={{ color: 'var(--muted)', fontSize: 12 }}>Volume médio</label><div>{fmtNum(run.vol_avg)}</div></div>
          </div>
        </div>

        {/* Gatilhos simples + RR */}
        <div className="pane" style={{ marginBottom: 12 }}>
          <h3>Gatilhos simples ({mode === 'rompimento' ? 'Rompimento' : 'Pullback'}) — iniciante</h3>

          {mode === 'rompimento' ? (
            <>
              {/* LONG Rompimento */}
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '8px 0' }}><b>Long (Compra por rompimento)</b></p>
                <ul>
                  <li>Espere um candle <b>fechar acima da EMA20</b>.</li>
                  <li>O <b>RSI K</b> deve estar <b>acima</b> do <b>D</b>.</li>
                  <li>O <b>ATR%</b> precisa <b>aumentar</b>.</li>
                  <li>
                    <b>Stop</b>: {stopLongBreak ? <b>{fmtNum(stopLongBreak)}</b> : 'abaixo da EMA20/suporte'} •
                    <b> RR T1:</b> {fmtRR(rrLongBreakT1)}
                    {showT2 && <> • <b>RR T2:</b> {fmtRR(rrLongBreakT2)}</>}
                  </li>
                  <li>
                    <b>Alvo T1</b>: {targetLongBreakT1 ? <b>{fmtNum(targetLongBreakT1)}</b> : 'resistência mais próxima'}
                    {showT2 && targetLongBreakT2 && <> • <b>Alvo T2:</b> <b>{fmtNum(targetLongBreakT2)}</b></>}
                  </li>
                </ul>
              </div>

              {/* SHORT Rompimento */}
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '8px 0' }}><b>Short (Venda por rompimento)</b></p>
                <ul>
                  <li>Espere um candle <b>fechar abaixo da EMA200</b>.</li>
                  <li>O <b>RSI K</b> deve estar <b>abaixo</b> do <b>D</b>.</li>
                  <li>O <b>ATR%</b> precisa <b>aumentar</b>.</li>
                  <li>
                    <b>Stop</b>: {stopShortBreak ? <b>{fmtNum(stopShortBreak)}</b> : 'acima da EMA200/resistência'} •
                    <b> RR T1:</b> {fmtRR(rrShortBreakT1)}
                    {showT2 && <> • <b>RR T2:</b> {fmtRR(rrShortBreakT2)}</>}
                  </li>
                  <li>
                    <b>Alvo T1</b>: {targetShortBreakT1 ? <b>{fmtNum(targetShortBreakT1)}</b> : 'suporte mais próximo'}
                    {showT2 && targetShortBreakT2 && <> • <b>Alvo T2:</b> <b>{fmtNum(targetShortBreakT2)}</b></>}
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* LONG Pullback */}
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '8px 0' }}><b>Long (Compra por pullback)</b></p>
                <ul>
                  <li>Preço já <b>acima da EMA20</b> (tendência curta de alta).</li>
                  <li>Espere um <b>recuo</b> até a EMA20 ou o <b>suporte</b> mais próximo.</li>
                  <li>Entre quando o <b>RSI K</b> cruzar <b>acima</b> do <b>D</b> novamente.</li>
                  <li>
                    <b>Stop</b>: {stopLongPull ? <b>{fmtNum(stopLongPull)}</b> : 'abaixo da EMA20/suporte testado'} •
                    <b> RR T1:</b> {fmtRR(rrLongPullT1)}
                    {showT2 && <> • <b>RR T2:</b> {fmtRR(rrLongPullT2)}</>}
                  </li>
                  <li>
                    <b>Alvo T1</b>: {targetLongPullT1 ? <b>{fmtNum(targetLongPullT1)}</b> : 'resistência mais próxima'}
                    {showT2 && targetLongPullT2 && <> • <b>Alvo T2:</b> <b>{fmtNum(targetLongPullT2)}</b></>}
                  </li>
                </ul>
              </div>

              {/* SHORT Pullback */}
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '8px 0' }}><b>Short (Venda por pullback)</b></p>
                <ul>
                  <li>Preço já <b>abaixo da EMA200</b> (tendência mais longa de baixa).</li>
                  <li>Espere um <b>repique</b> até a <b>resistência</b> mais próxima ou até a EMA200.</li>
                  <li>Entre quando o <b>RSI K</b> cruzar <b>abaixo</b> do <b>D</b> novamente.</li>
                  <li>
                    <b>Stop</b>: {stopShortPull ? <b>{fmtNum(stopShortPull)}</b> : 'acima da EMA200/resistência testada'} •
                    <b> RR T1:</b> {fmtRR(rrShortPullT1)}
                    {showT2 && <> • <b>RR T2:</b> {fmtRR(rrShortPullT2)}</>}
                  </li>
                  <li>
                    <b>Alvo T1</b>: {targetShortPullT1 ? <b>{fmtNum(targetShortPullT1)}</b> : 'suporte mais próximo'}
                    {showT2 && targetShortPullT2 && <> • <b>Alvo T2:</b> <b>{fmtNum(targetShortPullT2)}</b></>}
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* HL do snapshot */}
        <div className="pane">
          <h3>Linhas HL do snapshot</h3>
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
              {(run.hl_rows || []).map((r) => {
                const cls = r.type === 'support'
                  ? 'support'
                  : (r.type === 'resistance' ? 'resistance' : 'undefined');
                return (
                  <tr key={r.id ?? `${r.price}-${r.timeframe}-${r.type}`}>
                    <td><span className={`pill ${cls}`}>{Number(r.price).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</span></td>
                    <td className="center"><span className="badge tf">{r.timeframe}</span></td>
                    <td className="center"><span className={`badge ${cls}`}>{r.type}</span></td>
                    <td className="center">{r.at ? new Date(r.at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                );
              })}
              {(!run.hl_rows || run.hl_rows.length === 0) && (
                <tr><td colSpan={4} style={{ opacity: .7, padding: '12px 8px' }}>Nenhuma HL no snapshot.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
