// Patterns — full app shell + kanban + capture + voice

const TaskRow = ({ idx, done, title, tag, priority, due, ai, dueClass = "", assignees }) => (
  <div className={"task-row " + (done ? "done" : "")}>
    <span className="idx">{idx}</span>
    <input type="checkbox" className="checkbox" defaultChecked={done} />
    <div className="title">{title}</div>
    <div style={{display:"flex", gap: 8, alignItems:"center"}}>
      {priority ? <span className={`priority ${priority}`}>{priority === "urgent" ? "P0" : priority === "high" ? "P1" : priority === "med" ? "P2" : "P3"}</span> : null}
      {tag ? <span className={`tag ${tag.cls}`}>{tag.cls === "research" || tag.cls === "life" || tag.cls === "craft" ? null : <span className="dot"/>}{tag.label}</span> : null}
    </div>
    {ai ? <span className="ai-mark">AI ▸</span> : <span/>}
    <div>{assignees ? <div className="avatar-stack">{assignees.map((a,i) => <span key={i} className={`avatar sm ${a.cls}`}>{a.label}</span>)}</div> : null}</div>
    <span className={"mono upper"} style={{color: dueClass === "overdue" ? "var(--accent)" : "var(--fg-muted)", fontWeight: dueClass === "overdue" ? 700 : 500}}>{due}</span>
  </div>
);

const Sidebar = () => (
  <aside style={{
    width: 260, flexShrink: 0,
    background: "var(--bg)",
    borderRight: "var(--rule-thick)",
    display: "flex", flexDirection: "column",
  }}>
    <div style={{padding:"20px 16px", borderBottom:"var(--rule-thick)", display:"flex", alignItems:"baseline", gap: 6}}>
      <span style={{fontFamily:"var(--font-sans)", fontWeight: 800, fontSize: 22, letterSpacing:"-0.04em", textTransform:"lowercase"}}>ordif<span style={{color:"var(--accent)"}}>y</span></span>
      <span className="mono" style={{fontSize:"var(--text-2xs)", color:"var(--fg-faint)"}}>.me</span>
    </div>

    <div style={{padding:"12px 16px", borderBottom:"1px solid var(--line)"}}>
      <div className="input-group" style={{padding:"0 10px"}}>
        <span className="icon"><IconSearch className="i-sm" /></span>
        <input className="input" placeholder="SEARCH" style={{padding:"8px 0", fontSize:"var(--text-xs)", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"var(--font-mono)", borderBottom: 0}} />
        <span className="kbd">⌘K</span>
      </div>
    </div>

    <div className="upper" style={{padding:"16px 16px 8px", color:"var(--fg-faint)"}}>VIEWS</div>
    <div className="proj active"><span className="num">01</span><IconHome className="i-sm" /><span>Today</span><span className="count">8</span></div>
    <div className="proj"><span className="num">02</span><IconInbox className="i-sm" /><span>Inbox</span><span className="count">14</span></div>
    <div className="proj"><span className="num">03</span><IconCalendar className="i-sm" /><span>Upcoming</span><span className="count">23</span></div>
    <div className="proj"><span className="num">04</span><IconStar className="i-sm" /><span>Important</span><span className="count">2</span></div>

    <div className="upper" style={{padding:"24px 16px 8px", color:"var(--fg-faint)"}}>PROJECTS · 04</div>
    <div className="proj"><span className="num">05</span><span className="swatch-dot" style={{background:"var(--accent)"}}/><span>Q3 proposal</span><span className="count">12</span></div>
    <div className="proj"><span className="num">06</span><span className="swatch-dot" style={{background:"var(--cobalt)"}}/><span>Marketing site</span><span className="count">7</span></div>
    <div className="proj"><span className="num">07</span><span className="swatch-dot" style={{background:"var(--saffron)"}}/><span>Onboarding v2</span><span className="count">5</span></div>
    <div className="proj"><span className="num">08</span><span className="swatch-dot" style={{background:"var(--ink)"}}/><span>Personal</span><span className="count">3</span></div>

    <div style={{marginTop:"auto", padding: 16, borderTop:"var(--rule-thick)", display:"flex", alignItems:"center", gap: 12}}>
      <span className="avatar a1">AK</span>
      <div style={{display:"flex", flexDirection:"column", lineHeight: 1.2}}>
        <span style={{fontSize:"var(--text-sm)", fontWeight: 700, fontFamily:"var(--font-text)"}}>Andrii K.</span>
        <span className="mono" style={{fontSize:"var(--text-2xs)", color:"var(--fg-faint)", textTransform:"uppercase", letterSpacing:"0.1em"}}>PRO · sblc.com.ua</span>
      </div>
      <button className="btn icon ghost" style={{marginLeft:"auto"}}><IconSettings className="i-sm" /></button>
    </div>
  </aside>
);

const TaskListPreview = () => (
  <div style={{flex: 1, display: "flex", flexDirection: "column", borderRight:"var(--rule-thin)"}}>
    <div style={{padding:"24px 24px 20px", borderBottom:"var(--rule-thick)", display:"flex", alignItems:"flex-end", gap: 16, justifyContent:"space-between"}}>
      <div>
        <div className="upper" style={{color:"var(--accent)", marginBottom: 8}}>VIEW 01 · TODAY</div>
        <h2 style={{fontFamily:"var(--font-sans)", fontSize: 40, fontWeight: 800, margin: 0, letterSpacing:"-0.04em", textTransform:"lowercase", lineHeight: 0.95}}>
          today, <span style={{color:"var(--accent)"}}>focused.</span>
        </h2>
      </div>
      <div style={{display:"flex", gap: 8, alignItems:"center"}}>
        <span className="status doing"><span className="pulse" />8 ACTIVE</span>
        <button className="btn secondary sm"><IconList className="i-sm" />List</button>
        <button className="btn ghost sm"><IconBoard className="i-sm" />Board</button>
        <button className="btn ghost sm"><IconFilter className="i-sm" /></button>
        <button className="btn accent sm"><IconPlus className="i-sm" />New</button>
      </div>
    </div>

    <div style={{padding:"12px 24px 4px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid var(--line)"}}>
      <span className="upper" style={{color:"var(--fg-faint)"}}>MORNING · 04</span>
      <span className="upper mono" style={{color:"var(--fg-faint)"}}>09:00 — 12:00</span>
    </div>
    <TaskRow idx="01" priority="urgent" title="Review proposal draft for Mira & Sam" tag={{cls:"work", label:"Q3 proposal"}} due="11:00" dueClass="overdue" ai assignees={[{cls:"a1", label:"AK"},{cls:"a2", label:"MR"}]} />
    <TaskRow idx="02" priority="high" title="Reply to design feedback on onboarding flow" tag={{cls:"design", label:"Design"}} due="11:30" assignees={[{cls:"a3", label:"SO"}]} />
    <TaskRow idx="03" done title="Standup with eng team" tag={{cls:"work", label:"Work"}} due="09:30" />
    <TaskRow idx="04" done title="Inbox triage" due="08:50" />

    <div style={{padding:"12px 24px 4px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid var(--line)"}}>
      <span className="upper" style={{color:"var(--fg-faint)"}}>AFTERNOON · 04</span>
      <span className="upper mono" style={{color:"var(--fg-faint)"}}>13:00 — 19:00</span>
    </div>
    <TaskRow idx="05" priority="high" title="Draft Q3 product narrative" tag={{cls:"work", label:"Q3 proposal"}} due="14:00" ai assignees={[{cls:"a1", label:"AK"}]} />
    <TaskRow idx="06" priority="med" title="Send proposal package to stakeholders" tag={{cls:"work", label:"Q3 proposal"}} due="16:00" />
    <TaskRow idx="07" priority="med" title="Prep notes for 1:1 with Mira" tag={{cls:"research", label:"Research"}} due="15:00" />
    <TaskRow idx="08" priority="low" title="Pick up groceries" tag={{cls:"life", label:"Personal"}} due="18:30" />

    <div style={{padding:"16px 24px", borderTop:"var(--rule-thick)", background:"var(--ink)", color:"var(--bg)", display:"flex", alignItems:"center", gap: 12, marginTop:"auto"}}>
      <span style={{color:"var(--accent)", fontFamily:"var(--font-mono)", fontWeight: 700, letterSpacing:"0.1em"}}>AI ▸</span>
      <span style={{fontSize:"var(--text-sm)", fontFamily:"var(--font-text)"}}>Defer 2 low-priority tasks to Wednesday?</span>
      <button className="btn accent sm" style={{marginLeft:"auto"}}>Apply</button>
      <button className="btn sm" style={{background:"transparent", color:"var(--bg)", borderColor:"var(--bg)"}}>Dismiss</button>
    </div>
  </div>
);

const KanbanPreview = () => (
  <div style={{border:"var(--rule-thick)"}}>
    <div style={{padding:"16px 24px", borderBottom:"var(--rule-thick)", background:"var(--ink)", color:"var(--bg)", display:"flex", alignItems:"center", gap: 12}}>
      <span className="upper" style={{color:"var(--accent)"}}>PROJECT 05</span>
      <span style={{fontWeight: 700, fontSize:"var(--text-md)", letterSpacing:"-0.01em"}}>q3 proposal · board</span>
      <span className="mono" style={{marginLeft:"auto", fontSize:"var(--text-xs)", color:"#888"}}>10 OPEN · 5 DONE</span>
    </div>
    <div className="kanban">
      <div className="col">
        <div className="col-head">TO DO<span className="count">03</span></div>
        <div className="task">
          <div className="row"><span className="idx">T-024</span><input type="checkbox" className="checkbox" /><div className="title">Outline executive summary</div></div>
          <div className="meta"><span className="priority high">P1</span><span className="due">MON</span></div>
        </div>
        <div className="task ai-suggested">
          <div className="row"><span className="idx">T-025</span><input type="checkbox" className="checkbox" /><div className="title">Compile competitor analysis</div></div>
          <div className="meta"><span className="due">SUGGESTED · WED</span></div>
        </div>
        <div className="task">
          <div className="row"><span className="idx">T-026</span><input type="checkbox" className="checkbox" /><div className="title">Schedule legal review</div></div>
          <div className="meta"><span className="priority low">P3</span></div>
        </div>
      </div>
      <div className="col">
        <div className="col-head">IN PROGRESS<span className="count">02</span></div>
        <div className="task">
          <div className="row"><span className="idx">T-019</span><input type="checkbox" className="checkbox" /><div className="title">Draft Q3 product narrative</div></div>
          <div className="meta"><span className="priority high">P1</span><span className="due">TUE · 14:00</span><div style={{marginLeft:"auto"}}><span className="avatar sm a1">AK</span></div></div>
        </div>
        <div className="task">
          <div className="row"><span className="idx">T-020</span><input type="checkbox" className="checkbox" /><div className="title">Pricing tier visuals</div></div>
          <div className="meta"><span className="tag design"><span className="dot"/>Design</span><span className="due">WED</span></div>
        </div>
      </div>
      <div className="col">
        <div className="col-head">DONE<span className="count">05</span></div>
        <div className="task done">
          <div className="row"><span className="idx">T-014</span><input type="checkbox" className="checkbox" defaultChecked /><div className="title">Stakeholder interviews</div></div>
          <div className="meta"><span className="due">24.04</span></div>
        </div>
        <div className="task done">
          <div className="row"><span className="idx">T-013</span><input type="checkbox" className="checkbox" defaultChecked /><div className="title">Define success metrics</div></div>
          <div className="meta"><span className="due">22.04</span></div>
        </div>
      </div>
    </div>
  </div>
);

const Patterns = () => (
  <div className="page">
    <section className="hero" style={{minHeight: 320}}>
      <div className="hero-left">
        <div>
          <div className="hero-eyebrow">
            <span>FILE 03 / PATTERNS</span>
            <span className="rule" />
            <span>04 LAYOUTS</span>
          </div>
          <h1 style={{marginTop: 24, fontSize: 56}}>
            in <span className="accent">practice.</span>
          </h1>
        </div>
      </div>
      <div className="hero-right">
        <div className="hero-numeral">03<span className="ord">— patterns / 04</span></div>
      </div>
    </section>

    <section className="section">
      <div className="section-head">
        <div className="section-num">P.01<br/>SHELL</div>
        <h2>today view · full shell</h2>
        <div className="desc">Sidebar · main · ai. Three columns of intent. AI sits flush right; never floats.</div>
      </div>
      <div className="section-body no-pad">
        <div style={{display:"flex", minHeight: 760, background:"var(--bg)"}}>
          <Sidebar />
          <TaskListPreview />
          <aside style={{width: 360, flexShrink: 0, background:"var(--bg)", display:"flex", flexDirection:"column"}}>
            <div className="ai-panel" style={{height: "100%", border: 0, borderLeft: 0}}>
              <div className="ai-panel-head">
                <div className="ai-glyph">o</div>
                <div className="ai-title">ordify <small>· today</small></div>
                <button className="btn icon ghost" style={{marginLeft:"auto", color:"var(--bg)", borderColor:"transparent"}}><IconX className="i-sm" /></button>
              </div>
              <div className="ai-panel-body">
                <div className="ai-bubble">
                  Good morning, Andrii. <strong>8 tasks</strong> today, one overdue. Want me to reshape the morning around the proposal review?
                </div>
                <div className="ai-suggest-row">
                  <button className="ai-chip">▸ Reshape morning</button>
                  <button className="ai-chip">Defer P3</button>
                  <button className="ai-chip">Block focus</button>
                </div>
                <div className="ai-bubble user">Reshape it, but keep standup at 09:30.</div>
                <div className="ai-bubble">
                  <strong>Done.</strong> Moved triage to tomorrow, blocked 09:45–11:00 for proposal draft, kept standup.
                  <div className="upper mono" style={{color:"var(--accent)", marginTop: 8}}>3 TASKS UPDATED</div>
                </div>
                <div className="ai-thinking">
                  <span>Watching mail</span>
                  <span className="dots"><span></span><span></span><span></span></span>
                </div>
              </div>
              <div className="ai-input">
                <input placeholder="Ask ordify…" />
                <span className="kbd">⏎</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="section-head">
        <div className="section-num">P.02<br/>BOARD</div>
        <h2>kanban · project board</h2>
        <div className="desc">Three columns, ink dividers, tasks as cards. AI suggestions integrate inline rather than living off to the side.</div>
      </div>
      <div className="section-body"><KanbanPreview /></div>
    </section>

    <section className="section">
      <div className="section-head">
        <div className="section-num">P.03<br/>CAPTURE</div>
        <h2>quick capture · plain language</h2>
        <div className="desc">Type a sentence. ordify parses date, project, priority and assignees inline before commit.</div>
      </div>
      <div className="section-body" style={{display:"flex", justifyContent:"center", padding: 64, background:"var(--bg-1)"}}>
        <div className="capture-window">
          <div className="capture-head">
            <span>QUICK CAPTURE · ⌘N</span>
            <span>ESC TO CLOSE</span>
          </div>
          <div style={{padding: "24px 24px 16px", borderBottom:"1px solid var(--line)"}}>
            <input className="input" defaultValue="Review Q3 proposal with Mira tomorrow at 2pm, high priority" style={{fontSize: 22, fontWeight: 600, padding:"4px 0", borderBottom:"none"}}/>
          </div>
          <div style={{padding: 20, display:"flex", flexWrap:"wrap", gap: 10, alignItems:"center", borderBottom:"1px solid var(--line)"}}>
            <span className="upper" style={{color:"var(--accent)", marginRight: 4}}>DETECTED ▸</span>
            <span className="tag work"><span className="dot"/>Q3 proposal</span>
            <span className="priority high">P1 ▸ HIGH</span>
            <span className="status todo"><IconCalendar className="i-sm" />TUE 29.04 · 14:00</span>
            <span className="status todo"><IconUser className="i-sm" />Mira R.</span>
          </div>
          <div style={{padding: 14, display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--bg-1)"}}>
            <span className="mono upper" style={{color:"var(--fg-faint)"}}>06 ATTRS PARSED · 0 CONFLICTS</span>
            <div style={{display:"flex", gap: 8}}>
              <button className="btn secondary sm">Edit</button>
              <button className="btn accent sm"><IconCheck className="i-sm" />Create</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="section-head">
        <div className="section-num">P.04<br/>VOICE</div>
        <h2>tone, in one breath</h2>
        <div className="desc">Direct. Lowercase. Imperative. ordify never apologizes — it adjusts.</div>
      </div>
      <div className="section-body" style={{padding: 96, display:"grid", placeItems:"center", borderTop:"var(--rule-thin)", background:"var(--bg-1)"}}>
        <p className="pull">
          plan with <span className="accent">order.</span><br/>
          make with <span className="accent">craft.</span><br/>
          <span className="strike">stop apologizing.</span>
        </p>
      </div>
    </section>
  </div>
);

window.Patterns = Patterns;
