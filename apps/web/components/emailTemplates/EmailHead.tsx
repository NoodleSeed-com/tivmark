import { Head } from '@react-email/components';

const EmailHead = () => (
  <Head>
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <style>{`
      .email-logo-dark { display: none; }
      @media (prefers-color-scheme: dark) {
        .email-body { background-color: #0b1222 !important; }
        .email-card { background-color: #111c33 !important; border-color: #3d4f6b !important; color: #f7f5f0 !important; }
        .email-logo-panel { background-color: #111c33 !important; }
        .email-logo-light { display: none !important; }
        .email-logo-dark { display: block !important; }
        .email-content, .email-content p, .email-content h1, .email-content h2, .email-content h3 { color: #f7f5f0 !important; }
        .email-footer, .email-footer p { color: #c4c0b8 !important; }
        .email-rule { border-color: #3d4f6b !important; }
      }
      [data-ogsc] .email-body { background-color: #0b1222 !important; }
      [data-ogsc] .email-card, [data-ogsc] .email-logo-panel { background-color: #111c33 !important; border-color: #3d4f6b !important; color: #f7f5f0 !important; }
      [data-ogsc] .email-logo-light { display: none !important; }
      [data-ogsc] .email-logo-dark { display: block !important; }
      [data-ogsc] .email-content, [data-ogsc] .email-content p, [data-ogsc] .email-content h1, [data-ogsc] .email-content h2, [data-ogsc] .email-content h3 { color: #f7f5f0 !important; }
    `}</style>
  </Head>
);

export default EmailHead;
