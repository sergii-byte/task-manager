// Craft — творческие инструменты: mood board, color story, type specimen

const MoodBoardSection = () => (
  <section className="section">
    <div className="section-head">
      <div className="section-num">X.01<br/>MOOD</div>
      <h2>mood board · reference grid</h2>
      <div className="desc">Drag, drop, tag. Each project gets a board — references, screenshots, swatches. ordify auto-extracts colors and tags.</div>
    </div>
    <div className="section-body">
      <div className="mood-meta">
        <div className="mood-proj">
          <span className="upper" style={{color:"var(--accent)"}}>BOARD · ONBOARDING V2</span>
          <h3 style={{fontSize: 28, fontWeight: 800, letterSpacing:"-0.02em", margin: "4px 0"}}>fast · confident · light</h3>
        </div>
        <div className="mood-stats">
          <div><span className="k">REFS</span><span className="v">24</span></div>
          <div><span className="k">EXTRACTED</span><span className="v accent">11 colors</span></div>
          <div><span className="k">UPDATED</span><span className="v">2H AGO</span></div>
        </div>
      </div>

      <div className="mood-grid">
        <div className="mood-tile big" style={{background:"var(--saffron)", color:"var(--ink)"}}>
          <div className="tile-content" style={{display:"flex", flexDirection:"column", justifyContent:"space-between", height:"100%"}}>
            <div className="upper" style={{fontFamily:"var(--font-mono)", fontSize: 11}}>REF 01 · TYPE</div>
            <div style={{fontFamily:"var(--font-display, Fraunces, serif)", fontSize: 84, fontWeight: 800, letterSpacing:"-0.04em", lineHeight: 0.85}}>quiet<br/>type.</div>
            <div style={{fontFamily:"var(--font-mono)", fontSize: 10, opacity: 0.7}}>EDITORIAL · BLACK / SAFFRON</div>
          </div>
        </div>

        <div className="mood-tile" style={{background:"var(--ink)", color:"var(--bg)"}}>
          <div className="tile-content">
            <div className="upper" style={{fontFamily:"var(--font-mono)", fontSize: 11, color:"var(--accent)"}}>REF 02 · UI</div>
            <div style={{display:"flex", flexDirection:"column", gap: 4, marginTop: 8}}>
              <div style={{height: 6, background:"var(--bg)", width:"40%"}} />
              <div style={{height: 6, background:"var(--bg)", width:"75%", opacity: 0.6}} />
              <div style={{height: 6, background:"var(--bg)", width:"55%", opacity: 0.4}} />
              <div style={{height: 24, background:"var(--accent)", width:"30%", marginTop: 8}} />
            </div>
            <div style={{fontFamily:"var(--font-mono)", fontSize: 10, opacity: 0.6, marginTop:"auto"}}>SWISS · 12-COL · STRICT</div>
          </div>
        </div>

        <div className="mood-tile" style={{background:"var(--cobalt)", color:"var(--bg)"}}>
          <div className="tile-content">
            <div className="upper" style={{fontFamily:"var(--font-mono)", fontSize: 11, opacity: 0.8}}>REF 03 · COLOR</div>
            <div style={{fontSize: 56, fontWeight: 800, lineHeight: 0.9, letterSpacing:"-0.04em", marginTop: "auto"}}>#1F3FB7</div>
            <div style={{fontFamily:"var(--font-mono)", fontSize: 10, opacity: 0.7}}>COBALT · TRUST</div>
          </div>
        </div>

        <div className="mood-tile photo" style={{background:"linear-gradient(135deg, #d4a574, #8b6f47)"}}>
          <div className="tile-content" style={{justifyContent:"flex-end"}}>
            <div className="ph-mark">
              <div className="upper" style={{fontFamily:"var(--font-mono)", fontSize: 10}}>REF 04 · TEXTURE</div>
              <div style={{fontSize: 14, fontWeight: 700}}>Linen, raw paper, hand-bound spine</div>
            </div>
          </div>
        </div>

        <div className="mood-tile tall" style={{background:"var(--bg)", color:"var(--ink)", border:"2px solid var(--ink)"}}>
          <div className="tile-content">
            <div className="upper" style={{fontFamily:"var(--font-mono)", fontSize: 11, color:"var(--accent)"}}>REF 05 · QUOTE</div>
            <div style={{fontFamily:"var(--font-display, Fraunces, serif)", fontSize: 24, fontWeight: 500, lineHeight: 1.25, fontStyle:"italic", letterSpacing:"-0.01em", marginTop: 12}}>
              "Onboarding is the sentence that decides whether they read the book."
            </div>
            <div style={{fontFamily:"var(--font-mono)", fontSize: 10, color:"var(--fg-muted)", marginTop: 12}}>— MIRA, INTERVIEW 12.04</div>
          </div>
        </div>

        <div className="mood-tile" style={{background:"var(--lime)", color:"var(--ink)"}}>
          <div className="tile-content">
            <div className="upper" style={{fontFamily:"var(--font-mono)", fontSize: 11}}>REF 06 · MOTION</div>
            <div style={{display:"flex", alignItems:"center", gap: 4, marginTop:"auto"}}>
              <div style={{width: 8, height: 8, background:"var(--ink)"}} />
              <div style={{flex: 1, height: 2, background:"var(--ink)"}} />
              <div style={{width: 16, height: 16, background:"var(--ink)"}} />
              <div style={{flex: 1, height: 2, background:"var(--ink)"}} />
              <div style={{width: 24, height: 24, background:"var(--ink)"}} />
            </div>
            <div style={{fontFamily:"var(--font-mono)", fontSize: 10, marginTop: 8, opacity: 0.8}}>240MS · EASE-OUT · CONFIDENT</div>
          </div>
        </div>

        <div className="mood-tile" style={{background:"var(--plum, #5a2e54)", color:"var(--bg)"}}>
          <div className="tile-content">
            <div className="upper" style={{fontFamily:"var(--font-mono)", fontSize: 11, opacity: 0.8}}>REF 07 · COPY</div>
            <div style={{fontSize: 18, fontWeight: 700, lineHeight: 1.2, letterSpacing:"-0.01em", marginTop: 8}}>
              "Three taps. <span style={{color:"var(--accent)"}}>Then you're in.</span>"
            </div>
            <div style={{fontFamily:"var(--font-mono)", fontSize: 10, opacity: 0.6, marginTop:"auto"}}>VOICE · DIRECT, WARM</div>
          </div>
        </div>

        <div className="mood-tile" style={{background:"var(--accent)", color:"var(--bg)"}}>
          <div className="tile-content" style={{justifyContent:"center", alignItems:"center", display:"flex", textAlign:"center"}}>
            <div>
              <div style={{fontSize: 64, fontWeight: 800, letterSpacing:"-0.04em", lineHeight: 0.9}}>+</div>
              <div style={{fontFamily:"var(--font-mono)", fontSize: 11, marginTop: 4}}>ADD REFERENCE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const ColorStorySection = () => (
  <section className="section">
    <div className="section-head">
      <div className="section-num">X.02<br/>COLOR</div>
      <h2>color story · project palette</h2>
      <div className="desc">Pinned palette for the project. Drag from references, lock favorites, generate variants. ordify warns on contrast failures.</div>
    </div>
    <div className="section-body">
      <div className="palette-row">
        <div className="swatch big" style={{background:"var(--ink)", color:"var(--bg)"}}>
          <div className="sw-meta">
            <span className="role">PRIMARY</span>
            <span className="hex">#0F0F0E</span>
          </div>
          <div className="sw-name">graphite</div>
          <div className="sw-foot">
            <span>AAA · 18.2</span>
            <span className="lock">● LOCKED</span>
          </div>
        </div>
        <div className="swatch" style={{background:"var(--accent)", color:"var(--bg)"}}>
          <div className="sw-meta">
            <span className="role">ACCENT</span>
            <span className="hex">#C8553D</span>
          </div>
          <div className="sw-name">terracotta</div>
          <div className="sw-foot">
            <span>AA · 4.8</span>
            <span className="lock">● LOCKED</span>
          </div>
        </div>
        <div className="swatch" style={{background:"var(--saffron)", color:"var(--ink)"}}>
          <div className="sw-meta">
            <span className="role">SUPPORT</span>
            <span className="hex">#E8B84D</span>
          </div>
          <div className="sw-name">saffron</div>
          <div className="sw-foot">
            <span>AAA · 14.1</span>
            <span>○ FREE</span>
          </div>
        </div>
        <div className="swatch" style={{background:"var(--bg)", color:"var(--ink)", border:"2px solid var(--ink)"}}>
          <div className="sw-meta">
            <span className="role">SURFACE</span>
            <span className="hex">#F4EFE6</span>
          </div>
          <div className="sw-name">paper</div>
          <div className="sw-foot">
            <span>BG</span>
            <span className="lock">● LOCKED</span>
          </div>
        </div>
      </div>

      <div className="palette-secondary">
        <div className="ps-head">
          <span className="upper" style={{color:"var(--fg-faint)"}}>SECONDARIES · DRAG TO PROMOTE</span>
          <button className="btn ai sm">▸ Generate variants</button>
        </div>
        <div className="ps-row">
          <div className="ps-chip" style={{background:"var(--cobalt)"}}><span>cobalt</span><span className="hex">#1F3FB7</span></div>
          <div className="ps-chip" style={{background:"var(--lime)", color:"var(--ink)"}}><span>lime</span><span className="hex">#C8E835</span></div>
          <div className="ps-chip" style={{background:"#5a2e54"}}><span>plum</span><span className="hex">#5A2E54</span></div>
          <div className="ps-chip" style={{background:"#3a5a40"}}><span>moss</span><span className="hex">#3A5A40</span></div>
          <div className="ps-chip" style={{background:"#d4a574", color:"var(--ink)"}}><span>linen</span><span className="hex">#D4A574</span></div>
          <div className="ps-chip ghost"><span>+ add</span></div>
        </div>
      </div>

      <div className="palette-test">
        <div className="pt-head">
          <span className="upper" style={{color:"var(--fg-faint)"}}>LIVE TEST · APPLIED ACROSS PROJECT</span>
          <span className="upper" style={{color:"var(--success)"}}>● 0 CONTRAST FAILS</span>
        </div>
        <div className="pt-grid">
          <div className="pt-card" style={{background:"var(--ink)", color:"var(--bg)"}}>
            <div className="pt-label">PRIMARY ON GRAPHITE</div>
            <div className="pt-h">fast · confident · light</div>
            <div className="pt-body">Onboarding lives here. Three taps, no friction, then you're in.</div>
            <button className="pt-btn" style={{background:"var(--accent)", color:"var(--bg)"}}>Start trial</button>
          </div>
          <div className="pt-card" style={{background:"var(--bg)", color:"var(--ink)", border:"2px solid var(--ink)"}}>
            <div className="pt-label" style={{color:"var(--accent)"}}>SURFACE · DEFAULT</div>
            <div className="pt-h">fast · confident · light</div>
            <div className="pt-body">Onboarding lives here. Three taps, no friction, then you're in.</div>
            <button className="pt-btn" style={{background:"var(--ink)", color:"var(--bg)"}}>Start trial</button>
          </div>
          <div className="pt-card" style={{background:"var(--saffron)", color:"var(--ink)"}}>
            <div className="pt-label">SAFFRON · SECONDARY</div>
            <div className="pt-h">fast · confident · light</div>
            <div className="pt-body">Onboarding lives here. Three taps, no friction, then you're in.</div>
            <button className="pt-btn" style={{background:"var(--ink)", color:"var(--bg)"}}>Start trial</button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const TypeSpecimenSection = () => (
  <section className="section">
    <div className="section-head">
      <div className="section-num">X.03<br/>TYPE</div>
      <h2>type specimen · pinned for project</h2>
      <div className="desc">Display, text, and mono — locked for this project. Live preview at every weight.</div>
    </div>
    <div className="section-body">
      <div className="ts-row">
        <div className="ts-side">
          <span className="upper" style={{color:"var(--accent)"}}>DISPLAY · 01</span>
          <div className="ts-name">Fraunces</div>
          <div className="ts-meta">SERIF · VARIABLE · 9 / 144 SOFT — ITALIC</div>
          <div className="ts-tags">
            <span className="ts-tag">EDITORIAL</span>
            <span className="ts-tag">WARM</span>
            <span className="ts-tag">CONFIDENT</span>
          </div>
        </div>
        <div className="ts-spec" style={{fontFamily:"Fraunces, Georgia, serif"}}>
          <div className="ts-glyph">Aa</div>
          <div className="ts-line" style={{fontSize: 64, fontWeight: 800, letterSpacing:"-0.03em", lineHeight: 0.95}}>
            quiet calm. loud type.
          </div>
          <div className="ts-line" style={{fontSize: 28, fontWeight: 400, fontStyle:"italic", letterSpacing:"-0.005em", color:"var(--fg-muted)", lineHeight: 1.2, marginTop: 8}}>
            Three taps. Then you're in.
          </div>
        </div>
      </div>

      <div className="ts-row alt">
        <div className="ts-side">
          <span className="upper" style={{color:"var(--accent)"}}>TEXT · 02</span>
          <div className="ts-name">Söhne</div>
          <div className="ts-meta">SANS · NEO-GROTESQUE · BOOK / SEMIBOLD</div>
          <div className="ts-tags">
            <span className="ts-tag">NEUTRAL</span>
            <span className="ts-tag">LEGIBLE</span>
            <span className="ts-tag">SWISS</span>
          </div>
        </div>
        <div className="ts-spec" style={{fontFamily:"'Söhne', 'Inter', system-ui, sans-serif"}}>
          <div className="ts-glyph">Aa</div>
          <div className="ts-line" style={{fontSize: 22, fontWeight: 400, lineHeight: 1.5, letterSpacing:"-0.005em", maxWidth: 540}}>
            Onboarding is the sentence that decides whether they read the book. Keep it short, keep it warm, give them something to do on the third screen.
          </div>
          <div className="ts-line" style={{fontSize: 14, fontWeight: 600, marginTop: 16, color:"var(--fg-muted)", letterSpacing:"-0.005em"}}>
            BODY 22 / 1.5 — CAPTION 14 / 1.45 — UI 13 / 1.3
          </div>
        </div>
      </div>

      <div className="ts-row alt2">
        <div className="ts-side">
          <span className="upper" style={{color:"var(--accent)"}}>MONO · 03</span>
          <div className="ts-name">JetBrains Mono</div>
          <div className="ts-meta">MONO · TABULAR · 400 / 600</div>
          <div className="ts-tags">
            <span className="ts-tag">METADATA</span>
            <span className="ts-tag">SYSTEM</span>
            <span className="ts-tag">TABULAR</span>
          </div>
        </div>
        <div className="ts-spec" style={{fontFamily:"'JetBrains Mono', 'Fira Code', monospace"}}>
          <div className="ts-glyph">Aa</div>
          <div className="ts-line" style={{fontSize: 14, fontWeight: 400, lineHeight: 1.7, letterSpacing: 0}}>
            <div>NOTE 014 · 14:32 · CAPTURED VOICE</div>
            <div>BRIEF · ONBOARDING V2 · 04 SCREENS</div>
            <div>TIMER · 02:47:14 · BILLABLE · €85/H</div>
            <div>INVOICE · 042 · DUE 12.05.2026 · €2,927.40</div>
          </div>
        </div>
      </div>

      <div className="ts-pair">
        <div className="ts-pair-head">
          <span className="upper" style={{color:"var(--fg-faint)"}}>PAIRING TEST · DISPLAY + TEXT</span>
          <span className="upper" style={{color:"var(--success)"}}>● HARMONIOUS</span>
        </div>
        <div className="ts-pair-body" style={{background:"var(--bg)", border:"2px solid var(--ink)", padding: 40}}>
          <div style={{fontFamily:"Fraunces, Georgia, serif", fontSize: 56, fontWeight: 700, letterSpacing:"-0.03em", lineHeight: 1, marginBottom: 16}}>
            ordify · onboarding v2
          </div>
          <div style={{fontFamily:"system-ui, sans-serif", fontSize: 17, lineHeight: 1.55, maxWidth: 600, color:"var(--fg-muted)"}}>
            A four-screen flow that gets a freelancer from sign-up to first invoice in under three minutes. Confident, light, and ready to ship by 15.05.
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Craft = () => (
  <div className="page">
    <section className="hero" style={{minHeight: 320}}>
      <div className="hero-left">
        <div>
          <div className="hero-eyebrow">
            <span>FILE 05 / CRAFT</span>
            <span className="rule" />
            <span>03 SURFACES</span>
          </div>
          <h1 style={{marginTop: 24, fontSize: 56}}>
            the <span className="accent">visual</span> brain.
          </h1>
        </div>
      </div>
      <div className="hero-right">
        <div className="hero-numeral" style={{color:"var(--accent)"}}>05<span className="ord" style={{color:"var(--ink)"}}>— craft / 05</span></div>
      </div>
    </section>
    <MoodBoardSection />
    <ColorStorySection />
    <TypeSpecimenSection />
  </div>
);

window.Craft = Craft;
