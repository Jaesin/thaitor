import changUrl from '../assets/chang.svg';

type MascotElephantProps = {
  size?: number;
  /** Retained for call-site compatibility; has no visual effect on the reference art. */
  mood?: 'happy' | 'waving' | 'cheering';
  className?: string;
};

const MascotElephant: React.FC<MascotElephantProps> = ({ size = 80, className }) => (
  <img
    src={changUrl}
    width={size}
    height={size}
    className={className}
    alt="Chang, the Thaitor elephant mascot"
    draggable={false}
  />
);

export default MascotElephant;
