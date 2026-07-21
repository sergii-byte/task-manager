// Features — Capture, Brief Generator, Time Tracker, Invoice

const CaptureSection = () => (
  <section className="section">
    <div className="section-head">
      <div className="section-num">X.01<br/>CAPTURE</div>
      <h2>capture · catch the thought</h2>
      <div className="desc">A sticky pad for raw context. ordify highlights what's actionable as you type.</div>
    </div>
    <div className="section-body">
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 32, alignItems:"start"}}>
        <div className="capture-pad">
          <div className="pad-meta">
            <span>NOTE 014 · 14:32</span>
            <span>SCRATCHPAD</span>
          </div>
          <div className="pad-text">
            Mira called — she wants the proposal <mark>by Friday</mark>, not next week. Add a slide on pricing tiers <mark>with cobalt accent</mark>. Loop in <mark>Sam for legal review</mark> before send.
          </div>
          <div className="pad-foot">
            <span className="mono">3 ACTIONS DETECTED</span>
            <button className="btn accent sm" style={{marginLeft:"auto"}}>▸ Convert to tasks</button>
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap: 16}}>
          <div className="capture-strip">
            <div><span className="k">CAPTURED</span><span className="v">14</span></div>
            <div><span className="k">PARSED</span><span className="v accent">11</span></div>
            <div><span className="k">QUEUED</span><span className="v">03</span></div>
            <div><span className="k">SOURCE</span><span className="v">VOICE · KEY · MAIL</span></div>
          </div>

          <div className="task ai-suggested" style={{borderColor:"var(--ink)"}}>
            <div className="row">
              <span className="idx">N-014a</span>
              <input type="checkbox" className="checkbox" />
              <div className="title">Move proposal deadline · Friday 02.05</div>
            </div>
            <div className="meta"><span className="priority urgent">P0</span><span className="tag work"><span className="dot"/>Q3 proposal</span><span className="due">FROM NOTE 014</span></div>
          </div>
          <div className="task ai-suggested" style={{borderColor:"var(--ink)"}}>
            <div className="row">
              <span className="idx">N-014b</span>
              <input type="checkbox" className="checkbox" />
              <div className="title">Add pricing-tier slide · cobalt accent</div>
            </div>
            <div className="meta"><span className="priority high">P1</span><span className="tag design"><span className="dot"/>Design</span></div>
          </div>
          <div className="task ai-suggested" style={{borderColor:"var(--ink)"}}>
            <div className="row">
              <span className="idx">N-014c</span>
              <input type="checkbox" className="checkbox" />
              <div className="title">Loop in Sam — legal review pre-send</div>
            </div>
            <div className="meta"><span className="priority high">P1</span><span className="tag plum">Legal</span><div style={{marginLeft:"auto"}}><span className="avatar sm a4">SO</span></div></div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const BriefSection = () => (
  <section className="section">
    <div className="section-head">
      <div className="section-num">X.02<br/>BRIEF</div>
      <h2>ai brief · raw → ready</h2>
      <div className="desc">Paste any rough thinking on the left. ordify formulates a clean brief on the right — title, scope, deliverables, success.</div>
    </div>
    <div className="section-body">
      <div className="brief-shell">
        <div className="brief-input">
          <div className="upper" style={{color:"var(--accent)"}}>RAW INPUT · TYPED 11:42</div>
          <div className="raw">
            need to <mark>redo onboarding</mark> for new freelancer plan. <span className="scratch">3 screens</span> 4 screens max. should feel <mark>fast and confident</mark>. include trial CTA but <span className="scratch">aggressive</span> light. mira said don't repeat the <span className="scratch">old mistakes</span> — too much copy. <mark>ship by may 15</mark>.
          </div>
          <div style={{display:"flex", gap: 8}}>
            <button className="btn secondary sm">Edit raw</button>
            <button className="btn ai" style={{marginLeft:"auto"}}>▸ Reformulate</button>
          </div>
        </div>
        <div className="brief-output">
          <div className="label">FORMULATED BRIEF · 03 SECONDS</div>
          <h3>onboarding v2 · freelancer plan</h3>
          <div className="field-out"><span className="k">SCOPE</span><span className="v">4-screen flow, mobile-first, ship-ready by 15.05.26</span></div>
          <div className="field-out"><span className="k">FEEL</span><span className="v"><span className="pill">FAST</span><span className="pill">CONFIDENT</span> · trial CTA, low-pressure</span></div>
          <div className="field-out"><span className="k">CONSTRAINT</span><span className="v">No copy-heavy screens. Mira: "don't repeat old mistakes"</span></div>
          <div className="field-out"><span className="k">SUCCESS</span><span className="v">≤4 screens · ≥40% trial activation · launch 15.05</span></div>
          <div className="field-out"><span className="k">OWNERS</span><span className="v">Andrii K. (lead) · Sofia O. (design) · Mira R. (review)</span></div>
          <div style={{display:"flex", gap: 8, marginTop: 4, position: "relative"}}>
            <button className="btn accent sm"><IconCheck className="i-sm"/>Accept</button>
            <button className="btn sm" style={{background:"transparent", color:"var(--bg)", borderColor:"var(--bg)"}}>Refine</button>
            <button className="btn sm" style={{background:"transparent", color:"var(--bg)", borderColor:"var(--bg)", marginLeft:"auto"}}>Export PDF</button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const TrackerSection = () => (
  <section className="section">
    <div className="section-head">
      <div className="section-num">X.03<br/>TIME</div>
      <h2>time tracker · running clock</h2>
      <div className="desc">A live timer in lime acid-green. Logs roll up daily; billable hours flag in red.</div>
    </div>
    <div className="section-body">
      <div className="tracker">
        <div className="tracker-now">
          <div className="label"><span className="dot"/>RUNNING · STARTED 09:45</div>
          <div>
            <div className="clock">02:47<span className="ms">:14</span></div>
            <div className="who" style={{marginTop: 16}}>
              <span className="proj">Q3 PROPOSAL · BILLABLE</span>
              Drafting product narrative
            </div>
          </div>
          <div className="controls">
            <button className="btn primary sm">▍▍ Pause</button>
            <button className="btn secondary sm" style={{borderColor:"var(--ink)"}}>■ Stop</button>
            <button className="btn ghost sm" style={{borderColor:"transparent"}}><IconPlus className="i-sm"/></button>
          </div>
        </div>
        <div className="tracker-log">
          <div className="log-head">
            <span>TODAY · 28.04.26</span>
            <span style={{color:"var(--accent)"}}>06:14 BILLABLE</span>
          </div>
          <div className="log-entry">
            <span className="time">09:45 →</span>
            <span className="what">Drafting product narrative<span className="meta">Q3 PROPOSAL · BILLABLE</span></span>
            <span className="duration bill">02:47</span>
          </div>
          <div className="log-entry">
            <span className="time">09:30</span>
            <span className="what">Standup<span className="meta">INTERNAL</span></span>
            <span className="duration">00:15</span>
          </div>
          <div className="log-entry">
            <span className="time">08:50</span>
            <span className="what">Inbox triage<span className="meta">ADMIN</span></span>
            <span className="duration">00:40</span>
          </div>
          <div className="log-entry">
            <span className="time">07:30</span>
            <span className="what">Review onboarding mocks<span className="meta">ONBOARDING V2 · BILLABLE</span></span>
            <span className="duration bill">01:20</span>
          </div>
          <div className="log-entry">
            <span className="time">06:30</span>
            <span className="what">Pricing research<span className="meta">Q3 PROPOSAL · BILLABLE</span></span>
            <span className="duration bill">02:07</span>
          </div>
        </div>
      </div>

      <div style={{marginTop: 32, display:"grid", gridTemplateColumns:"2fr 1fr", gap: 24}}>
        <div>
          <div className="upper" style={{color:"var(--fg-faint)", marginBottom: 16}}>WEEK 18 · BILLABLE HOURS</div>
          <div className="bar-chart">
            <div className="bar" style={{height:"60%"}}><span className="lbl">MON</span></div>
            <div className="bar" style={{height:"75%"}}><span className="lbl">TUE</span></div>
            <div className="bar" style={{height:"45%"}}><span className="lbl">WED</span></div>
            <div className="bar" style={{height:"90%"}}><span className="lbl">THU</span></div>
            <div className="bar today" style={{height:"55%"}}><span className="lbl">TODAY</span></div>
            <div className="bar" style={{height:"15%", opacity: 0.3}}><span className="lbl">SAT</span></div>
            <div className="bar" style={{height:"10%", opacity: 0.3}}><span className="lbl">SUN</span></div>
          </div>
        </div>
        <div className="capture-strip" style={{gridTemplateColumns:"1fr 1fr"}}>
          <div><span className="k">WEEK BILL</span><span className="v accent">28:42</span></div>
          <div><span className="k">RATE</span><span className="v">€85/h</span></div>
          <div><span className="k">PROJECTED</span><span className="v">€2,439</span></div>
          <div><span className="k">VS LAST</span><span className="v" style={{color:"var(--success)"}}>+12%</span></div>
        </div>
      </div>
    </div>
  </section>
);

const InvoiceSection = () => (
  <section className="section">
    <div className="section-head">
      <div className="section-num">X.04<br/>INVOICE</div>
      <h2>invoice · auto-generated</h2>
      <div className="desc">ordify rolls billable hours into a clean editorial invoice. One click to send, one to mark paid.</div>
    </div>
    <div className="section-body" style={{background:"var(--bg-1)", padding: 48}}>
      <div className="invoice" style={{maxWidth: 880, margin:"0 auto"}}>
        <div className="invoice-head">
          <div className="num">inv·<span className="accent">042</span></div>
          <div className="meta-grid">
            <div><span className="k">ISSUED</span><span className="v">28.04.2026</span></div>
            <div><span className="k">DUE</span><span className="v">12.05.2026</span></div>
            <div><span className="k">CURRENCY</span><span className="v">EUR</span></div>
            <div><span className="k">STATUS</span><span className="v" style={{color:"var(--accent)"}}>● UNPAID</span></div>
          </div>
        </div>
        <div className="invoice-parties">
          <div>
            <div className="role">FROM</div>
            <div className="name">Andrii Kovalenko<br/>SBLC Studio</div>
            <div className="addr">Shevchenka st. 14<br/>Lviv 79000 · UA<br/>VAT UA00012345<br/>hi@sblc.com.ua</div>
          </div>
          <div>
            <div className="role">BILL TO</div>
            <div className="name">Mira Ramirez<br/>Northwind Co.</div>
            <div className="addr">Calle Mayor 22<br/>Madrid 28013 · ES<br/>VAT ESB12345678<br/>billing@northwind.co</div>
          </div>
        </div>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th className="num" style={{width: 100}}>HOURS</th>
              <th className="num" style={{width: 100}}>RATE</th>
              <th className="num" style={{width: 140}}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><div className="desc">Q3 product narrative · drafting & review</div><div className="meta">14 ENTRIES · 22.04 — 28.04</div></td>
              <td className="num">14:30</td>
              <td className="num">€85</td>
              <td className="num">€1,232.50</td>
            </tr>
            <tr>
              <td><div className="desc">Onboarding v2 · UX review</div><div className="meta">06 ENTRIES · 23.04 — 27.04</div></td>
              <td className="num">07:45</td>
              <td className="num">€85</td>
              <td className="num">€658.75</td>
            </tr>
            <tr>
              <td><div className="desc">Pricing research</div><div className="meta">04 ENTRIES · 24.04 — 26.04</div></td>
              <td className="num">06:27</td>
              <td className="num">€85</td>
              <td className="num">€548.25</td>
            </tr>
          </tbody>
        </table>
        <div className="invoice-total">
          <div className="totals-list">
            <div className="row"><span>Subtotal</span><span>€2,439.50</span></div>
            <div className="row"><span>VAT · 20%</span><span>€487.90</span></div>
            <div className="row grand"><span>TOTAL DUE</span><span>€2,927.40</span></div>
          </div>
          <div className="grand-amount">
            <span className="k">AMOUNT DUE</span>
            <span className="v">€2,927<span style={{fontSize:"0.5em", verticalAlign:"top"}}>.40</span></span>
            <span className="due">PAYABLE BY 12.05.2026</span>
          </div>
        </div>
        <div className="invoice-actions">
          <span className="ai-mark">AI ▸ generated from 24 tracker entries · 0 conflicts</span>
          <div style={{display:"flex", gap: 8}}>
            <button className="btn sm" style={{background:"transparent", color:"var(--bg)", borderColor:"var(--bg)"}}>Edit</button>
            <button className="btn sm" style={{background:"transparent", color:"var(--bg)", borderColor:"var(--bg)"}}>PDF</button>
            <button className="btn accent sm">▸ Send</button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Features = () => (
  <div className="page">
    <section className="hero" style={{minHeight: 320}}>
      <div className="hero-left">
        <div>
          <div className="hero-eyebrow">
            <span>FILE 04 / FEATURES</span>
            <span className="rule" />
            <span>04 SURFACES</span>
          </div>
          <h1 style={{marginTop: 24, fontSize: 56}}>
            from <span className="accent">thought</span> to <span className="accent">paid.</span>
          </h1>
        </div>
      </div>
      <div className="hero-right">
        <div className="hero-numeral" style={{color:"var(--lime)"}}>04<span className="ord" style={{color:"var(--ink)"}}>— features / 04</span></div>
      </div>
    </section>
    <CaptureSection />
    <BriefSection />
    <TrackerSection />
    <InvoiceSection />
  </div>
);

window.Features = Features;
