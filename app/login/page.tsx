import Image from "next/image";

const ERRORS: Record<string, string> = {
  state: "Sesiunea de autentificare a expirat. Încearcă din nou.",
  discord: "Discord nu a răspuns. Încearcă din nou.",
  bot: "Botul nu răspunde momentan, nu am putut verifica rolurile. Încearcă din nou în câteva minute.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ denied?: string; error?: string }> }) {
  const { denied, error } = await searchParams;
  return (
    <div className="scene">
      <Image src="/logo.png" alt="" aria-hidden="true" width={820} height={820} className="scene-logo" priority />
      <main
        className="glass"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          borderRadius: 26,
          padding: "40px 28px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          textAlign: "center",
          background: "rgba(10,12,40,0.45)",
        }}
      >
        <Image src="/logo.png" alt="Logo Phoenix" width={112} height={112} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="num" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "0.08em" }}>
            LSPD
          </h1>
          <span style={{ fontSize: 13, letterSpacing: "0.16em", color: "var(--muted-2)" }}>PHOENIX · LOS SANTOS</span>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>Panou HR și Birou conducere</p>

        {denied && (
          <div role="alert" className="state-error" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", borderRadius: 14, textAlign: "left" }}>
            <strong style={{ fontSize: 14.5 }}>Nu ai acces la acest panou</strong>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: "#F1D9D6" }}>
              {denied !== "1" ? (
                <>
                  Contul <strong>{denied}</strong> nu are
                </>
              ) : (
                "Contul tău nu mai are"
              )}{" "}
              niciunul dintre rolurile cu acces de pe serverul LSPD. Dacă ar trebui să ai acces, contactează Conducerea.
            </span>
          </div>
        )}
        {error && (
          <div role="alert" className="state state-error" style={{ width: "100%", textAlign: "left" }}>
            {ERRORS[error] ?? ERRORS.discord}
          </div>
        )}

        <a
          href="/api/auth/login"
          className="btn"
          style={{ width: "100%", height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, textDecoration: "none", fontSize: 15.5 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
          Conectează-te cu Discord
        </a>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, textAlign: "left", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <span className="nav-title" style={{ padding: 0 }}>
            Acces doar pentru rolurile HR și Conducere
          </span>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ fontWeight: 600, color: "var(--text)" }}>HR</strong>
            <span style={{ textAlign: "right" }}>Dashboard, Pontaje, Concedii, Evidență membri, Acțiuni HR</span>
          </span>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ fontWeight: 600, color: "var(--text)" }}>Conducere</strong>
            <span style={{ textAlign: "right" }}>Tot ce are HR + Loguri</span>
          </span>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--muted-3)" }}>Citim doar numele tău și rolurile de pe serverul LSPD.</span>
      </main>
    </div>
  );
}
