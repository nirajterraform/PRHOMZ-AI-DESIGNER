import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * DesignPreview — LOCAL, backend-free preview of the proposed "warm editorial"
 * redesign (deep-green shell + brass accent, Fraunces/Archivo). Mirrors the
 * reference HTML the stakeholder liked, now reconciled with the real product:
 *   - Design Direction = same dropdown + refine note as the preview channel,
 *     using the real DESIGN_PRESETS style names.
 *   - Quota pill (used/limit today · used/limit month) like the preview channel.
 *   - Upload-new control once a photo is added.
 *   - Numbered 1·2·3 steps.
 *   - "Your designs" strip shows real room renders (style variants of the photo),
 *     not abstract geometry; switching cleanly swaps the design (no merge).
 *
 * Default showcase uses the real landing-page before/after pair. Not imported
 * by the live app (only /preview.tsx). All interactions are mock — no backend,
 * nothing uploaded.
 */

// Real landing-page default before/after (master-bedroom pair from prhomzai.com gallery).
const LANDING_BEFORE = 'https://files.elfsightcdn.com/eafe4a4d-3436-495d-b748-5bdce62d911d/693f4b74-d27c-424e-b077-f28b534017a9/WhatsApp-Image-2026-04-20-at-2-32-07-PM.jpg';
const LANDING_AFTER = 'https://files.elfsightcdn.com/eafe4a4d-3436-495d-b748-5bdce62d911d/9ff057c5-c1d3-4ed9-95f6-b9833524590d/remodel-28-.png';

const NAV = ['Remodel', 'Assistant', 'Gallery', 'Membership'];

// Same style NAMES as the live app (types.ts DESIGN_PRESETS). Kept the green
// swatch-tile look the stakeholder liked — only the naming convention matches
// the preview channel. `filter` mocks a distinct render per style.
const PRESETS = [
  { id: 'modern', label: 'Modern Chic', bg: 'linear-gradient(150deg,#E9ECEF 0%,#C4CDD3 100%)', fg: '#2A3138', filter: 'none' },
  { id: 'boho', label: 'Bohemian', bg: 'linear-gradient(150deg,#D2A87A 0%,#A9724A 100%)', fg: '#33241A', filter: 'saturate(1.16) sepia(.16) brightness(1.02)' },
  { id: 'japandi', label: 'Japandi', bg: 'linear-gradient(150deg,#4A5149 0%,#333B34 100%)', fg: '#E4E8E1', filter: 'saturate(.82) sepia(.12) brightness(1.03)' },
  { id: 'coastal', label: 'Coastal Modern', bg: 'linear-gradient(150deg,#BFE0EE 0%,#7FA9BD 100%)', fg: '#17313B', filter: 'saturate(1.06) hue-rotate(-8deg) brightness(1.05)' },
  { id: 'industrial', label: 'Industrial Loft', bg: 'linear-gradient(150deg,#3A4250 0%,#242A34 100%)', fg: '#DDE2EA', filter: 'saturate(.72) contrast(1.08) brightness(.95)' },
  { id: 'transitional', label: 'Transitional Luxe', bg: 'linear-gradient(150deg,#E3D7C6 0%,#C4B49B 100%)', fg: '#33291A', filter: 'contrast(1.04) brightness(1.02)' },
];

// Mock quota to mirror the preview channel's pill.
const QUOTA = { dailyUsed: 1, dailyLimit: 3, monthUsed: 6, monthLimit: 30 };

const CSS = `
.nd, .nd *{box-sizing:border-box;margin:0;padding:0}
.nd{
  --ink:#1B221D;--shell:#232C26;--panel:#2B352E;--raise:#344039;--line:#3E4B43;--line-2:#4C5B52;
  --bone:#EDE8DB;--bone-2:#C3C9BF;--muted:#8E9A90;--brass:#C9A063;--brass-dim:#8A6E42;--r:10px;
  position:fixed;inset:0;background:var(--ink);color:var(--bone);
  font-family:'Archivo',system-ui,sans-serif;font-size:14px;-webkit-font-smoothing:antialiased;
  height:100dvh;display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;
}
.nd button{font:inherit;color:inherit;background:none;border:none;cursor:pointer}
.nd :focus-visible{outline:2px solid var(--brass);outline-offset:2px;border-radius:4px}

/* ---------- header bar ---------- */
.nd .bar{display:flex;align-items:center;gap:16px;padding:0 20px;height:58px;border-bottom:1px solid var(--line);background:var(--shell);min-width:0}
.nd .logo{font-family:'Fraunces',serif;font-optical-sizing:auto;font-size:19px;font-weight:600;letter-spacing:.01em;white-space:nowrap;flex:none}
.nd .logo em{font-style:italic;color:var(--brass);font-weight:400}
.nd .nav{display:flex;gap:2px;margin-left:6px;min-width:0;overflow-x:auto}
.nd .nav::-webkit-scrollbar{display:none}
.nd .nav{scrollbar-width:none}
.nd .nav button{padding:7px 13px;border-radius:20px;color:var(--muted);font-size:13.5px;display:flex;align-items:center;gap:7px;transition:color .15s,background .15s;white-space:nowrap;flex:none}
.nd .nav button:hover{color:var(--bone-2)}
.nd .nav button[aria-current]{background:var(--panel);color:var(--bone)}
.nd .spacer{flex:1;min-width:8px}
.nd .credits{display:flex;align-items:center;gap:8px;padding:6px 13px;border-radius:20px;background:var(--panel);border:1px solid var(--line-2);white-space:nowrap;flex:none}
.nd .credits b{font-size:13px;font-weight:600;color:var(--brass)}
.nd .credits span{font-size:11.5px;color:var(--muted)}
.nd .credits em{font-style:normal;color:var(--line-2)}
.nd .who{display:flex;align-items:center;gap:10px;padding-left:16px;border-left:1px solid var(--line);flex:none}
.nd .who p{font-size:12.5px;line-height:1.3;white-space:nowrap}
.nd .who small{display:block;font-size:10.5px;color:var(--brass-dim);letter-spacing:.09em;text-transform:uppercase}
.nd .pip{width:32px;height:32px;border-radius:50%;background:var(--brass);color:var(--ink);display:grid;place-items:center;font-weight:600;font-size:13px;flex:none}

/* ---------- body ---------- */
.nd .main{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:0;min-width:0}
.nd .rail{border-right:1px solid var(--line);background:var(--shell);padding:16px 18px;display:flex;flex-direction:column;gap:15px;min-height:0;overflow-y:auto}
.nd .rail::-webkit-scrollbar{width:8px}
.nd .rail::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:8px}
.nd .eyebrow{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;justify-content:space-between}

/* steps */
.nd .steps{display:flex;align-items:center;gap:6px;font-size:11px}
.nd .steps li{list-style:none;display:flex;align-items:center;gap:6px;color:var(--muted)}
.nd .steps li b{width:19px;height:19px;border-radius:50%;border:1px solid var(--line-2);display:grid;place-items:center;font-size:11px;font-weight:600;flex:none;transition:.18s}
.nd .steps li.now{color:var(--bone)}
.nd .steps li.now b{border-color:var(--brass);color:var(--brass)}
.nd .steps li.done{color:var(--bone-2)}
.nd .steps li.done b{background:var(--brass);border-color:var(--brass);color:var(--ink)}
.nd .steps .bar-sep{flex:1;height:1px;background:var(--line);min-width:8px}

/* photo drop + uploaded thumb */
.nd .drop{border:1px dashed var(--line-2);border-radius:var(--r);height:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--muted);cursor:pointer;transition:border-color .18s,color .18s,background .18s;position:relative;overflow:hidden}
.nd .drop:hover{border-color:var(--brass);color:var(--bone-2);background:#26302A}
.nd .drop svg{width:20px;height:20px}
.nd .drop b{font-size:12.5px;font-weight:500}
.nd .drop i{font-size:11px;font-style:normal;color:var(--muted)}
.nd .thumb{position:relative;border-radius:var(--r);height:104px;overflow:hidden;border:1px solid var(--line-2)}
.nd .thumb img{width:100%;height:100%;object-fit:cover;display:block}
.nd .thumb .ov{position:absolute;inset:0;background:linear-gradient(transparent,rgba(15,20,16,.82));display:flex;align-items:flex-end;justify-content:space-between;padding:8px 10px;gap:8px}
.nd .thumb .ov small{font-size:11px;color:var(--bone-2)}
.nd .linkbtn{color:var(--brass);font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px}
.nd .linkbtn:hover{text-decoration:underline}
.nd .linkbtn svg{width:13px;height:13px}

/* design-direction swatch grid (green tiles the stakeholder liked; live-app names) */
.nd .swatches{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
.nd .sw{position:relative;height:58px;border-radius:8px;cursor:pointer;overflow:hidden;border:1.5px solid transparent;transition:transform .18s cubic-bezier(.2,.7,.3,1),border-color .18s}
.nd .sw:hover{transform:translateY(-2px)}
.nd .sw[aria-pressed="true"]{border-color:var(--brass)}
.nd .sw span{position:absolute;left:8px;bottom:6px;right:8px;font-size:11px;font-weight:600;letter-spacing:.01em;line-height:1.1}
.nd .sw::after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 42%,rgba(0,0,0,.26))}
.nd .sw i{position:absolute;right:6px;top:6px;width:16px;height:16px;border-radius:50%;background:var(--brass);color:var(--ink);display:none;place-items:center;font-size:10px;font-style:normal;z-index:2}
.nd .sw[aria-pressed="true"] i{display:grid}
.nd .dd-name{letter-spacing:0;text-transform:none;color:var(--brass);font-weight:600}

.nd .money{display:flex;align-items:baseline;justify-content:space-between}
.nd .money b{font-family:'Fraunces',serif;font-size:22px;font-weight:500;letter-spacing:-.01em}
.nd input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:3px;background:var(--line-2);border-radius:2px;margin-top:9px}
.nd input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:var(--brass);cursor:grab;border:2px solid var(--shell)}
.nd input[type=range]::-moz-range-thumb{width:15px;height:15px;border:2px solid var(--shell);border-radius:50%;background:var(--brass);cursor:grab}

.nd .note{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--bone);padding:9px 11px;font-size:12.5px;resize:none;height:54px;font-family:inherit;margin-top:9px}
.nd .note::placeholder{color:var(--muted)}
.nd .note:focus{outline:none;border-color:var(--brass)}

.nd .go{margin-top:auto;background:var(--brass);color:#20180C;border-radius:8px;padding:12px;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;transition:filter .15s,transform .1s}
.nd .go:hover{filter:brightness(1.08)}
.nd .go:active{transform:scale(.99)}

/* ---------- canvas / stage ---------- */
.nd .canvas{padding:18px;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:14px;min-height:0}
.nd .stagewrap{width:100%;min-height:0;display:flex}
.nd .stage{position:relative;flex:1;border-radius:14px;overflow:hidden;background:var(--panel);cursor:ew-resize;user-select:none;min-height:0;border:1px solid var(--line);touch-action:none}
.nd .pane{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;background:var(--panel)}
.nd .clipB{position:absolute;inset:0;overflow:hidden}
.nd .sample{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:2;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#E6E1D4;background:rgba(20,26,21,.62);backdrop-filter:blur(6px);padding:5px 13px;border-radius:20px}
.nd .grip{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.9);z-index:3;transform:translateX(-50%)}
.nd .grip b{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:#fff;color:#1B221D;display:grid;place-items:center;box-shadow:0 3px 14px rgba(0,0,0,.4)}
.nd .tag{position:absolute;bottom:14px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;border-radius:20px;z-index:2;backdrop-filter:blur(6px)}
.nd .tag.l{left:14px;background:rgba(20,26,21,.6);color:#DCE0D8}
.nd .tag.r{right:14px;background:rgba(255,255,255,.82);color:#25301F}
.nd .meta{position:absolute;top:14px;left:14px;z-index:2;display:flex;align-items:center;gap:8px;background:rgba(20,26,21,.58);backdrop-filter:blur(6px);padding:6px 13px;border-radius:20px;font-size:12px}
.nd .meta em{font-style:normal;color:var(--brass)}
.nd .tools{position:absolute;top:14px;right:14px;z-index:2;display:flex;gap:6px}
.nd .tools button{width:34px;height:34px;border-radius:50%;background:rgba(20,26,21,.58);backdrop-filter:blur(6px);display:grid;place-items:center;color:#DCE0D8;transition:background .15s}
.nd .tools button:hover{background:rgba(20,26,21,.85);color:#fff}
.nd .tools svg{width:16px;height:16px}

/* ---------- "your designs" strip (real renders, not geometry) ---------- */
.nd .tray{width:100%;display:grid;grid-template-columns:repeat(4,1fr) minmax(200px,.85fr);gap:12px;height:96px}
.nd .alt{border-radius:10px;overflow:hidden;position:relative;cursor:pointer;border:1.5px solid transparent;transition:border-color .16s,transform .16s;background:var(--panel)}
.nd .alt:hover{transform:translateY(-2px)}
.nd .alt[aria-pressed="true"]{border-color:var(--brass)}
.nd .alt img{width:100%;height:100%;object-fit:cover;display:block}
.nd .alt span{position:absolute;left:8px;bottom:6px;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:#fff;text-shadow:0 1px 5px rgba(0,0,0,.75);z-index:2}
.nd .alt::after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 55%,rgba(0,0,0,.4))}
.nd .sell{background:var(--panel);border:1px solid var(--line-2);border-radius:10px;padding:11px 14px;display:flex;flex-direction:column;justify-content:center;gap:3px}
.nd .sell b{font-size:13px;font-weight:600}
.nd .sell p{font-size:11.5px;color:var(--muted);line-height:1.45}
.nd .sell button{margin-top:5px;align-self:flex-start;border:1px solid var(--brass);color:var(--brass);padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;transition:background .15s,color .15s}
.nd .sell button:hover{background:var(--brass);color:#20180C}

.nd .banner{text-align:center;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--brass);background:var(--ink);border-bottom:1px solid var(--brass-dim);padding:5px 14px;line-height:1.3}

/* ---------- responsive ---------- */
@media (max-width:1180px){
  .nd .main{grid-template-columns:300px minmax(0,1fr)}
}
@media (max-width:960px){
  .nd{grid-template-rows:auto auto 1fr}
  /* header wraps: brand + credits/avatar on row 1, nav scrolls on its own row */
  .nd .bar{flex-wrap:wrap;height:auto;padding:10px 16px;row-gap:10px}
  .nd .nav{order:3;flex-basis:100%;margin-left:0;padding-bottom:2px}
  .nd .spacer{display:none}
  .nd .who p{display:none}
  /* stack rail above canvas */
  .nd .main{display:block;overflow-y:auto}
  .nd .rail{border-right:none;border-bottom:1px solid var(--line);overflow:visible}
  .nd .canvas{grid-template-rows:none}
  .nd .stage{min-height:340px}
  .nd .tray{grid-template-columns:repeat(2,minmax(0,1fr));height:auto}
  .nd .tray .alt{height:82px}
  .nd .sell{grid-column:1/-1}
}
@media (max-width:520px){
  .nd .credits{padding:5px 10px}
  .nd .credits em,.nd .credits .mo{display:none}
}
@media (prefers-reduced-motion:reduce){.nd *{transition:none!important}}
`;

export const DesignPreview: React.FC = () => {
  const [split, setSplit] = useState(50);
  const [activeNav, setActiveNav] = useState(0);
  const [styleIdx, setStyleIdx] = useState(0);          // index into PRESETS
  const [amount, setAmount] = useState(5000);
  const [note, setNote] = useState('');
  const [mine, setMine] = useState(false);               // user uploaded their own room
  const [generated, setGenerated] = useState(true);      // a design is on the stage (sample starts generated)
  const [beforeImg, setBeforeImg] = useState(LANDING_BEFORE);
  const [afterImg, setAfterImg] = useState(LANDING_AFTER);

  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sweepRef = useRef<number | null>(null);

  const preset = PRESETS[styleIdx];

  // steps 1·2·3 state
  const done1 = mine;
  const done2 = generated;
  const done3 = mine && generated;
  const stepClass = (done: boolean, isCurrent: boolean) => done ? 'done' : isCurrent ? 'now' : '';
  const cur = !done1 ? 1 : !done2 ? 2 : 3;

  const place = (clientX: number) => {
    const st = stageRef.current;
    if (!st) return;
    const r = st.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    setSplit(pct);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => { if (draggingRef.current) place(e.clientX); };
    const up = () => { draggingRef.current = false; };
    const tmove = (e: TouchEvent) => { if (draggingRef.current && e.touches[0]) place(e.touches[0].clientX); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', tmove, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('touchend', up);
    };
  }, []);

  useEffect(() => () => { if (sweepRef.current) clearInterval(sweepRef.current); }, []);

  // Clean reveal: wipe from fully-original (100) down to a comparison split.
  const runSweep = () => {
    if (sweepRef.current) clearInterval(sweepRef.current);
    let w = 100;
    setSplit(w);
    sweepRef.current = window.setInterval(() => {
      w -= 3.4;
      if (w <= 45) { w = 45; if (sweepRef.current) { clearInterval(sweepRef.current); sweepRef.current = null; } }
      setSplit(w);
    }, 16);
  };

  const handleGenerate = () => { setGenerated(true); runSweep(); };

  // Switch design cleanly — one "after" at a time, before stays the original room.
  const selectStyle = (i: number) => {
    setStyleIdx(i);
    setGenerated(true);
    runSweep();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setBeforeImg(url);
      setAfterImg(url); // mock: no real generator in preview
      setMine(true);
      setGenerated(false);
      setSplit(100);    // show the just-uploaded room fully; user presses Generate
    };
    reader.readAsDataURL(f);
  };

  const useSample = () => {
    setBeforeImg(LANDING_BEFORE);
    setAfterImg(LANDING_AFTER);
    setMine(false);
    setGenerated(true);
    setSplit(50);
  };

  const filmstrip = useMemo(() => PRESETS.slice(0, 4), []);

  return (
    <>
      <style>{CSS}</style>
      <div className="nd">
        <div className="banner">Design preview · mock data · nothing uploaded</div>

        <header className="bar">
          <div className="logo"><em>prhomz</em> AI Designer</div>
          <nav className="nav">
            {NAV.map((label, i) => (
              <button key={label} aria-current={activeNav === i ? 'page' : undefined} onClick={() => setActiveNav(i)}>
                <NavIcon i={i} />{label}
              </button>
            ))}
          </nav>
          <div className="spacer" />
          <div className="credits" title="Manage membership">
            <b>{QUOTA.dailyUsed}/{QUOTA.dailyLimit}</b><span>today</span>
            <em>·</em><span className="mo">{QUOTA.monthUsed}/{QUOTA.monthLimit} mo</span>
          </div>
          <div className="who">
            <p>Niraj Sriwastava<small>Freemium</small></p>
            <div className="pip">N</div>
          </div>
        </header>

        <div className="main">
          <aside className="rail">
            {/* steps */}
            <ol className="steps">
              <li className={stepClass(done1, cur === 1)}><b>{done1 ? '✓' : '1'}</b>Photo</li>
              <span className="bar-sep" />
              <li className={stepClass(done2, cur === 2)}><b>{done2 ? '✓' : '2'}</b>Style</li>
              <span className="bar-sep" />
              <li className={stepClass(done3, cur === 3)}><b>{done3 ? '✓' : '3'}</b>Generate</li>
            </ol>

            {/* upload / uploaded thumb + upload-new */}
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Your room</p>
              {mine ? (
                <div className="thumb">
                  <img src={beforeImg} alt="Your room" />
                  <div className="ov">
                    <button className="linkbtn" onClick={useSample}>Use sample</button>
                    <button className="linkbtn" onClick={() => fileRef.current?.click()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" /></svg>
                      Upload new
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
                </div>
              ) : (
                <div className="drop" tabIndex={0} role="button" onClick={() => fileRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="6" width="20" height="14" rx="2" /><circle cx="12" cy="13" r="3.2" /><path d="M8 6l1.6-2.4h4.8L16 6" /></svg>
                  <b>Add a photo</b>
                  <i>or drag one here</i>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
                </div>
              )}
            </div>

            {/* Design Direction — swatch grid (live-app style names) */}
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Design Direction <span className="dd-name">{preset.label}</span>
              </p>
              <div className="swatches">
                {PRESETS.map((p, i) => (
                  <button key={p.id} className="sw" aria-pressed={styleIdx === i} style={{ background: p.bg }} onClick={() => selectStyle(i)}>
                    <i>✓</i><span style={{ color: p.fg }}>{p.label}</span>
                  </button>
                ))}
              </div>
              <textarea
                className="note"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Refine: swap sofa for a velvet sectional, add warmer lighting…"
              />
            </div>

            {/* budget */}
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>Furnishing budget</p>
              <div className="money"><b>${amount.toLocaleString('en-US')}</b><span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>mid-range</span></div>
              <input type="range" min={1000} max={40000} step={500} value={amount} onChange={e => setAmount(Number(e.target.value))} aria-label="Furnishing budget" />
            </div>

            <button className="go" onClick={handleGenerate}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" /></svg>
              {mine ? 'Apply transformations' : 'Generate design'}
            </button>
          </aside>

          <main className="canvas">
            <div className="stagewrap">
              <div
                className="stage"
                ref={stageRef}
                onMouseDown={e => { draggingRef.current = true; place(e.clientX); e.preventDefault(); }}
                onTouchStart={e => { draggingRef.current = true; if (e.touches[0]) place(e.touches[0].clientX); }}
              >
                {/* base = AFTER (right side), tinted by the chosen style */}
                <img className="pane" src={afterImg} alt="After redesign" draggable={false} style={{ filter: preset.filter }} />
                {/* BEFORE clipped to the left of the grip */}
                <div className="clipB" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                  <img className="pane" src={beforeImg} alt="Before redesign" draggable={false} />
                </div>

                {!mine && <span className="sample">Sample · not your room</span>}

                <div className="grip" style={{ left: `${split}%` }}>
                  <b><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg></b>
                </div>

                <div className="meta">
                  {mine
                    ? <>Your room · <em>{preset.label}</em></>
                    : <>Example · <em>{preset.label}</em></>}
                </div>
                <div className="tools">
                  <button aria-label="Regenerate" onClick={handleGenerate}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" /></svg></button>
                  <button aria-label="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16" /></svg></button>
                  <button aria-label="Expand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H3v6M15 21h6v-6M21 9V3h-6M3 15v6h6" /></svg></button>
                </div>

                <span className="tag l">Before</span>
                <span className="tag r">After</span>
              </div>
            </div>

            {/* Your designs — real renders (style variants), not geometry */}
            <div className="tray">
              {filmstrip.map((p, i) => (
                <button key={p.id} className="alt" aria-pressed={styleIdx === i} onClick={() => selectStyle(i)}>
                  <img src={afterImg} alt={p.label} draggable={false} style={{ filter: p.filter }} />
                  <span>{p.label}</span>
                </button>
              ))}
              <div className="sell">
                <b>Keep every design</b>
                <p>Free designs disappear after 7 days. Premium keeps them, and lifts the daily limit.</p>
                <button onClick={() => setActiveNav(3)}>See membership</button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

const NavIcon: React.FC<{ i: number }> = ({ i }) => {
  const p = [
    <path key="a" d="M3 21v-4l11-11 4 4L7 21H3zM14 6l4 4" />,
    <path key="b" d="M21 12a8 8 0 11-3-6.2L21 4v6h-6" />,
    <><rect key="c1" x="3" y="4" width="18" height="16" rx="2" /><path key="c2" d="M3 15l5-4 4 3 3-2 6 5" /></>,
    <path key="d" d="M3 7l4 4 5-6 5 6 4-4v11H3z" />,
  ][i];
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{p}</svg>;
};
