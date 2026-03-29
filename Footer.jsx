import styles from "./Footer.module.css";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="w-full flex flex-col items-center gap-4 px-6 py-8 bg-[#060e1b] border-t border-[#404857]/10 z-10">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd]">
        made with ❤️ by Dev Raheja
      </p>
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Link
            className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100"
            to="/privacy"
          >
            Privacy
          </Link>
          <a
            href="/filoop-privacy-policy.pdf"
            download
            className={styles.pdfLink}
            title="Download Privacy Policy PDF"
          >
            ↓ PDF
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100"
            to="/terms"
          >
            Terms
          </Link>
          <a
            href="/filoop-terms-of-service.pdf"
            download
            className={styles.pdfLink}
            title="Download Terms of Service PDF"
          >
            ↓ PDF
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100"
            to="/support"
          >
            Support
          </Link>
          <a
            href="/filoop-support-guide.pdf"
            download
            className={styles.pdfLink}
            title="Download Support Guide PDF"
          >
            ↓ PDF
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
