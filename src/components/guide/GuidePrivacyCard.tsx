export function GuidePrivacyCard() {
  return (
    <section className="qc-guide-rail-card qc-guide-rail-card--privacy" aria-labelledby="qc-guide-privacy-heading">
      <div className="qc-guide-privacy__head">
        <div className="qc-guide-privacy__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 id="qc-guide-privacy-heading" className="qc-guide-rail-card__title qc-guide-privacy__title">
          Privacy
        </h2>
      </div>
      <p className="qc-guide-privacy__body">
        AI is here to support you. Your conversations stay on this device unless you explicitly choose features that sync
        elsewhere.
      </p>
    </section>
  );
}
