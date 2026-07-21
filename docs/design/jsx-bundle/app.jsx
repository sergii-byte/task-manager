const { useState, useEffect } = React;

const App = () => {
  const [tab, setTab] = useState("foundations");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-cell">
          <span className="brand">ordif<span className="accent">y</span><span className="domain">.me</span></span>
        </div>
        <nav className="nav-cell tabs">
          <button aria-selected={tab === "foundations"} onClick={() => setTab("foundations")}><span className="num">01</span>FOUNDATIONS</button>
          <button aria-selected={tab === "components"} onClick={() => setTab("components")}><span className="num">02</span>COMPONENTS</button>
          <button aria-selected={tab === "patterns"} onClick={() => setTab("patterns")}><span className="num">03</span>PATTERNS</button>
          <button aria-selected={tab === "features"} onClick={() => setTab("features")}><span className="num">04</span>FEATURES</button>
          <button aria-selected={tab === "craft"} onClick={() => setTab("craft")}><span className="num">05</span>CRAFT</button>
        </nav>
        <div className="meta-cell">
          <span className="ts">DS · v0.4 · 28.04.26</span>
          <button className="theme-toggle" onClick={() => setDark(d => !d)} aria-label="Toggle theme">
            {dark ? <IconSun className="i-sm" /> : <IconMoon className="i-sm" />}
          </button>
        </div>
      </header>

      <main>
        {tab === "foundations" && <Foundations />}
        {tab === "components" && <Components />}
        {tab === "patterns" && <Patterns />}
        {tab === "features" && <Features />}
        {tab === "craft" && <Craft />}
      </main>

      <footer className="footer">
        <div><span className="k">PROJECT</span><span className="v">ordify.me · DS</span></div>
        <div><span className="k">VERSION</span><span className="v">0.4 — neo-swiss</span></div>
        <div><span className="k">UPDATED</span><span className="v">28 APR 2026</span></div>
        <div><span className="k">OWNER</span><span className="v">sblc.com.ua</span></div>
      </footer>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
