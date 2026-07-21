// Foundations — Brand, Color, Type, Space, Grid

const Foundations = () => (
  <div className="page">
    {/* HERO */}
    <section className="hero">
      <div className="hero-left">
        <div>
          <div className="hero-eyebrow">
            <span>FILE 01 / FOUNDATIONS</span>
            <span className="rule" />
            <span>v0.4 · APR 28 · 2026</span>
          </div>
          <h1 style={{marginTop: 32}}>
            ordif<span className="accent">y</span><br/>
            <span className="strike">chaos</span> ordered.
          </h1>
        </div>
        <div className="hero-meta">
          <div><span className="k">Family</span><span className="v">Sans · Mono</span></div>
          <div><span className="k">Accent</span><span className="v">Vermillion</span></div>
          <div><span className="k">Grid</span><span className="v">12 / 8px</span></div>
          <div><span className="k">Mode</span><span className="v">Light · Dark</span></div>
        </div>
      </div>
      <div className="hero-right">
        <div className="hero-stamp">Design System / Internal</div>
        <div className="hero-numeral">
          01
          <span className="ord">— ordify · the order method</span>
        </div>
      </div>
    </section>

    {/* BRAND */}
    <section className="section">
      <div className="section-head">
        <div className="section-num">F.01<br/>BRAND</div>
        <h2>wordmark, in three voices</h2>
        <div className="desc">A lowercase grotesque set tightly. The accent y carries the system — every primary action shares its weight.</div>
      </div>
      <div className="section-body" style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 0, padding: 0, borderTop:"1px solid var(--ink)"}}>
        <div className="brand-card" style={{borderRight:"1px solid var(--ink)", border:0, borderRight:"1px solid var(--ink)"}}>
          <div className="brand-tag"><span>01 · primary</span><span>RGB</span></div>
          <div className="brand-wordmark">ordif<span className="accent">y</span></div>
          <div className="brand-tag"><span>plan with order</span><span>make with craft</span></div>
        </div>
        <div className="brand-card dark" style={{borderRight:"1px solid var(--ink)"}}>
          <div className="brand-tag" style={{color:"#888"}}><span>02 · reverse</span><span>NEG</span></div>
          <div className="brand-wordmark">ordif<span className="accent">y</span></div>
          <div className="brand-tag" style={{color:"#888"}}><span>for dark surfaces</span><span>—</span></div>
        </div>
        <div className="brand-card accent">
          <div className="brand-tag" style={{color:"rgba(255,255,255,0.7)"}}><span>03 · accent</span><span>POS</span></div>
          <div className="brand-wordmark">ordif<span className="accent">y</span></div>
          <div className="brand-tag" style={{color:"rgba(255,255,255,0.7)"}}><span>moments only</span><span>—</span></div>
        </div>
      </div>
    </section>

    {/* COLOR */}
    <section className="section">
      <div className="section-head">
        <div className="section-num">F.02<br/>COLOR</div>
        <h2>ink, paper, vermillion</h2>
        <div className="desc">A two-color system + one signal. Black sets structure; vermillion marks intent. Cobalt and saffron exist for tags only.</div>
      </div>
      <div className="section-body">
        <div className="bigblock" style={{marginBottom: 32}}>
          <div className="accent-block">
            <div className="label"><span>VERMILLION / 500</span><span>01</span></div>
            <div className="name">accent</div>
            <div className="val">#E63312 · oklch(0.6 0.22 28)</div>
          </div>
          <div>
            <div className="label upper" style={{color:"var(--fg-faint)", marginBottom: 8}}>02 · INK</div>
            <div style={{fontSize:"var(--text-xl)", fontWeight: 800}}>#0A0A0A</div>
            <div className="mono" style={{fontSize:"var(--text-xs)", color:"var(--fg-muted)", marginTop: 4}}>Foreground · Lines</div>
          </div>
          <div>
            <div className="label upper" style={{color:"var(--fg-faint)", marginBottom: 8}}>03 · PAPER</div>
            <div style={{fontSize:"var(--text-xl)", fontWeight: 800}}>#FFFFFF</div>
            <div className="mono" style={{fontSize:"var(--text-xs)", color:"var(--fg-muted)", marginTop: 4}}>Surface · Bg</div>
          </div>
          <div>
            <div className="label upper" style={{color:"var(--fg-faint)", marginBottom: 8}}>04 · COBALT / SAFFRON</div>
            <div style={{display:"flex", gap: 8, marginTop: 8}}>
              <div style={{width: 40, height: 40, background:"var(--cobalt)"}}/>
              <div style={{width: 40, height: 40, background:"var(--saffron)"}}/>
            </div>
            <div className="mono" style={{fontSize:"var(--text-xs)", color:"var(--fg-muted)", marginTop: 12}}>Tags · sparingly</div>
          </div>
        </div>

        <div className="upper" style={{color:"var(--fg-faint)", marginBottom: 12}}>NEUTRAL · INK SCALE</div>
        <div className="swatch-row">
          {[
            ["paper","#FFFFFF","--bg"],["bg-1","#FAFAFA","--bg-1"],["bg-2","#F3F3F3","--bg-2"],["bg-3","#E8E8E8","--bg-3"],
            ["faint","#B8B8B8","--fg-faint"],["subtle","#888888","--fg-subtle"],["muted","#555555","--fg-muted"],["ink","#0A0A0A","--ink"]
          ].map(([n,h,v]) => (
            <div key={n} className="swatch">
              <div className="chip" style={{background: h}} />
              <div className="meta"><span className="name">{n}</span><span className="val">{h}</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* TYPE */}
    <section className="section">
      <div className="section-head">
        <div className="section-num">F.03<br/>TYPE</div>
        <h2>two families. one rule.</h2>
        <div className="desc">A neutral grotesque for everything readable. A geometric mono for everything structural — labels, indices, timestamps.</div>
      </div>
      <div className="section-body">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 0, border:"1px solid var(--line)", marginBottom: 32}}>
          <div style={{padding: 32, borderRight:"1px solid var(--line)"}}>
            <div className="upper" style={{color:"var(--accent)", marginBottom: 16}}>SANS · GROTESQUE</div>
            <div style={{fontSize: 96, fontWeight: 800, letterSpacing:"-0.05em", lineHeight: 0.9}}>Aa</div>
            <div style={{display:"flex", justifyContent:"space-between", marginTop: 24, fontFamily:"var(--font-mono)", fontSize:"var(--text-xs)", color:"var(--fg-muted)"}}>
              <span>Inter Tight / Helvetica Neue</span><span>400 · 600 · 800</span>
            </div>
          </div>
          <div style={{padding: 32}}>
            <div className="upper" style={{color:"var(--accent)", marginBottom: 16}}>MONO · TECHNICAL</div>
            <div style={{fontSize: 96, fontWeight: 500, letterSpacing:"-0.02em", lineHeight: 0.9, fontFamily:"var(--font-mono)"}}>01</div>
            <div style={{display:"flex", justifyContent:"space-between", marginTop: 24, fontFamily:"var(--font-mono)", fontSize:"var(--text-xs)", color:"var(--fg-muted)"}}>
              <span>JetBrains Mono</span><span>400 · 500</span>
            </div>
          </div>
        </div>

        <div className="spec-row">
          <div className="idx">01</div><div className="label">DISPLAY</div>
          <div style={{fontSize: 72, fontWeight: 800, letterSpacing:"-0.05em", lineHeight: 0.95, textTransform:"lowercase"}}>plan less. <span style={{color:"var(--accent)"}}>do more.</span></div>
          <div className="specs">SANS · 800 · 72 / 68</div>
        </div>
        <div className="spec-row">
          <div className="idx">02</div><div className="label">H1</div>
          <div style={{fontSize: 48, fontWeight: 700, letterSpacing:"-0.03em", lineHeight: 1, textTransform:"lowercase"}}>today, focused</div>
          <div className="specs">SANS · 700 · 48 / 48</div>
        </div>
        <div className="spec-row">
          <div className="idx">03</div><div className="label">H2</div>
          <div style={{fontSize: 24, fontWeight: 700, letterSpacing:"-0.02em", textTransform:"lowercase"}}>inbox · 14 tasks</div>
          <div className="specs">SANS · 700 · 24 / 26</div>
        </div>
        <div className="spec-row">
          <div className="idx">04</div><div className="label">BODY</div>
          <div style={{fontSize: 16, lineHeight: 1.45, fontFamily:"var(--font-text)"}}>Draft a brief for the new onboarding flow and route it to the design team for review by Tuesday.</div>
          <div className="specs">TEXT · 400 · 16 / 23</div>
        </div>
        <div className="spec-row">
          <div className="idx">05</div><div className="label">UI / META</div>
          <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:"0.18em", color:"var(--fg-muted)"}}>CREATED 03 MIN AGO · BY AI</div>
          <div className="specs">MONO · 500 · 11 / 14</div>
        </div>
        <div className="spec-row">
          <div className="idx">06</div><div className="label">NUMERIC</div>
          <div className="mono" style={{fontSize: 32, letterSpacing:"-0.02em"}}>14:32 · 28.04.26 · ⌘K</div>
          <div className="specs">MONO · 500 · 32 / 32</div>
        </div>
      </div>
    </section>

    {/* GRID + SPACING */}
    <section className="section">
      <div className="section-head">
        <div className="section-num">F.04<br/>GRID</div>
        <h2>12 columns, 8-pt rhythm</h2>
        <div className="desc">Every layout snaps to twelve. Every margin to eight. Visible structure is a feature — not a flaw.</div>
      </div>
      <div className="section-body">
        <div className="upper" style={{color:"var(--fg-faint)", marginBottom: 12}}>12-COLUMN · 24px GUTTER</div>
        <div className="col-grid-show">
          {Array.from({length: 12}, (_, i) => <div key={i}>{String(i+1).padStart(2,"0")}</div>)}
        </div>

        <div className="upper" style={{color:"var(--fg-faint)", margin: "32px 0 12px"}}>SPACING SCALE</div>
        {[["01","s-1","2"],["02","s-2","4"],["03","s-3","8"],["04","s-4","12"],["05","s-5","16"],["06","s-6","24"],["07","s-7","32"],["08","s-8","48"],["09","s-9","64"],["10","s-10","96"]].map(([i,n,p]) => (
          <div key={n} className="space-row">
            <div className="idx">{i}</div>
            <div className="name">--{n}</div>
            <div className="px">{p}px</div>
            <div className="bar" style={{width: p+"px"}} />
          </div>
        ))}
      </div>
    </section>
  </div>
);

window.Foundations = Foundations;
