import { Helmet } from 'react-helmet-async';

const Terms = () => {
  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-700">
      <Helmet>
        <title>Terms of Service — Filoop</title>
        <meta name="description" content="Filoop's terms of service. Use Filoop only for lawful file sharing. Room-based, ephemeral, and privacy-first." />
        <meta property="og:title" content="Terms of Service — Filoop" />
        <meta property="og:description" content="Filoop's terms of service. Use Filoop only for lawful file sharing. Room-based, ephemeral, and privacy-first." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://filoop.app/terms" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Terms of Service — Filoop" />
        <meta name="twitter:description" content="Filoop's terms of service. Use Filoop only for lawful file sharing. Room-based, ephemeral, and privacy-first." />
        <link rel="canonical" href="https://filoop.app/terms" />
      </Helmet>

      <h1 className="text-4xl md:text-5xl font-headline font-bold mb-8 text-on-surface">Terms of Service</h1>

      <div className="prose prose-invert max-w-none text-on-surface-variant space-y-6">
        <p>
          By using Filoop, you agree to these terms.
        </p>
        <section>
          <h2 className="text-2xl font-headline font-semibold text-on-surface">Acceptable Use</h2>
          <p>You may only use Filoop for lawful purposes. You are responsible for all files you upload and share.</p>
        </section>
        <section>
          <h2 className="text-2xl font-headline font-semibold text-on-surface">No Warranties</h2>
          <p>Filoop is provided "as is" without warranty of any kind. We do not guarantee the availability or persistence of your files beyond the stated deletion window.</p>
        </section>
        <section>
          <h2 className="text-2xl font-headline font-semibold text-on-surface">Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Your continued use of the service constitutes acceptance of updated terms.</p>
        </section>
        <p className="mt-8">
          For more details, you can download our full terms of service PDF from the footer.
        </p>
      </div>
    </div>
  );
};

export default Terms;
