import LogoSvg from '@/assets/PixelCakeLogo.svg';
import { APP_NAME } from '@/constants/brand';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo = ({ size = 190, className = '' }: LogoProps) => {
  return (
    <img
      src={LogoSvg}
      alt={`${APP_NAME} Logo`}
      style={{ maxWidth: `${size}px` }}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};

export default Logo;
