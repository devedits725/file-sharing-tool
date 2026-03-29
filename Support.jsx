import { Helmet } from 'react-helmet-async';

const Support = () => {
  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-700">
      <Helmet>
        <title>Help & Support — Filoop</title>
        <meta name="description" content="Get help with Filoop file sharing. FAQs on rooms, file transfers, privacy, and troubleshooting." />
        <meta property="og:title" content="Help & Support — Filoop" />
        <meta property="og:description" content="Get help with Filoop file sharing. FAQs on rooms, file transfers, privacy, and troubleshooting." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://filoop.app/support" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Help & Support — Filoop" />
        <meta name="twitter:description" content="Get help with Filoop file sharing." />
        <link rel="canonical" href="https://filoop.app/support" />
      </Helmet>

      <h1 className="text-4xl md:text-5xl font-headline font-bold mb-8 text-on-surface">Help & Support</h1>

      <div className="prose prose-invert max-w-none text-on-surface-variant space-y-10">
        <section>
          <h2 className="text-2xl md:text-3xl font-headline font-semibold text-on-surface mb-6 border-b border-outline-variant/20 pb-2">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <details className="group border border-outline-variant/10 rounded-xl p-4 bg-surface-container-low/20 transition-all">
              <summary className="font-headline font-medium text-lg text-on-surface cursor-pointer list-none flex justify-between items-center group-open:mb-4">
                What is a Room?
                <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-primary">expand_more</span>
              </summary>
              <p className="text-on-surface-variant">A room is a temporary, private space for sharing files. Each room is identified by a unique 6-character code.</p>
            </details>
            <details className="group border border-outline-variant/10 rounded-xl p-4 bg-surface-container-low/20 transition-all">
              <summary className="font-headline font-medium text-lg text-on-surface cursor-pointer list-none flex justify-between items-center group-open:mb-4">
                How long do files stay active?
                <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-primary">expand_more</span>
              </summary>
              <p className="text-on-surface-variant">All files are automatically deleted after 24 hours to ensure your privacy and keep the service fast.</p>
            </details>
            <details className="group border border-outline-variant/10 rounded-xl p-4 bg-surface-container-low/20 transition-all">
              <summary className="font-headline font-medium text-lg text-on-surface cursor-pointer list-none flex justify-between items-center group-open:mb-4">
                Is there a file size limit?
                <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-primary">expand_more</span>
              </summary>
              <p className="text-on-surface-variant">Currently, the limit is 2GB per file shared.</p>
            </details>
            <details className="group border border-outline-variant/10 rounded-xl p-4 bg-surface-container-low/20 transition-all">
              <summary className="font-headline font-medium text-lg text-on-surface cursor-pointer list-none flex justify-between items-center group-open:mb-4">
                Can I delete my files early?
                <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-primary">expand_more</span>
              </summary>
              <p className="text-on-surface-variant">Yes, the host of the room can use the "Destroy Loop" button at any time to immediately remove the room and all its files.</p>
            </details>
          </div>
        </section>

        <section className="bg-surface-container-low/30 p-8 rounded-2xl border border-primary/10 text-center">
          <h2 className="text-2xl font-headline font-semibold text-on-surface mb-4">Still Need Help?</h2>
          <p className="mb-6">Download our comprehensive support guide PDF for more troubleshooting tips.</p>
          <a
            href="/filoop-support-guide.pdf"
            download
            className="inline-flex items-center gap-2 bg-primary text-[#004535] px-8 py-3 rounded-full font-headline font-bold hover:shadow-[0_0_20px_rgba(0,245,196,0.3)] transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Download Support Guide
          </a>
        </section>
      </div>
    </div>
  );
};

export default Support;
