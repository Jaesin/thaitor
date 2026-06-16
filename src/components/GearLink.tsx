import styles from './GearLink.module.css';

// Settings entry point shown top-right inside each screen header.
const GearLink: React.FC = () => {
  return (
    <a href="#/settings" className={styles.gearBtn} aria-label="Settings">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    </a>
  );
};

export default GearLink;
