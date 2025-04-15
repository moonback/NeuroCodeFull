import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { IconButton } from '~/components/ui/IconButton';
import WithTooltip from '~/components/ui/Tooltip';
import { createScopedLogger } from '~/utils/logger';
import { formatSize } from '~/utils/formatSize';

const logger = createScopedLogger('EnhancedContextCacheManager');

interface CacheStats {
  size: number;
  maxSize: number;
  defaultExpiryMs: number;
  hits: number;
  misses: number;
  hitRatio: number;
  compressionEnabled: boolean;
  adaptiveExpiryEnabled: boolean;
  compressionRatio: number;
  averageAccessTime: number;
  totalAccessTime: number;
  accessCount: number;
  memoryMonitoringEnabled?: boolean;
  totalOriginalSize?: number;
  totalCompressedSize?: number;
  compressedEntries?: number;
  autoCompressionThreshold?: number;
}

interface EnhancedContextCacheManagerProps {
  className?: string;
}

export function EnhancedContextCacheManager({ className = '' }: EnhancedContextCacheManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [maxSizeInput, setMaxSizeInput] = useState('');
  const [expiryInput, setExpiryInput] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showPerformanceView, setShowPerformanceView] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsHistory, setStatsHistory] = useState<CacheStats[]>([]);

  // Fonction pour récupérer les statistiques du cache
  const fetchCacheStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhanced-context-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stats' }),
      });

      if (!response.ok) {
        throw new Error(`Erreur lors de la récupération des statistiques: ${response.status}`);
      }

      const data = await response.json();
      const newStats = (data as { stats: CacheStats }).stats;
      setStats(newStats);
      setStatsHistory(prev => [...prev.slice(-9), newStats]);
      setShowStats(true);
      logger.debug('Statistiques du cache récupérées avec succès', (data as { stats: CacheStats }).stats);
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques du cache', error);
      toast.error('Impossible de récupérer les statistiques du cache');
    } finally {
      setIsLoading(false);
    }
  };

  // Activer/désactiver le rafraîchissement automatique
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(fetchCacheStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  // Fonction pour vider le cache
  const clearCache = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhanced-context-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'clear' }),
      });

      if (!response.ok) {
        throw new Error(`Erreur lors du vidage du cache: ${response.status}`);
      }

      const data = await response.json();
      toast.success((data as { message?: string }).message || 'Cache vidé avec succès');
      logger.info('Cache vidé avec succès');
      
      // Mettre à jour les statistiques après avoir vidé le cache
      await fetchCacheStats();
    } catch (error) {
      logger.error('Erreur lors du vidage du cache', error);
      toast.error('Impossible de vider le cache');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour basculer la compression
  const toggleCompression = async (enabled: boolean) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhanced-context-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'toggle-compression',
          enabled
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur lors de la configuration de la compression: ${response.status}`);
      }

      const data = await response.json();
      toast.success((data as { message?: string }).message || `Compression ${enabled ? 'activée' : 'désactivée'} avec succès`);
      logger.info(`Compression ${enabled ? 'activée' : 'désactivée'} avec succès`);
      
      // Mettre à jour les statistiques après avoir modifié la configuration
      await fetchCacheStats();
    } catch (error) {
      logger.error('Erreur lors de la configuration de la compression', error);
      toast.error('Impossible de configurer la compression');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour basculer l'expiration adaptative
  const toggleAdaptiveExpiry = async (enabled: boolean) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhanced-context-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'toggle-adaptive-expiry',
          enabled
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur lors de la configuration de l'expiration adaptative: ${response.status}`);
      }

      const data = await response.json();
      toast.success((data as { message?: string }).message || `Expiration adaptative ${enabled ? 'activée' : 'désactivée'} avec succès`);
      logger.info(`Expiration adaptative ${enabled ? 'activée' : 'désactivée'} avec succès`);
      
      // Mettre à jour les statistiques après avoir modifié la configuration
      await fetchCacheStats();
    } catch (error) {
      logger.error('Erreur lors de la configuration de l\'expiration adaptative', error);
      toast.error('Impossible de configurer l\'expiration adaptative');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour configurer le cache
  const configureCache = async (maxSize?: number, expiryMs?: number) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhanced-context-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'configure',
          maxSize,
          expiryMs
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur lors de la configuration du cache: ${response.status}`);
      }

      const data = await response.json();
      toast.success((data as { message?: string }).message || 'Configuration du cache mise à jour avec succès');
      logger.info('Configuration du cache mise à jour avec succès');
      
      // Mettre à jour les statistiques après avoir modifié la configuration
      setStats((data as { stats: CacheStats }).stats);
    } catch (error) {
      logger.error('Erreur lors de la configuration du cache', error);
      toast.error('Impossible de configurer le cache');
    } finally {
      setIsLoading(false);
    }
  };

  // Formater la durée en secondes ou minutes
  const formatDuration = (ms: number) => {
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)} secondes`;
    }
    return `${(ms / 60000).toFixed(1)} minutes`;
  };

  // Formater la taille en KB ou MB
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'N/A';
    return formatSize(bytes);
  };

  // Fonction pour basculer la surveillance de la mémoire
  const toggleMemoryMonitoring = async (enabled: boolean) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhanced-context-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'toggle-memory-monitoring',
          enabled
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur lors de la configuration de la surveillance mémoire: ${response.status}`);
      }

      const data = await response.json();
      toast.success((data as { message?: string }).message || `Surveillance mémoire ${enabled ? 'activée' : 'désactivée'} avec succès`);
      logger.info(`Surveillance mémoire ${enabled ? 'activée' : 'désactivée'} avec succès`);
      
      // Mettre à jour les statistiques après avoir modifié la configuration
      await fetchCacheStats();
    } catch (error) {
      logger.error('Erreur lors de la configuration de la surveillance mémoire', error);
      toast.error('Impossible de configurer la surveillance mémoire');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour configurer le seuil de compression
  const setCompressionThreshold = async (threshold: number) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/enhanced-context-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'set-compression-threshold',
          threshold
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur lors de la configuration du seuil de compression: ${response.status}`);
      }

      const data = await response.json();
      toast.success((data as { message?: string }).message || `Seuil de compression configuré à ${formatBytes(threshold)}`);
      logger.info(`Seuil de compression configuré à ${threshold} bytes`);
      
      // Mettre à jour les statistiques après avoir modifié la configuration
      await fetchCacheStats();
    } catch (error) {
      logger.error('Erreur lors de la configuration du seuil de compression', error);
      toast.error('Impossible de configurer le seuil de compression');
    } finally {
      setIsLoading(false);
    }
  };

  // Rendu du mini-graphique de performance
  const renderPerformanceChart = () => {
    if (!statsHistory.length) return null;
    
    const maxHeight = 50; // hauteur maximale en pixels
    const width = 200; // largeur totale
    const barWidth = width / Math.max(statsHistory.length, 1);
    
    return (
      <div className="mt-3 border-t border-bolt-elements-borderColor pt-3">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Performance du cache</h4>
        <div className="flex justify-between text-xs text-bolt-elements-textSecondary mb-1">
          <span>Ratio de succès</span>
          <button 
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
            onClick={() => {
              if (refreshInterval) {
                setRefreshInterval(null);
                toast.info('Rafraîchissement automatique désactivé');
              } else {
                setRefreshInterval(5000); // 5 secondes
                toast.info('Rafraîchissement automatique activé (5s)');
                fetchCacheStats();
              }
            }}
          >
            {refreshInterval ? (
              <div className="i-ph:pause-circle text-amber-500"></div>
            ) : (
              <div className="i-ph:play-circle"></div>
            )}
          </button>
        </div>
        <div className="relative h-[50px] w-full bg-bolt-elements-background-depth-1 rounded overflow-hidden">
          {statsHistory.map((stat, index) => {
            const hitRatio = stat.hitRatio || 0;
            const barHeight = Math.max(1, hitRatio * maxHeight);
            return (
              <div 
                key={index}
                className="absolute bottom-0 bg-green-500 opacity-80"
                style={{
                  height: `${barHeight}px`,
                  width: `${barWidth}px`,
                  left: `${index * barWidth}px`,
                }}
                title={`Ratio: ${(hitRatio * 100).toFixed(1)}%`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-bolt-elements-textSecondary mt-1">
          <span>Temps d'accès</span>
        </div>
        <div className="relative h-[30px] w-full bg-bolt-elements-background-depth-1 rounded overflow-hidden">
          {statsHistory.map((stat, index) => {
            // Normaliser le temps d'accès (max 100ms pour une hauteur complète)
            const accessTime = stat.averageAccessTime || 0;
            const normalizedHeight = Math.min(1, accessTime / 100) * 30;
            const barHeight = Math.max(1, normalizedHeight);
            return (
              <div 
                key={index}
                className="absolute bottom-0 bg-blue-500 opacity-80"
                style={{
                  height: `${barHeight}px`,
                  width: `${barWidth}px`,
                  left: `${index * barWidth}px`,
                }}
                title={`Temps: ${accessTime.toFixed(2)}ms`}
              />
            );
          })}
        </div>
        {stats?.compressionEnabled && (
          <>
            <div className="flex justify-between text-xs text-bolt-elements-textSecondary mt-2">
              <span>Taux de compression</span>
            </div>
            <div className="relative h-[20px] w-full bg-bolt-elements-background-depth-1 rounded overflow-hidden">
              {statsHistory.map((stat, index) => {
                const compressionRatio = stat.compressionRatio || 0;
                const barHeight = Math.max(1, compressionRatio * 20);
                return (
                  <div 
                    key={index}
                    className="absolute bottom-0 bg-purple-500 opacity-80"
                    style={{
                      height: `${barHeight}px`,
                      width: `${barWidth}px`,
                      left: `${index * barWidth}px`,
                    }}
                    title={`Compression: ${(compressionRatio * 100).toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <WithTooltip tooltip="Gérer le cache de contexte">
        <IconButton
          title="Gérer le cache de contexte"
          onClick={fetchCacheStats}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
          ) : (
            <div className="i-ph:database text-xl"></div>
          )}
        </IconButton>
      </WithTooltip>

      {showStats && stats && (
        <div className="absolute bottom-20 right-4 bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor shadow-lg z-50 w-96">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Cache de Contexte</h3>
            <div className="flex gap-2">
              <IconButton 
                title="Performance" 
                onClick={() => setShowPerformanceView(!showPerformanceView)}
                className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
              >
                <div className="i-ph:chart-line text-lg"></div>
              </IconButton>
              <IconButton 
                title="Configurer" 
                onClick={() => setShowConfigForm(!showConfigForm)}
                className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
              >
                <div className="i-ph:gear text-lg"></div>
              </IconButton>
              <IconButton 
                title="Fermer" 
                onClick={() => setShowStats(false)}
                className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
              >
                <div className="i-ph:x text-lg"></div>
              </IconButton>
            </div>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Taille:</span>
              <span className="text-bolt-elements-textPrimary font-medium">{stats.size} / {stats.maxSize} entrées</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Expiration:</span>
              <span className="text-bolt-elements-textPrimary font-medium">{formatDuration(stats.defaultExpiryMs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Ratio de succès:</span>
              <span className="text-bolt-elements-textPrimary font-medium">{(stats.hitRatio * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Compression:</span>
              <span className="text-bolt-elements-textPrimary font-medium">
                {stats.compressionEnabled ? 'Activée' : 'Désactivée'} ({(stats.compressionRatio * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Expiration adaptative:</span>
              <span className="text-bolt-elements-textPrimary font-medium">
                {stats.adaptiveExpiryEnabled ? 'Activée' : 'Désactivée'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Temps d'accès moyen:</span>
              <span className="text-bolt-elements-textPrimary font-medium">{stats.averageAccessTime.toFixed(2)}ms</span>
            </div>
            {stats.totalOriginalSize !== undefined && (
              <div className="flex justify-between">
                <span className="text-bolt-elements-textSecondary">Taille des données:</span>
                <span className="text-bolt-elements-textPrimary font-medium">
                  {formatBytes(stats.totalCompressedSize || 0)} / {formatBytes(stats.totalOriginalSize || 0)}
                </span>
              </div>
            )}
            {stats.memoryMonitoringEnabled !== undefined && (
              <div className="flex justify-between">
                <span className="text-bolt-elements-textSecondary">Surveillance mémoire:</span>
                <span className="text-bolt-elements-textPrimary font-medium">
                  {stats.memoryMonitoringEnabled ? 'Activée' : 'Désactivée'}
                </span>
              </div>
            )}
          </div>
          
          {showPerformanceView && renderPerformanceChart()}
          
          {showConfigForm && (
            <div className="mb-4 p-3 bg-bolt-elements-background-depth-3 rounded-md">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Configuration avancée</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-bolt-elements-textSecondary block mb-1">Taille maximale du cache</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      className="flex-1 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded px-2 py-1 text-sm"
                      value={maxSizeInput}
                      onChange={(e) => setMaxSizeInput(e.target.value)}
                      placeholder={`${stats.maxSize}`}
                    />
                    <button 
                      className="px-2 py-1 bg-bolt-elements-button-primary text-white rounded-md text-xs"
                      onClick={() => {
                        const size = parseInt(maxSizeInput);
                        if (!isNaN(size) && size > 0) {
                          configureCache(size, undefined);
                          setMaxSizeInput('');
                        }
                      }}
                    >
                      Appliquer
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-bolt-elements-textSecondary block mb-1">Durée d'expiration (ms)</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      className="flex-1 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded px-2 py-1 text-sm"
                      value={expiryInput}
                      onChange={(e) => setExpiryInput(e.target.value)}
                      placeholder={`${stats.defaultExpiryMs}`}
                    />
                    <button 
                      className="px-2 py-1 bg-bolt-elements-button-primary text-white rounded-md text-xs"
                      onClick={() => {
                        const expiry = parseInt(expiryInput);
                        if (!isNaN(expiry) && expiry > 0) {
                          configureCache(undefined, expiry);
                          setExpiryInput('');
                        }
                      }}
                    >
                      Appliquer
                    </button>
                  </div>
                </div>
                {stats.autoCompressionThreshold !== undefined && (
                  <div>
                    <label className="text-xs text-bolt-elements-textSecondary block mb-1">Seuil de compression (bytes)</label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded px-2 py-1 text-sm"
                        onChange={(e) => {
                          const threshold = parseInt(e.target.value);
                          if (!isNaN(threshold)) {
                            setCompressionThreshold(threshold);
                          }
                        }}
                        defaultValue={stats.autoCompressionThreshold}
                      >
                        <option value="1024">1 KB</option>
                        <option value="5120">5 KB</option>
                        <option value="10240">10 KB</option>
                        <option value="51200">50 KB</option>
                        <option value="102400">100 KB</option>
                        <option value="512000">500 KB</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition-colors"
              onClick={clearCache}
              disabled={isLoading}
            >
              Vider le cache
            </button>
            <button
              className={`px-3 py-1 ${stats.compressionEnabled ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded-md text-sm transition-colors`}
              onClick={() => toggleCompression(!stats.compressionEnabled)}
              disabled={isLoading}
            >
              {stats.compressionEnabled ? 'Désactiver' : 'Activer'} compression
            </button>
            <button
              className={`px-3 py-1 ${stats.adaptiveExpiryEnabled ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded-md text-sm transition-colors`}
              onClick={() => toggleAdaptiveExpiry(!stats.adaptiveExpiryEnabled)}
              disabled={isLoading}
            >
              {stats.adaptiveExpiryEnabled ? 'Désactiver' : 'Activer'} expiration adaptative
            </button>
            {stats.memoryMonitoringEnabled !== undefined && (
              <button
                className={`px-3 py-1 ${stats.memoryMonitoringEnabled ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded-md text-sm transition-colors`}
                onClick={() => toggleMemoryMonitoring(!stats.memoryMonitoringEnabled)}
                disabled={isLoading}
              >
                {stats.memoryMonitoringEnabled ? 'Désactiver' : 'Activer'} surveillance mémoire
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
