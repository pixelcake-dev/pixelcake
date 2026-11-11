/**
 * Login Page with Particle Network Animation
 * Uses tsparticles with particle-network inspired colors and interactions
 * Background: #000 (black) with white particles and connection lines
 */

import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { type ISourceOptions } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { useUIStore } from '@/store/uiStore';
import PixelCakeIcon from '@/assets/PixelCakeIcon.svg';

const LoginPage = () => {
  const [init, setInit] = useState(false);
  const login = useUIStore((state) => state.login);

  // Initialize particles engine
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  // Particle configuration - replicates particle-network visual style
  const options: ISourceOptions = useMemo(
    () => ({
      background: {
        color: {
          value: '#000000', // Pure black like particle-network demo
        },
      },
      fpsLimit: 120,
      interactivity: {
        events: {
          onHover: {
            enable: true,
            mode: 'grab', // Lines connect to cursor on hover
          },
          onClick: {
            enable: true,
            mode: 'push', // Add particle on click
          },
          resize: {
            enable: true,
          },
        },
        modes: {
          grab: {
            distance: 120, // Connection distance (same as particle-network)
            links: {
              opacity: 1, // Lines at full opacity near cursor
            },
          },
          push: {
            quantity: 1, // Add 1 particle per click
          },
        },
      },
      particles: {
        color: {
          value: '#ffffff', // White particles
        },
        links: {
          color: '#ffffff', // White connection lines
          distance: 120, // Connect particles within 120px
          enable: true,
          opacity: 0.7, // Base opacity for links (fades with distance)
          width: 0.7, // Thin lines
        },
        move: {
          direction: 'none',
          enable: true,
          outModes: {
            default: 'bounce', // Bounce off edges
          },
          random: true, // Random movement direction
          speed: 0.5, // Slow velocity (like particle-network "slow" preset)
          straight: false,
        },
        number: {
          density: {
            enable: true,
            width: 800,
            height: 800,
          },
          value: 80, // Number of particles (responsive)
        },
        opacity: {
          value: 0.7, // Particle opacity 70%
        },
        shape: {
          type: 'circle',
        },
        size: {
          value: { min: 1, max: 3 }, // Small particles
        },
      },
      detectRetina: true,
      // Responsive: reduce particles on mobile
      responsive: [
        {
          maxWidth: 768,
          options: {
            particles: {
              number: {
                value: 40, // Fewer particles on mobile for performance
              },
            },
          },
        },
      ],
    }),
    []
  );

  const handleLogin = () => {
    login();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Particle Network Background */}
      {init && <Particles id="tsparticles" options={options} className="absolute inset-0 z-0" />}

      {/* Login Card Overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 md:p-16 border border-white/20 shadow-2xl text-center max-w-sm">
          {/* Logo */}
          <img
            src={PixelCakeIcon}
            alt="PixelCake Logo"
            className="h-20 md:h-24 mx-auto mb-6"
          />

          {/* Title */}
          <h1 className="text-white text-3xl md:text-4xl font-bold mb-8">
            PixelCake
          </h1>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="w-full bg-white text-black px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors duration-200 shadow-lg"
          >
            ACCEDI
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
