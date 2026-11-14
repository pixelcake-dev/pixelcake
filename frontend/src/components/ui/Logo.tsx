import LogoColour from '@/assets/pixelcake-orizzontale-colore.svg';
import LogoNegative from '@/assets/pixelcake-orizzontale-negativo.svg';
import SymbolColour from '@/assets/pixelcake-simbolo-colore.svg';
import SymbolNegative from '@/assets/pixelcake-simbolo-negativo.svg';
import { APP_NAME } from '@/constants/brand';
import { useUIStore } from '@/store/uiStore';

interface LogoProps {
  /**
   * The symbol alone. The logo with the name is never shown narrower than
   * 110 pixels, where its letters stop being readable: a small place takes
   * the symbol
   */
  symbol?: boolean;
  /** The width of the logo with the name, or the height of the symbol */
  size?: number;
  className?: string;
}

/**
 * The logo: in colour on a light page, in its negative on a dark one.
 * Always one of its own files, never drawn or typed here.
 */
const Logo = ({ symbol = false, size = 190, className = '' }: LogoProps) => {
  const darkMode = useUIStore((state) => state.darkMode);
  const file = symbol
    ? darkMode
      ? SymbolNegative
      : SymbolColour
    : darkMode
      ? LogoNegative
      : LogoColour;
  return (
    <img
      src={file}
      alt={`${APP_NAME} ${symbol ? 'Icon' : 'Logo'}`}
      style={symbol ? { height: `${size}px`, width: 'auto' } : { maxWidth: `${size}px` }}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};

export default Logo;
