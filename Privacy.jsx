import { Helmet } from 'react-helmet-async';

const Privacy = () => {
  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-700">
      <Helmet>
        <title>Privacy Policy — Filoop</title>
        <meta name="description" content="Filoop collects minimal data, never sells it, and deletes all files within 24 hours. Read our full privacy policy." />
        <meta property="og:title" content="Privacy Policy — Filoop" />
        <meta property="og:description" content="Filoop collects minimal data, never sells it, and deletes all files within 24 hours." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://filoop.app/privacy" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Privacy Policy — Filoop" />
        <meta name="twitter:description" content="Filoop collects minimal data, never sells it, and deletes all files within 24 hours." />
        <link rel="canonical" href="https://filoop.app/privacy" />
      </Helmet>

      <h1 className="text-4xl md:text-5xl font-headline font-bold mb-8 text-on-surface">Privacy Policy</h1>

      <div className="prose prose-invert max-w-none text-on-surface-variant space-y-6">
        <p>
          At Filoop, we take your privacy seriously. Our service is designed to be ephemeral and minimal.
        </p>
        <section>
          <h2 className="text-2xl font-headline font-semibold text-on-surface">Data Collection</h2>
          <p>We do not require accounts or personal information to use Filoop. We collect minimal technical data necessary to provide the service.</p>
        </section>
        <section>
          <h2 className="text-2xl font-headline font-semibold text-on-surface">File Retention</h2>
          <p>All shared files and associated room data are automatically deleted after 24 hours. We do not maintain backups of your files once they are deleted.</p>
        </section>
        <p className="mt-8">
          For more details, you can download our full privacy policy PDF from the footer.
        </p>
      </div>
    </div>
  );
};

export default Privacy;
