import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { Switch } from '~/components/ui/Switch';
import type { UserProfile } from '~/components/@settings/core/types';
import { isMac } from '~/utils/os';
import { useSettings } from '~/lib/hooks/useSettings';
import { NOTIFICATION_SOUNDS, getSelectedSound, setSelectedSound, playTestSound as playTestAudio } from '~/utils/audio';
import { debounce } from '~/utils/debounce';

// Helper to get modifier key symbols/text
const getModifierSymbol = (modifier: string): string => {
  switch (modifier) {
    case 'meta':
      return isMac ? '⌘' : 'Win';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'shift':
      return '⇧';
    default:
      return modifier;
  }
};

// Section component for consistency
const SettingsSection = ({ 
  icon, 
  title, 
  delay, 
  children 
}: { 
  icon: string; 
  title: string; 
  delay: number; 
  children: React.ReactNode 
}) => (
  <motion.div
    className="bg-white dark:bg-[#0A0A0A] rounded-lg shadow-md border border-gray-100 dark:border-gray-800 p-2 space-y-6"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
      <div className={`${icon} w-5 h-5 text-violet-600`} />
      <span className="text-base font-semibold text-bolt-elements-textPrimary">{title}</span>
    </div>
    {children}
  </motion.div>
);

// Option item component
const SettingsItem = ({ 
  icon, 
  label, 
  children 
}: { 
  icon: string; 
  label: string; 
  children: React.ReactNode 
}) => (
  <div className="bg-gray-50 dark:bg-[#111111] rounded-xl p-2 transition-all hover:bg-gray-100 dark:hover:bg-[#151515]">
    <div className="flex items-center gap-3 mb-3">
      <div className={`${icon} w-4 h-4 text-violet-500`} />
      <label className="text-sm font-medium text-bolt-elements-textPrimary">{label}</label>
    </div>
    {children}
  </div>
);

export default function SettingsTab() {
  const [currentTimezone, setCurrentTimezone] = useState('');
  const { 
    chatSoundEnabled, 
    setChatSoundEnabled, 
    chatSoundVolume, 
    setChatSoundVolume,
    alertSoundEnabled,
    setAlertSoundEnabled,
    customInstructions, // Added custom instructions
    setCustomInstructions // Added setter for custom instructions
  } = useSettings();
  
  const [selectedSound, setSelectedSoundState] = useState(() => getSelectedSound());
  const [settings, setSettings] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('bolt_user_profile');
    return saved
      ? JSON.parse(saved)
      : {
          notifications: true,
          language: 'fr',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
  });

  // Added local state for custom instructions to use with debounce
  const [localInstructions, setLocalInstructions] = useState(customInstructions);

  // Update local state if global state changes (e.g., initial load)
  useEffect(() => {
    setLocalInstructions(customInstructions);
  }, [customInstructions]);

  // Debounced update function
  const debouncedUpdate = useCallback(
    debounce((value: string) => {
      setCustomInstructions(value);
      toast.info('Instructions personnalisées sauvegardées');
    }, 5000), // Save 500ms after typing stops
    [setCustomInstructions]
  );

  const handleInstructionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalInstructions(newValue);
    debouncedUpdate(newValue);
  };

  useEffect(() => {
    setCurrentTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // Save settings automatically when they change
  useEffect(() => {
    try {
      // Get existing profile data
      const existingProfile = JSON.parse(localStorage.getItem('bolt_user_profile') || '{}');

      // Merge with new settings
      const updatedProfile = {
        ...existingProfile,
        notifications: settings.notifications,
        language: settings.language,
        timezone: settings.timezone,
      };

      localStorage.setItem('bolt_user_profile', JSON.stringify(updatedProfile));
      toast.success('Paramètres mis à jour');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres :', error);
      toast.error('Échec de la mise à jour des paramètres');
    }
  }, [settings]);

  // Play a test sound for audio preview
  const playTestSound = () => {
    playTestAudio();
    toast.info('Lecture du son de test');
  };

  // Handle sound selection change
  const handleSoundChange = (soundPath: string) => {
    setSelectedSoundState(soundPath);
    setSelectedSound(soundPath);

    // Play the selected sound for preview
    playTestAudio(soundPath);
    toast.success('Le son a changé');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">Paramètres</h1>
        <p className="text-bolt-elements-textSecondary">Personnalisez votre expérience NeuroCode</p>
      </motion.div>
       {/* Custom Instructions Section - NEW */}
       <SettingsSection icon="i-ph:user-focus-fill" title="Instructions Personnalisées" delay={0.25}>
        <SettingsItem icon="i-ph:scroll-fill" label="Vos instructions pour l'IA">
          <p className="text-xs text-bolt-elements-textSecondary mb-3">
            Fournissez des instructions spécifiques (par exemple, style de réponse, persona, format de code) qui seront ajoutées au début de chaque prompt système.
          </p>
          {/* Exemples d'instructions cliquables */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <button
              onClick={() => {
                setLocalInstructions("Agis comme un développeur senior expert. Fournis des explications techniques détaillées et des solutions optimisées. Ton code doit être bien structuré avec des commentaires pertinents et suivre les meilleures pratiques de l'industrie.");
                debouncedUpdate("Agis comme un développeur senior expert. Fournis des explications techniques détaillées et des solutions optimisées. Ton code doit être bien structuré avec des commentaires pertinents et suivre les meilleures pratiques de l'industrie.");
                toast.info('Instructions personnalisées mises à jour');
              }}
              className="px-3 py-2 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
            >
              Mode Expert
            </button>
            <button
              onClick={() => {
                setLocalInstructions("Agis comme un mentor pédagogique. Explique chaque concept en détail avec des exemples concrets. Décompose les problèmes complexes en étapes simples et fournis des analogies pour faciliter la compréhension.");
                debouncedUpdate("Agis comme un mentor pédagogique. Explique chaque concept en détail avec des exemples concrets. Décompose les problèmes complexes en étapes simples et fournis des analogies pour faciliter la compréhension.");
                toast.info('Instructions personnalisées mises à jour');
              }}
              className="px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              Mode Explicatif
            </button>
            <button
              onClick={() => {
                setLocalInstructions("Sois concis et direct. Fournis des réponses courtes et précises sans explications superflues. Privilégie le code fonctionnel avec des commentaires minimaux mais suffisants pour comprendre la logique.");
                debouncedUpdate("Sois concis et direct. Fournis des réponses courtes et précises sans explications superflues. Privilégie le code fonctionnel avec des commentaires minimaux mais suffisants pour comprendre la logique.");
                toast.info('Instructions personnalisées mises à jour');
              }}
              className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Mode Concis
            </button>
          </div>
          <textarea
            value={localInstructions}
            onChange={handleInstructionChange}
            className={classNames(
              'w-full px-4 py-3 rounded-lg text-sm min-h-[150px] resize-y',
              'bg-white dark:bg-[#0A0A0A]',
              'border border-gray-200 dark:border-gray-800',
              'text-bolt-elements-textPrimary',
              'placeholder-gray-500 dark:placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-violet-500/30',
              'transition-all duration-200',
            )}
            placeholder="Exemple : Agis comme un développeur senior spécialisé en Python. Explique toujours tes choix techniques. Formate le code avec des commentaires clairs."
          />
          <p className="text-xs text-bolt-elements-textTertiary mt-2">
            Note : Ces instructions augmentent le nombre de tokens utilisés. Les modifications sont sauvegardées automatiquement après 5 secondes d'inactivité.
          </p>
        </SettingsItem>
      </SettingsSection>
      {/* Langue & Notifications */}
      {/* <SettingsSection icon="i-ph:palette-fill" title="Préférences" delay={0.1}>
        <div className="grid md:grid-cols-2 gap-4">
          <SettingsItem icon="i-ph:translate-fill" label="Langue">
            <select
              value={settings.language}
              onChange={(e) => setSettings((prev) => ({ ...prev, language: e.target.value }))}
              className={classNames(
                'w-full px-4 py-3 rounded-lg text-sm',
                'bg-white dark:bg-[#0A0A0A]',
                'border border-gray-200 dark:border-gray-800',
                'text-bolt-elements-textPrimary',
                'focus:outline-none focus:ring-2 focus:ring-violet-500/30',
                'transition-all duration-200',
              )}
            >
              <option value="en">Anglais</option>
              <option value="es">Espagnol</option>
              <option value="fr">Français</option>
              <option value="de">Allemand</option>
              <option value="it">Italien</option>
              <option value="pt">Portugais</option>
              <option value="ru">Russe</option>
              <option value="zh">Chinois</option>
              <option value="ja">Japonais</option>
              <option value="ko">Coréen</option>
            </select>
          </SettingsItem>

          <SettingsItem icon="i-ph:bell-fill" label="Notifications">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bolt-elements-textSecondary">
                {settings.notifications ? 'Les notifications sont activées' : 'Les notifications sont désactivées'}
              </span>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(checked) => {
                  // Update local state
                  setSettings((prev) => ({ ...prev, notifications: checked }));

                  // Update localStorage immediately
                  const existingProfile = JSON.parse(localStorage.getItem('bolt_user_profile') || '{}');
                  const updatedProfile = {
                    ...existingProfile,
                    notifications: checked,
                  };
                  localStorage.setItem('bolt_user_profile', JSON.stringify(updatedProfile));

                  // Dispatch storage event for other components
                  window.dispatchEvent(
                    new StorageEvent('storage', {
                      key: 'bolt_user_profile',
                      newValue: JSON.stringify(updatedProfile),
                    }),
                  );

                  toast.success(`Notifications ${checked ? 'activées' : 'désactivées'}`);
                }}
              />
            </div>
          </SettingsItem>
        </div>
      </SettingsSection> */}

      {/* Sound Settings */}
      <SettingsSection icon="i-ph:speaker-high-fill" title="Paramètres sonores" delay={0.15}>
        {/* Basic Sound Settings */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Sound Selection */}
          <SettingsItem icon="i-ph:music-notes-fill" label="Type de son">
            <select
              value={selectedSound}
              onChange={(e) => handleSoundChange(e.target.value)}
              className={classNames(
                'w-full px-4 py-3 rounded-lg text-sm',
                'bg-white dark:bg-[#0A0A0A]',
                'border border-gray-200 dark:border-gray-800',
                'text-bolt-elements-textPrimary',
                'focus:outline-none focus:ring-2 focus:ring-violet-500/30',
                'transition-all duration-200',
              )}
            >
              <option value={NOTIFICATION_SOUNDS.BOLT}>Neurocode (Par défaut)</option>
              <option value={NOTIFICATION_SOUNDS.CHIME}>Carillon</option>
              <option value={NOTIFICATION_SOUNDS.ALERT}>Alerte</option>
            </select>
          </SettingsItem>

          {/* Volume Control */}
          <SettingsItem icon="i-ph:speaker-simple-fill" label="Volume">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={chatSoundVolume}
                onChange={(e) => setChatSoundVolume(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <span className="text-sm font-medium text-bolt-elements-textSecondary min-w-[48px] text-center">
                {Math.round(chatSoundVolume * 100)}%
              </span>
              <button
                onClick={playTestSound}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
              >
                Tester
              </button>
            </div>
          </SettingsItem>
        </div>

        {/* Sound Toggles */}
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {/* Chat End Sound Settings */}
          <SettingsItem icon="i-ph:bell-simple-fill" label="Son de fin de discussion">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bolt-elements-textSecondary">
                {chatSoundEnabled ? 'Notification sonore activée' : 'Notification sonore désactivée'}
              </span>
              <Switch
                checked={chatSoundEnabled}
                onCheckedChange={(checked) => {
                  setChatSoundEnabled(checked);
                  toast.success(`Son de discussion ${checked ? 'activé' : 'désactivé'}`);
                }}
              />
            </div>
          </SettingsItem>

          {/* Alert Sound Settings */}
          <SettingsItem icon="i-ph:warning-fill" label="Son d'alerte">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bolt-elements-textSecondary">
                {alertSoundEnabled ? 'Alertes sonores activées' : 'Alertes sonores désactivées'}
              </span>
              <Switch
                checked={alertSoundEnabled}
                onCheckedChange={(checked) => {
                  setAlertSoundEnabled(checked);
                  toast.success(`Alertes sonores ${checked ? 'activées' : 'désactivées'}`);
                }}
              />
            </div>
          </SettingsItem>
        </div>
      </SettingsSection>

      {/* Fuseau horaire */}
      <SettingsSection icon="i-ph:clock-fill" title="Paramètres horaires" delay={0.3}>
        <SettingsItem icon="i-ph:globe-fill" label="Fuseau horaire">
          <select
            value={settings.timezone}
            onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
            className={classNames(
              'w-full px-4 py-3 rounded-lg text-sm',
              'bg-white dark:bg-[#0A0A0A]',
              'border border-gray-200 dark:border-gray-800',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-2 focus:ring-violet-500/30',
              'transition-all duration-200',
            )}
          >
            <option value={currentTimezone}>{currentTimezone}</option>
          </select>
        </SettingsItem>
      </SettingsSection>

      {/* Raccourcis clavier simplifiés */}
      <SettingsSection icon="i-ph:keyboard-fill" title="Raccourcis clavier" delay={0.35}>
        <div className="bg-gray-50 dark:bg-[#111111] rounded-xl p-5 transition-all hover:bg-gray-100 dark:hover:bg-[#151515]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="i-ph:palette-fill w-5 h-5 text-violet-500" />
              <div>
                <p className="text-sm font-medium text-bolt-elements-textPrimary">Changer de thème</p>
                <p className="text-xs text-bolt-elements-textSecondary mt-1">Basculer entre le mode clair et sombre</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 sm:mt-0">
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-gray-800 rounded shadow-sm">
                {getModifierSymbol('meta')}
              </kbd>
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-gray-800 rounded shadow-sm">
                {getModifierSymbol('alt')}
              </kbd>
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-gray-800 rounded shadow-sm">
                {getModifierSymbol('shift')}
              </kbd>
              <kbd className="px-2 py-1 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-gray-800 rounded shadow-sm">
                D
              </kbd>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
