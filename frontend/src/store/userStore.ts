/**
 * User Store
 * Manages user profile and preferences with LocalStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferences {
  language: 'it' | 'en';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  unitSystem: 'metric' | 'imperial';
}

interface UserStore {
  // User Profile State
  userName: string;
  userEmail: string;

  // User Preferences State
  preferences: UserPreferences;

  // User Profile Actions
  setUserProfile: (userName: string, userEmail: string) => void;
  clearUserProfile: () => void;

  // User Preferences Actions
  setLanguage: (language: 'it' | 'en') => void;
  setDateFormat: (format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD') => void;
  setUnitSystem: (system: 'metric' | 'imperial') => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      // Initial State
      userName: '',
      userEmail: '',
      preferences: {
        language: 'it',
        dateFormat: 'DD/MM/YYYY',
        unitSystem: 'metric',
      },

      // User Profile Actions
      setUserProfile: (userName, userEmail) =>
        set({ userName, userEmail }),

      clearUserProfile: () =>
        set({ userName: '', userEmail: '' }),

      // User Preferences Actions
      setLanguage: (language) =>
        set((state) => ({
          preferences: { ...state.preferences, language },
        })),

      setDateFormat: (dateFormat) =>
        set((state) => ({
          preferences: { ...state.preferences, dateFormat },
        })),

      setUnitSystem: (unitSystem) =>
        set((state) => ({
          preferences: { ...state.preferences, unitSystem },
        })),
    }),
    {
      name: 'pixelcake-user-v1', // LocalStorage key
    }
  )
);
