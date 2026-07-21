// Components

const Block = ({ title, num, desc, children, noPad }) => (
  <section className="section">
    <div className="section-head">
      <div className="section-num" style={{whiteSpace: "pre-line"}}>{num}</div>
      <h2>{title}</h2>
      {desc ? <div className="desc">{desc}</div> : <div />}
    </div>
    <div className={"section-body" + (noPad ? " no-pad" : "")}>{children}</div>
  </section>
);

const ButtonsBlock = () => (
  <Block title="buttons · sharp, mono, square" num="C.01\nBUTTONS" desc="Square corners. Caps mono labels. Three weights: primary (ink), accent (signal), secondary (outline).">
    <div style={{display:"flex", flexDirection:"column", gap: 20}}>
      <div className="btn-row">
        <button className="btn primary">Create task</button>
        <button className="btn accent"><IconPlus className="i-sm" />New project</button>
        <button className="btn ai">Ask ordify</button>
        <button className="btn secondary">Cancel</button>
        <button className="btn ghost">Skip</button>
      </div>
      <div className="btn-row">
        <button className="btn primary sm">Small</button>
        <button className="btn primary">Default</button>
        <button className="btn primary lg">Large</button>
        <button className="btn secondary icon" aria-label="More"><IconMore className="i" /></button>
        <button className="btn primary" disabled>Disabled</button>
      </div>
    </div>
  </Block>
);

const InputsBlock = () => (
  <Block title="inputs · underlined, bare" num="C.02\nINPUTS" desc="No boxed fields. A single 2px ink rule under each label keeps focus on the content the user is typing.">
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 32}}>
      <div className="field">
        <label>Task title <span className="req">·R</span></label>
        <input className="input" placeholder="What needs to be done?" />
      </div>
      <div className="field">
        <label>Project<span>04 OPTIONS</span></label>
        <select className="select"><option>Q3 proposal</option><option>Marketing site</option></select>
      </div>
      <div className="field" style={{gridColumn:"1 / -1"}}>
        <label>Quick capture<span>⌘K</span></label>
        <div className="input-group">
          <span className="icon"><IconSearch className="i-sm" /></span>
          <input className="input" placeholder="Tell ordify what to plan…" />
          <span className="kbd">⏎</span>
        </div>
      </div>
      <div className="field" style={{gridColumn:"1 / -1"}}>
        <label>Notes</label>
        <textarea className="textarea" placeholder="Add context, links, or paste a brief…" />
      </div>
      <div style={{display:"flex", alignItems:"center", gap: 12}}>
        <input type="checkbox" className="checkbox" defaultChecked /> <span style={{fontSize:"var(--text-md)", fontFamily:"var(--font-text)"}}>Mark as done</span>
      </div>
      <div style={{display:"flex", alignItems:"center", gap: 12}}>
        <input type="checkbox" className="switch" defaultChecked /> <span style={{fontSize:"var(--text-md)", fontFamily:"var(--font-text)"}}>AI auto-prioritize</span>
      </div>
    </div>
  </Block>
);

const TagsBlock = () => (
  <Block title="tags · priority · status" num="C.03\nLABELS" desc="Mono caps, sharp borders. Color does the work — no icons needed for a glance.">
    <div style={{display:"flex", flexDirection:"column", gap: 24}}>
      <div>
        <div className="upper" style={{color:"var(--fg-faint)", marginBottom: 10}}>TAGS</div>
        <div className="btn-row">
          <span className="tag work"><span className="dot" />Work</span>
          <span className="tag design"><span className="dot" />Design</span>
          <span className="tag research">Research</span>
          <span className="tag life">Personal</span>
          <span className="tag craft">Craft</span>
        </div>
      </div>
      <div>
        <div className="upper" style={{color:"var(--fg-faint)", marginBottom: 10}}>PRIORITY</div>
        <div className="btn-row">
          <span className="priority urgent">P0 ▸ URGENT</span>
          <span className="priority high">P1 ▸ HIGH</span>
          <span className="priority med">P2 ▸ MED</span>
          <span className="priority low">P3 ▸ LOW</span>
        </div>
      </div>
      <div>
        <div className="upper" style={{color:"var(--fg-faint)", marginBottom: 10}}>STATUS</div>
        <div className="btn-row">
          <span className="status todo"><span className="pulse" />To do</span>
          <span className="status doing"><span className="pulse" />In progress</span>
          <span className="status review"><span className="pulse" />Review</span>
          <span className="status done"><span className="pulse" />Done</span>
        </div>
      </div>
    </div>
  </Block>
);

const Avatars = () => (
  <Block title="avatars · monogram squares" num="C.04\nPEOPLE" desc="Square monograms, ink-bordered. Color flags primary collaborators only.">
    <div className="btn-row" style={{gap: 16}}>
      <span className="avatar a1">AK</span>
      <span className="avatar a2">MR</span>
      <span className="avatar a3">SO</span>
      <span className="avatar a4">YL</span>
      <div className="avatar-stack" style={{marginLeft: 12}}>
        <span className="avatar a1">AK</span>
        <span className="avatar a2">MR</span>
        <span className="avatar a3">SO</span>
        <span className="avatar">+4</span>
      </div>
    </div>
  </Block>
);

const TaskCardsBlock = () => (
  <Block title="task card · the atomic unit" num="C.05\nTASKS" desc="Three states: default · done · ai-suggested. The AI variant gets a red rule and a corner stamp. No banners.">
    <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 16}}>
      <div className="task">
        <div className="row">
          <span className="idx">T-014</span>
          <input type="checkbox" className="checkbox" />
          <div className="title">Draft Q3 product narrative</div>
        </div>
        <div className="meta">
          <span className="priority high">P1</span>
          <span className="tag work"><span className="dot" />Work</span>
          <span className="due">TUE · 14:00</span>
          <div style={{marginLeft:"auto"}}>
            <div className="avatar-stack"><span className="avatar sm a1">AK</span><span className="avatar sm a2">MR</span></div>
          </div>
        </div>
      </div>
      <div className="task done">
        <div className="row">
          <span className="idx">T-008</span>
          <input type="checkbox" className="checkbox" defaultChecked />
          <div className="title">Reply to design feedback on onboarding</div>
        </div>
        <div className="meta">
          <span className="tag design"><span className="dot" />Design</span>
          <span className="due">DONE 09:14</span>
        </div>
      </div>
      <div className="task ai-suggested">
        <div className="row">
          <span className="idx">T-021</span>
          <input type="checkbox" className="checkbox" />
          <div className="title">Block 90 min for proposal review</div>
        </div>
        <div className="meta">
          <span className="priority urgent">P0</span>
          <span className="due overdue">TODAY · 11:00 · OVERDUE</span>
        </div>
      </div>
    </div>
  </Block>
);

const AIBlock = () => (
  <Block title="ai assistant · panel + chips" num="C.06\nAI" desc="Black header, square red glyph, mono titling. Speech bubbles are sharp blocks with a folded-corner arrow. No drift, no glow.">
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 24, alignItems:"start"}}>
      <div className="ai-panel">
        <div className="ai-panel-head">
          <div className="ai-glyph">o</div>
          <div className="ai-title">ordify <small>· planning your week</small></div>
        </div>
        <div className="ai-panel-body">
          <div className="ai-bubble user">Plan my Tuesday around the proposal review.</div>
          <div className="ai-bubble">
            <strong>3 deep-work blocks</strong> open. Suggested:<br/>
            <span className="mono" style={{fontSize:"var(--text-xs)", color:"var(--fg-muted)", display:"block", marginTop: 6, lineHeight: 1.6}}>
              09:00–10:30 · DRAFT PROPOSAL<br/>
              11:00–12:30 · REVIEW &amp; EDIT<br/>
              14:00–14:30 · SEND TO STAKEHOLDERS
            </span>
          </div>
          <div className="ai-suggest-row">
            <button className="ai-chip">▸ Apply schedule</button>
            <button className="ai-chip">Move standup</button>
            <button className="ai-chip">Add buffer</button>
          </div>
          <div className="ai-thinking">
            <span>Reading calendar</span>
            <span className="dots"><span></span><span></span><span></span></span>
          </div>
        </div>
        <div className="ai-input">
          <input placeholder="Ask ordify…" />
          <span className="kbd">⏎</span>
        </div>
      </div>

      <div style={{display:"flex", flexDirection:"column", gap: 12}}>
        <div className="task ai-suggested">
          <div className="row">
            <span className="idx">T-022</span>
            <input type="checkbox" className="checkbox" />
            <div className="title">Review proposal draft (90 min)</div>
          </div>
          <div className="meta">
            <span className="priority high">P1</span>
            <span className="due">11:00 — 12:30</span>
            <span style={{marginLeft:"auto"}} className="ai-mark">— RESCHEDULED</span>
          </div>
        </div>
        <div className="task ai-suggested">
          <div className="row">
            <span className="idx">T-023</span>
            <input type="checkbox" className="checkbox" />
            <div className="title">Send proposal to Mira & Sam</div>
          </div>
          <div className="meta">
            <span className="priority med">P2</span>
            <span className="due">14:00</span>
            <span style={{marginLeft:"auto"}} className="ai-mark">— FROM EMAIL</span>
          </div>
        </div>
        <div style={{display:"flex", gap: 8, marginTop: 4}}>
          <button className="btn accent" style={{flex:1, justifyContent:"center"}}><IconCheck className="i-sm" />Accept all</button>
          <button className="btn secondary" style={{flex:1, justifyContent:"center"}}>Review</button>
        </div>
      </div>
    </div>
  </Block>
);

const CalBlock = () => (
  <Block title="calendar · grid as feature" num="C.07\nCALENDAR" desc="The grid is the design. Today is inverted. Tasks read as red dots, never as bars or text overflow.">
    <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap: 0, borderTop:"1px solid var(--ink)", borderRight:"1px solid var(--ink)"}}>
      <div style={{borderRight:"1px solid var(--ink)", padding: 24}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 16}}>
          <div style={{fontSize:"var(--text-2xl)", fontWeight: 700, letterSpacing:"-0.02em", textTransform:"lowercase"}}>april <span style={{color:"var(--accent)"}}>2026</span></div>
          <div className="upper" style={{color:"var(--fg-faint)"}}>WEEK 18 · TODAY 28.04</div>
        </div>
        <div className="cal">
          {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => <div className="h" key={d}>{d}</div>)}
          {["30","31"].map(d => <div className="d muted" key={"m"+d}>{d}</div>)}
          {Array.from({length: 30}, (_,i) => i+1).map(d => {
            const cls = ["d"];
            if (d === 28) cls.push("today");
            if ([29, 30, 5, 12, 19].includes(d)) cls.push("has-task");
            return <div className={cls.join(" ")} key={d}>{d}</div>;
          })}
          {["1","2","3"].map(d => <div className="d muted" key={"e"+d}>{d}</div>)}
        </div>
      </div>
      <div style={{padding: 24, display:"flex", flexDirection:"column", gap: 16}}>
        <div className="upper" style={{color:"var(--fg-faint)"}}>EMPTY STATE</div>
        <div style={{border:"2px dashed var(--line-strong)", padding: "48px 24px", textAlign:"center", display:"flex", flexDirection:"column", gap: 12, alignItems:"center"}}>
          <div style={{width: 56, height: 56, background:"var(--ink)", color:"var(--accent)", display:"grid", placeItems:"center", fontFamily:"var(--font-mono)", fontWeight: 700, fontSize: 24}}>○</div>
          <div style={{fontSize:"var(--text-xl)", fontWeight: 700, letterSpacing:"-0.02em", textTransform:"lowercase"}}>inbox zero.</div>
          <div className="mono upper" style={{color:"var(--fg-muted)"}}>NOTHING WAITING · 0 TASKS</div>
          <button className="btn ai" style={{marginTop: 8}}>Plan tomorrow</button>
        </div>
      </div>
    </div>
  </Block>
);

const Components = () => (
  <div className="page">
    <section className="hero" style={{minHeight: 320}}>
      <div className="hero-left">
        <div>
          <div className="hero-eyebrow">
            <span>FILE 02 / COMPONENTS</span>
            <span className="rule" />
            <span>26 ELEMENTS</span>
          </div>
          <h1 style={{marginTop: 24, fontSize: 56}}>
            pieces, <span className="accent">composed.</span>
          </h1>
        </div>
      </div>
      <div className="hero-right">
        <div className="hero-numeral">02<span className="ord">— components / 26</span></div>
      </div>
    </section>
    <ButtonsBlock />
    <InputsBlock />
    <TagsBlock />
    <Avatars />
    <TaskCardsBlock />
    <AIBlock />
    <CalBlock />
  </div>
);

window.Components = Components;
