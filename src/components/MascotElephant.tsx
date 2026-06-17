import changUrl from '../assets/chang.svg';
import changLandscapeUrl from '../assets/chang-landscape.svg';

type MascotElephantProps = {
  size?: number;
  /** Retained for call-site compatibility; has no visual effect on the reference art. */
  mood?: 'happy' | 'waving' | 'cheering';
  className?: string;
  /**
   * Use the wide, whitespace-trimmed art instead of the square original.
   * `size` then sets the width and the height is derived from the ~2:1 aspect.
   */
  landscape?: boolean;
};

const MascotElephant: React.FC<MascotElephantProps> = ({ size = 80, className, landscape }) => (
  <img
    src={landscape ? changLandscapeUrl : changUrl}
    width={size}
    height={landscape ? undefined : size}
    style={landscape ? { height: 'auto' } : undefined}
    className={className}
    alt="Chang, the Thaitor elephant mascot"
    draggable={false}
  />
);

export default MascotElephant;
