// pages/me.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Protected from "@/components/Protected";
import Header from "@/components/Header";
import { getSupabase } from "@/lib/supabaseClient";

const TF_OPTIONS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

function toIso(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toLocalInputValue(v) {
  // formata para datetime-local: YYYY-MM-DDTHH:mm
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalInputValue(str) {
  // recebe "YYYY-MM-DDTHH:mm" e devolve Date
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export default function ME() {
  const router = useRouter();
  const supabase = getSupabase();

  // filtros
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tf, setTf] = useState("5m");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState(() => new Date());

  // valores (copiados da corretora)
  const [price, setPrice] = useState("");   // preço atual
  const [atrAbs, setAtrAbs] = useState(""); // ATR absoluto (NÃO %)
  const [rsiK, setRsiK] = useState("");
  const [rsiD, setRsiD] = useState("");
  const [ema20, setEma20] = useState("");
  const [ema200, setEma200] = useState("");
  const [vwap, setVwap] = useState("");
  const [volAvg, setVolAvg] = useState("");

  // HL vindas do MSR
  const [hlList, setHlList] = useState([]);

  // status simples (didático)
  const [status, setStatus] = useState("Neutro");

  // carregar HLs ao mudar symbol/tf/período
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!symbol || !tf || !from || !to) return;
      const fromIso = toIso(from);
      const toIsoStr = toIso(to);
      try {
        const { data, error } = await supabase
          .from("hl_lines")
          .select("id, price, tf, type, created_at")
          .eq("symbol", symbol)
          .eq("tf", tf)
          .gte("created_at", fromIso)
          .lte("created_at", toIsoStr)
          .order("price", { ascending: false });

        if (error) throw error;
        if (!cancelled) setHlList(data || []);
      } catch (err) {
        console.error("Erro ao carregar HLs:", err.message || err);
        if (!cancelled) setHlList([]);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol, tf, from, to, supabase]);

  // “humor” didático
  const mood = useMemo(() => {
    const p = Number(price);
    const e20 = Number(ema20);
    const e200 = Number(ema200);
    const k = Number(rsiK);
    const d = Number(rsiD);

    let score = 0;
    if (Number.isFinite(p) && Number.isFinite(e20) && p > e20) score += 1;
    if (Number.isFinite(p) && Number.isFinite(e200) && p > e200) score += 1;
    if (Number.isFinite(k) && Number.isFinite(d) && k > d) score += 1;
    if (Number(atrAbs) > 0) score += 1;

    if (score >= 3) return "Favorável";
    if (score <= 1) return "Desfavorável";
    return "Neutro";
  }, [price, ema20, ema200, rsiK, rsiD, atrAbs]);

  function handleCalcular(e) {
    e.preventDefault();
    setStatus(mood);
  }

  async function handleProximo() {
    try {
      const payload = {
        symbol,
        timeframe: tf,
        date_from: toIso(from),
        date_to: toIso(to),
        price_now: Number(price) || null,
        atr_abs: Number(atrAbs) || null, // ATR absoluto salvo aqui
        rsi_k: Number(rsiK) || null,
        rsi_d: Number(rsiD) || null,
        ema20: Number(ema20) || null,
        ema200: Number(ema200) || null,
        vwap: Number(vwap) || null,
        vol_avg: Number(volAvg) || null,
        mex_signal: status,
        hl_rows: (hlList || []).map((h) => ({
          price: h.price,
          timeframe: h.tf,
          type: h.type,
          at: h.created_at,
        })),
      };

      const { data, error } = await supabase
        .from("mex_runs")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      router.push(`/mex?id=${data.id}`);
    } catch (err) {
      alert("Erro ao salvar snapshot: " + (err.message || err));
    }
  }

  return (
    <Protected>
      <Header />
      <main className="container">
        <h1 className="title">ME — Módulo de Estudo</h1>

        {/* Filtros topo */}
        <section className="card">
          <div className="grid-4">
            <div>
              <label>Símbolo</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
              />
            </div>

            <div>
              <label>Tempo Gráfico</label>
              <select value={tf} onChange={(e) => setTf(e.target.value)}>
                {TF_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label>De</label>
              <input
                type="datetime-local"
                value={toLocalInputValue(from)}
                onChange={(e) => setFrom(fromLocalInputValue(e.target.value))}
              />
            </div>

            <div>
              <label>Até</label>
              <input
                type="datetime-local"
                value={toLocalInputValue(to)}
                onChange={(e) => setTo(fromLocalInputValue(e.target.value))}
              />
            </div>
          </div>
        </section>

        {/* Valores copiados da corretora */}
        <section className="card">
          <h3 className="card-title">Valores (copie da corretora/TradingView)</h3>
          <form onSubmit={handleCalcular}>
            <div className="grid-3">
              <div>
                <label>Preço Atual</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="ex.: 112863"
                />
              </div>

              <div>
                <label>ATR (valor absoluto)</label>
                <input
                  value={atrAbs}
                  onChange={(e) => setAtrAbs(e.target.value)}
                  placeholder="ex.: 89.74"
                />
              </div>

              <div>
                <label>VWAP</label>
                <input
                  value={vwap}
                  onChange={(e) => setVwap(e.target.value)}
                  placeholder="ex.: 112900"
                />
              </div>

              <div>
                <label>RSI K</label>
                <input
                  value={rsiK}
                  onChange={(e) => setRsiK(e.target.value)}
                  placeholder="ex.: 34.96"
                />
              </div>

              <div>
                <label>RSI D</label>
                <input
                  value={rsiD}
                  onChange={(e) => setRsiD(e.target.value)}
                  placeholder="ex.: 51.54"
                />
              </div>

              <div>
                <label>Volume médio</label>
                <input
                  value={volAvg}
                  onChange={(e) => setVolAvg(e.target.value)}
                  placeholder="ex.: 9.71"
                />
              </div>

              <div>
                <label>EMA20</label>
                <input
                  value={ema20}
                  onChange={(e) => setEma20(e.target.value)}
                  placeholder="ex.: 112927"
                />
              </div>

              <div>
                <label>EMA200</label>
                <input
                  value={ema200}
                  onChange={(e) => setEma200(e.target.value)}
                  placeholder="ex.: 112809"
                />
              </div>

              <div className="statusBox">
                <span className={`badge ${statusBadge(status)}`}>{status}</span>
              </div>
            </div>

            <div className="row-actions">
              <button type="submit" className="btn primary">Calcular</button>
              <button type="button" className="btn" onClick={handleProximo}>Próximo</button>
            </div>
          </form>
        </section>

        {/* HL usadas (opcional) — puxadas do MSR pelo TF+período */}
        <section className="card">
          <h3 className="card-title">HL usadas (opcional)</h3>
          {hlList?.length === 0 ? (
            <p className="muted">Sem HL para os filtros atuais.</p>
          ) : (
            <div className="table">
              <div className="thead">
                <div>Preço</div>
                <div>TF</div>
                <div>Tipo</div>
                <div>Data</div>
              </div>
              {hlList.map((h) => (
                <div className="trow" key={h.id}>
                  <div>{Number(h.price).toLocaleString("pt-BR")}</div>
                  <div><span className="pill">{h.tf}</span></div>
                  <div><span className={`pill ${typePill(h.type)}`}>{h.type || "undefined"}</span></div>
                  <div>{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
        .container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .title { font-size: 22px; margin: 8px 0 18px; }
        .card { background:#0e1623; border:1px solid #1e2a3d; border-radius:12px; padding:16px; margin-bottom:16px; }
        .card-title { margin:0 0 12px; font-size:16px; opacity:.9; }
        label { display:block; margin-bottom:6px; font-size:13px; opacity:.8; }
        input, select { width:100%; background:#0b1320; border:1px solid #243048; color:#cfe0ff; border-radius:10px; padding:10px 12px; height:40px; }
        .grid-4 { display:grid; gap:12px; grid-template-columns: repeat(4, 1fr); }
        .grid-3 { display:grid; gap:12px; grid-template-columns: repeat(3, 1fr); }
        .row-actions { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; }
        .btn { background:#18243a; border:1px solid #2b3b57; color:#d9e6ff; border-radius:10px; padding:10px 16px; height:40px; }
        .btn.primary { background:#1a4fff; border-color:#1a4fff; color:#fff; }
        .statusBox { display:flex; align-items:flex-end; justify-content:flex-end; }
        .badge { padding:6px 10px; border-radius:999px; font-size:12px; }
        .ok { background:#0f5132; color:#d1f7e3; }
        .warn { background:#4d2f00; color:#ffd8a8; }
        .bad { background:#5c1a1a; color:#ffd6d6; }
        .muted { opacity:.8; }
        .table { display:flex; flex-direction:column; gap:6px; }
        .thead, .trow { display:grid; grid-template-columns: 1.2fr .4fr .7fr 1fr; gap:8px; padding:8px 10px; }
        .thead { opacity:.7; }
        .trow { background:#0b1320; border:1px solid #1f2c44; border-radius:10px; }
        .pill { padding:4px 8px; border-radius:999px; background:#142038; font-size:12px; }
        .pill.green { background:#103a22; color:#bdf0d2; }
        .pill.yellow { background:#3a320f; color:#ffe8a1; }
        .pill.red { background:#3a1010; color:#ffc9c9; }
        @media (max-width: 920px) {
          .grid-4 { grid-template-columns: 1fr 1fr; }
          .grid-3 { grid-template-columns: 1fr 1fr; }
          .thead, .trow { grid-template-columns: 1fr .4fr .7fr 1fr; }
        }
        @media (max-width: 560px) {
          .grid-4, .grid-3 { grid-template-columns: 1fr; }
        }
      `}</style>
    </Protected>
  );
}

function statusBadge(s) {
  if (s === "Favorável") return "ok";
  if (s === "Desfavorável") return "bad";
  return "warn";
}
function typePill(t) {
  if (t === "support") return "green";
  if (t === "resistance") return "red";
  return "yellow";
}

