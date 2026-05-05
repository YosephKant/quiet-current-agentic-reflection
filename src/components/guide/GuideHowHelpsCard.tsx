const ROWS = [
  {
    title: "Reflect",
    body: "Gently unpack what you are feeling and what matters underneath.",
    tone: "purple",
  },
  {
    title: "Find patterns",
    body: "Notice recurring themes across days without forcing a narrative.",
    tone: "blue",
  },
  {
    title: "Suggest",
    body: "Translate insights into small, doable practices you can try next.",
    tone: "green",
  },
  {
    title: "Support",
    body: "Stay with you in hard moments — calm pacing, not performance.",
    tone: "coral",
  },
] as const;

export function GuideHowHelpsCard() {
  return (
    <section className="qc-guide-rail-card qc-guide-rail-card--helps" aria-labelledby="qc-guide-helps-heading">
      <h2 id="qc-guide-helps-heading" className="qc-guide-rail-card__title">
        How your AI guide helps
      </h2>
      <ul className="qc-guide-helps-list">
        {ROWS.map((row) => (
          <li key={row.title} className="qc-guide-helps-row">
            <span className={"qc-guide-helps-dot qc-guide-helps-dot--" + row.tone} aria-hidden />
            <div>
              <div className="qc-guide-helps-row__title">{row.title}</div>
              <p className="qc-guide-helps-row__body">{row.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
