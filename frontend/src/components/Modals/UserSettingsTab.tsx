/**
 * User Settings Tab
 * Manages user profile and displays application info
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUserStore } from '@/store/userStore';
import { Icon } from '@iconify/react';
import { GITHUB_REPO } from '@/constants/links';

const UserSettingsTab = () => {
  const userName = useUserStore((state) => state.userName);
  const userEmail = useUserStore((state) => state.userEmail);
  const setUserProfile = useUserStore((state) => state.setUserProfile);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Load current user data
  useEffect(() => {
    setName(userName);
    setEmail(userEmail);
  }, [userName, userEmail]);

  // Generate user initials from name
  const getUserInitials = (fullName: string): string => {
    if (!fullName.trim()) return '??';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Il nome è obbligatorio');
      return;
    }

    setUserProfile(name.trim(), email.trim());
    alert('Profilo salvato con successo!');
  };

  const initials = getUserInitials(name || userName);

  return (
    <div className="settings-panel">
      <h3>Profilo Utente</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">
        Configura il tuo profilo personale e visualizza le informazioni sull'applicazione.
      </p>

      {/* User Profile Section - Form left + Avatar right */}
      <div className="flex mb-8 items-center gap-12">
        {/* Profile Form - Left */}
        <div>
          <div className="space-y-4 mb-4">
            <Input
              label="Nome Completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Mario Rossi"
              size="md"
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="es. mario.rossi@example.com"
              size="lg"
            />
          </div>

          <Button variant="primary" onClick={handleSave}>
            Salva Profilo
          </Button>
        </div>

        {/* Avatar - Right (positioned after form fields) */}
        <div className="flex flex-col items-center">
          <div
            className="w-[106px] h-[106px] rounded-full bg-[var(--accent-color)] flex items-center justify-center text-white text-3xl font-bold"
            title="Avatar utente (iniziali)"
          >
            {initials}
          </div>
          <p className="text-xs text-[var(--text-color-light)] mt-2 text-center">
            Iniziali auto
          </p>
        </div>
      </div>

      {/* Application Info Section */}
      <hr className="my-6 border-[var(--border-color)]" />

      <h3 className="mb-4">Informazioni Applicazione</h3>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Icon icon="mdi:application" className="text-[var(--accent-color)]" width={24} />
          <div>
            <p className="font-semibold">PixelCake</p>
            <p className="text-sm text-[var(--text-color-light)]">
              Visual network designer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Icon icon="mdi:tag" className="text-[var(--accent-color)]" width={24} />
          <div>
            <p className="font-semibold">Versione</p>
            <p className="text-sm text-[var(--text-color-light)]">0.1.0 (Beta)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Icon icon="mdi:license" className="text-[var(--accent-color)]" width={24} />
          <div>
            <p className="font-semibold">Licenza</p>
            <p className="text-sm text-[var(--text-color-light)]">AGPLv3 - Open Source</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Icon icon="mdi:github" className="text-[var(--accent-color)]" width={24} />
          <div>
            <p className="font-semibold">Repository</p>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--accent-color)] hover:underline"
            >
              {GITHUB_REPO.replace('https://', '')}
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Icon icon="mdi:code-tags" className="text-[var(--accent-color)]" width={24} />
          <div>
            <p className="font-semibold">Tecnologie</p>
            <p className="text-sm text-[var(--text-color-light)]">
              React 19, TypeScript, Vite, Zustand, React Flow, Tailwind CSS
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-[var(--color-canvas)] rounded-lg border border-[var(--border-color)] mb-4">
        <p className="text-sm text-[var(--text-color-light)] italic">
          "Infrastructure, piece by piece." 🍰
        </p>
      </div>
    </div>
  );
};

export default UserSettingsTab;
