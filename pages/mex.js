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

  const [rawRun, setRawRun] = useState(null);
  const [run, setRun] = useState(null);         // run normalizado
  const [loading, setLoading] = useState(!!id);
  const [userId, setUserId] = useState(null);
  const [mode, setMode] = useState('rompimento'); // 'rompimento' | 'pullback'
  const supabase = getSupabase();
  const printRef = useRef(null);

  // ---------- helpers de formatação ----------
  function formatNum(n) {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  function formatPct(n) {
    if (n === null || n === undefined || n === '') return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return `${num.toFixed(2).replace('.', ',')}%`;
  }

  function formatDate(val) {
    if (!val) return '—';
    // Supabase às vezes salva "YYYY-MM-DD HH:mm:ss". Troco espaço por "T".
    if (typeof val === 'string') {
      const isoish = val.includes('T') ? val : val.replace(' ', 'T');
      const d = new Date(isoish);
      if (isNaN(d.getTime())) return val; // mostra cru, mas não quebra
      return d.toLocaleString('pt-BR');
    }
    if (val instanceof Date) return val.toLocaleString('pt-BR');
    return String(val);
  }

  // ---------- normalização dos campos ----------
  function normNum(obj, keys, fallback = null) {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        const v = Number(obj[k]);
        if (Number.isFinite(v)) return v;
      }
    }
    return fallback;
  }

  function normStr(obj, keys, fallback = null) {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        return String(obj[k]);
      }
    }
    return fallback;
  }

  function normalizeRun(raw) {
    if (!raw) return null;

    // hl_rows pode vir como string JSON
    let hl = raw.hl_rows;
    if (typeof hl === 'string') {
      try { hl = JSON.parse(hl); } catch { hl = []; }
    }
    if (!Array.isArray(hl)) hl = [];

    // montar objeto padronizado
    const normalized = {
      id: raw.id,
      symbol: normStr(raw, ['symbol', 'sym', 'ticker']),
      timeframe: normStr(raw, ['timeframe', 'tf']),
      date_from: normStr(raw, ['date_from', 'from', 'period_from', 'start_at', 'start']),
      date_to: normStr(raw, ['date_to', 'to', 'period_to', 'end_at', 'end']),
      price_now: normNum(raw, ['price_now', 'price', 'last_price']),
      // ATR% direto; se não houver mas tiver ATR absoluto + preço, calcula
      atr_pct:
        normNum(raw, ['atr_pct', 'atrPercent', 'atrp']) ??
        (() => {
          const atrAbs = normNum(raw, ['atr']);
          const px = normNum(raw, ['price_now', 'price', 'last_price']);
          if (Number.isFinite(atrAbs) && Number.isFinite(px) && px !== 0) {
            return (atrAbs / px) * 100;
          }
          return null;
        })(),
      rsi_k: normNum(raw, ['rsi_k', 'rsiK']),
      rsi_d: normNum(raw, ['rsi_d', 'rsiD']),
      ema20: normNum(raw, ['ema20', 'ema_20']),
      ema200: normNum(raw, ['ema200', 'ema_200']),
      vol_avg: normNum(raw, ['vol_avg', 'volAvg', 'volume_avg']),
      mex_signal: normStr(raw, ['mex_signal', 'signal']),
      hl_rows: hl,
      user_id: raw.user_id,
      created_at: raw.created_at,
    };

    return normalized;
  }

  // ---------- níveis úteis (HL) ----------
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

  // ---------- efeitos ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id || null));
  }, [supabase]);

  useEffect(() => {
    if (!id) return;
    fetchRun(id);
  }, [id]);

  async function fetchRun(runId) {
    setLoading(true);
    const { data } = await supabase.from('mex_runs').select('*').eq('id', runId).single();
    setRawRun(data || null);
    setLoading(false);
  }

  useEffect(() => {
    setRun(normalizeRun(rawRun));
  }, [rawRun]);

  async function openLast() {
    if (!userId) return;
    const { data } = await supabase
      .from('mex_runs')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) router.push(`/mex?id=${data.id}`);
  }

  function gotoME() { router.push('/me'); }

  function exportPDF() {
    const node = printRef.current;
    if (!node) return;
    const html = `
      <html>
        <head>
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
        </head>
        <body>${node.innerHTML}</body>
      </html>
    `;
    const w = window.open('', '_blank');
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
  }

  // ---------- estados da tela ----------
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

  if (loading || !run) {
    return (
      <main className="container">
        <div className="pane">Carregando…</div>
      </main>
    );
  }

  const signalCls =
    run.mex_signal === 'favoravel' ? 'good' :
    run.mex_signal === 'desfavoravel' ? 'bad' :
    run.mex_signal === 'neutro' ? 'warn' : '';
  const signalTxt = run.mex_signal
    ? (run.mex_signal === 'favoravel' ? 'Favorável' :
       run.mex_signal === 'desfavoravel' ? 'Desfavorável' : 'Neutro')
    : '—';

  const { suporte1, suporte2, resistencia1, resistencia2 } = levelTargets(run);
  const px = Number(run.price_now || 0);

  // ---------- Stops & Alvos (com HL + fallback) ----------
  // Rompimento:
  const stopLongBreak = (suporte1 ?? (Number.isFinite(run.ema20) ? Math.min(run.ema20, px) : null));
  const targetLongBreakT1 = (resistencia1 ?? (Number.isFinite(run.ema200) ? Math.max(run.ema200, px) : null));
  const targetLongBreakT2 = (resistencia2 ?? null);

  const stopShortBreak = (resistencia1 ?? (Number.isFinite(run.ema200) ? Math.max(run.ema200, px) : null));
  const targetShortBreakT1 = (suporte1 ?? (Number.isFinite(run.ema20) ? Math.min(run.ema20, px) : null));
  const targetShortBreakT2 = (suporte2 ?? null);

  // Pullback:
  const stopLongPull = (suporte1 ?? (Number.isFinite(run.ema20) ? Math.min(run.ema20, px) : null));
  const targetLongPullT1 = (resistencia1 ?? (Number.isFinite(run.ema200) ? Math.max(run.ema200, px) : null));
  const targetLongPullT2 = (resistencia2 ?? null);

  const stopShortPull = (resistencia1 ?? (Number.isFinite(run.ema200) ? Math.max(run.ema200, px) : null));
  const targetShortPullT1 = (suporte1 ?? (Number.isFinite(run.ema20) ? Math.min(run.ema20, px) : null));
  const targetShortPullT2 = (suporte2 ?? null);

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
            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>Símbolo</label>
              <div>{run.symbol || '—'}</div>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>Tempo Gráfico</label>
              <div>{run.timeframe || '—'}</div>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>Período</label>
              <div>{formatDate(run.date_from)} → {formatDate(run.date_to)}</div>
            </div>

            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>Preço</label>
              <div>{formatNum(run.price_now)}</div>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>ATR%</label>
              <div>{formatPct(run.atr_pct)}</div>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>RSI K/D</label>
              <div>{formatNum(run.rsi_k)} / {formatNum(run.rsi_d)}</div>
            </div>

            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>EMA20</label>
              <div>{formatNum(run.ema20)}</div>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>EMA200</label>
              <div>{formatNum(run.ema200)}</div>
            </div>
            <div>
              <label style={{ color: 'var(--muted)', fontSize: 12 }}>Volume médio</label>
              <div>{formatNum(run.vol_avg)}</div>
            </div>
          </div>
        </div>

        {/* Gatilhos simples */}
        <div className="pane" style={{ marginBottom: 12 }}>
          <h3>Gatilhos simples ({mode === 'rompimento' ? 'Rompimento' : 'Pullback'}) — iniciante</h3>

          {mode === 'rompimento' ? (
            <>
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '8px 0' }}><b>Long (Compra por rompimento)</b></p>
                <ul>
                  <li>Espere um candle <b>fechar acima da EMA20</b>.</li>
                  <li>O <b>RSI K</b> deve estar <b>acima</b> do <b>D</b> (cruzamento para cima).</li>
                  <li>O <b>ATR%</b> precisa <b>aumentar</b>.</li>
                  <li><b>Stop</b>: {stopLongBreak ? <b>{formatNum(stopLongBreak)}</b> : 'abaixo da EMA20 ou do suporte mais próximo'}</li>
                  <li><b>Alvo T1</b>: {targetLongBreakT1 ? <b>{formatNum(targetLongBreakT1)}</b> : 'na resistência mais próxima'}</li>
                  {targetLongBreakT2 && <li><b>Alvo T2</b>: <b>{formatNum(targetLongBreakT2)}</b> (resistência seguinte)</li>}
                </ul>
              </div>

              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '8px 0' }}><b>Short (Venda por rompimento)</b></p>
                <ul>
                  <li>Espere um candle <b>fechar abaixo da EMA200</b>.</li>
                  <li>O <b>RSI K</b> deve estar <b>abaixo</b> do <b>D</b> (cruzamento para baixo).</li>
                  <li>O <b>ATR%</b> precisa <b>aumentar</b>.</li>
                  <li><b>Stop</b>: {stopShortBreak ? <b>{formatNum(stopShortBreak)}</b> : 'acima da EMA200 ou da resistência mais próxima'}</li>
                  <li><b>Alvo T1</b>: {targetShortBreakT1 ? <b>{formatNum(targetShortBreakT1)}</b> : 'no suporte mais próximo'}</li>
                  {targetShortBreakT2 && <li><b>Alvo T2</b>: <b>{formatNum(targetShortBreakT2)}</b> (suporte seguinte)</li>}
                </ul>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '8px 0' }}><b>Long (Compra por pullback)</b></p>
                <ul>
                  <li>Primeiro, o preço já deve estar <b>acima</b> da <b>EMA20</b>.</li>
                  <li>Espere um <b>recuo</b> até a <b>EMA20</b> ou até o <b>suporte</b> mais próximo.</li>
                  <li>Entre quando o <b>RSI K</b> cruzar <b>acima</b> do <b>D</b> novamente.</li>
                  <li><b>Stop</b>: {stopLongPull ? <b>{formatNum(stopLongPull)}</b> : 'logo abaixo da EMA20 ou do suporte testado'}</li>
                  <li><b>Alvo T1</b>: {targetLongPullT1 ? <b>{formatNum(targetLongPullT1)}</b> : 'na resistência mais próxima'}</li>
                  {targetLongPullT2 && <li><b>Alvo T2</b>: <b>{formatNum(targetLongPullT2)}</b> (resistência seguinte)</li>}
                </ul>
              </div>

              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '8px 0' }}><b>Short (Venda por pullback)</b></p>
                <ul>
                  <li>O preço já deve estar <b>abaixo</b> da <b>EMA200</b>.</li>
                  <li>Espere um <b>repique</b> até a <b>resistência</b> mais próxima ou até a <b>EMA200</b>.</li>
                  <li>Entre quando o <b>RSI K</b> cruzar <b>abaixo</b> do <b>D</b> novamente.</li>
                  <li><b>Stop</b>: {stopShortPull ? <b>{formatNum(stopShortPull)}</b> : 'logo acima da EMA200 ou da resistência testada'}</li>
                  <li><b>Alvo T1</b>: {targetShortPullT1 ? <b>{formatNum(targetShortPullT1)}</b> : 'no suporte mais próximo'}</li>
                  {targetShortPullT2 && <li><b>Alvo T2</b>: <b>{formatNum(targetShortPullT2)}</b> (suporte seguinte)</li>}
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
                    <td>
                      <span className={`pill ${cls}`}>
                        {Number(r.price).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </td>
                    <td className="center"><span className="badge tf">{r.timeframe}</span></td>
                    <td className="center"><span className={`badge ${cls}`}>{r.type}</span></td>
                    <td className="center">{r.at ? formatDate(r.at) : '—'}</td>
                  </tr>
                );
              })}
              {(!run.hl_rows || run.hl_rows.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ opacity: .7, padding: '12px 8px' }}>
                    Nenhuma HL no snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
