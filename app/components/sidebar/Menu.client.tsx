import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { SettingsButton } from '~/components/ui/SettingsButton';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { useSettings } from '~/lib/hooks/useSettings';
import { PromptLibrary } from '~/lib/common/prompt-library';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | { type: 'delete-multiple'; items: ChatHistoryItem[] } | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

 useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    
    // Clean up interval on unmount
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/50">
      <div className="h-4 w-4 i-lucide:clock opacity-80" />
      <div className="flex gap-2">
        <span>{dateTime.toLocaleDateString()}</span>
        <span>{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}

export const Menu = () => {
  const { contextOptimizationEnabled, enableContextOptimization, autoSelectTemplate, setAutoSelectTemplate, promptId, setPromptId } = useSettings();
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = useStore(profileStore);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteItems = useCallback(async (items: ChatHistoryItem[]) => {
    if (db) {
      try {
        await Promise.all(items.map((item) => deleteById(db!, item.id)));
        loadEntries();

        const currentChatId = chatId.get();
        if (items.some((item) => item.id === currentChatId)) {
          window.location.pathname = '/';
        }
      } catch (error) {
        toast.error('Failed to delete conversations');
        logger.error(error);
      }
    }
  }, []);

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();

    if (db) {
      deleteById(db, item.id)
        .then(() => {
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    }
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) {
        return;
      }

      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isSettingsOpen]);

  const handleDeleteClick = (event: React.UIEvent, item: ChatHistoryItem) => {
    if (isSelectionMode) {
      event.preventDefault();
      event.stopPropagation();
      const isSelected = selectedItems.includes(item.id);
      setSelectedItems(isSelected ? selectedItems.filter(id => id !== item.id) : [...selectedItems, item.id]);
      return;
    }

    event.preventDefault();
    setDialogContent({ type: 'delete', item });
  };

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setOpen(false);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedItems([]); // Clear selected items when exiting selection mode
    }
  };

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex selection-accent flex-col side-menu fixed top-0 h-full',
          'bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800/50',
          'shadow-sm text-sm',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="text-gray-900 dark:text-white font-medium"></div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 group">
              <span 
                className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[120px]"
                title={profile?.username || 'Invité'}
                aria-label={`Utilisateur: ${profile?.username || 'Invité'}`}
              >
                {profile?.username || 'Invité'}
              </span>
              <div 
                className="flex items-center justify-center w-[32px] h-[32px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-105"
                aria-hidden="true"
              >
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile?.username || 'User'}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="sync"
                  />
                ) : (
                  <div className="i-ph:user-fill text-lg" />
                )}
              </div>
            </div>
          </div>
        </div>
        <CurrentDateTime />
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <a
                href="/"
                className="flex gap-2 items-center bg-purple-50 dark:bg-purple-500/30 text-purple-700 dark:text-white hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-4 py-2 transition-colors"
              >
                <span className="text-sm font-medium">Nouvelle discussion</span>
              </a>
              <div className="flex gap-3">
                {isSelectionMode && list.length >= 2 && (
                  <>
                    <button
                      onClick={() => setSelectedItems(list.map(item => item.id))}
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
                      title="Sélectionner tout"
                    >
                      <span className="i-ph:check-square-offset-fill text-lg transform hover:scale-110 transition-transform" />
                    </button>
                    <button
                      onClick={() => setSelectedItems([])}
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
                      title="Effacer la sélection"
                    >
                      <span className="i-ph:selection-slash text-lg transform hover:scale-110 transition-transform" />
                    </button>
                  </>
                )}
                {list.length >= 2 && (
                  <button
                    onClick={toggleSelectionMode}
                    className={classNames(
                      'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md',
                      isSelectionMode
                        ? 'bg-purple-50 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/40'
                        : 'bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    title="Mode sélection multiple"
                  >
                    <span className="i-ph:check-square-duotone text-lg transform hover:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            </div>
            {isSelectionMode && selectedItems.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDialogContent({
                      type: 'delete-multiple',
                      items: list.filter(item => selectedItems.includes(item.id))
                    });
                  }}
                  className="flex-1 flex gap-2 items-center justify-center bg-red-500 dark:bg-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg px-4 py-2 transition-colors"
                >
                  <span className="inline-block text-white i-ph:trash h-4 w-4" />
                  <span className="text-sm text-white font-medium">Supprimer ({selectedItems.length})</span>
                </button>
                <button
                  onClick={() => {
                    const selectedChats = list.filter(item => selectedItems.includes(item.id));
                    selectedChats.forEach(chat => exportChat(chat.id));
                  }}
                  className="flex gap-2 items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-4 py-2 transition-colors"
                >
                  <span className="inline-block i-ph:export h-4 w-4" />
                  <span className="text-sm font-medium">Exporter</span>
                </button>
              </div>
            )}
            
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="i-lucide:search h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                className="w-full bg-gray-50 dark:bg-gray-900 relative pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-800"
                type="search"
                placeholder="Rechercher des discussions..."
                onChange={handleSearchChange}
                aria-label="Rechercher des chats"
              />
            </div>
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-sm font-medium px-4 py-2">Vos discussions</div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            {filteredList.length === 0 && (
              <div className="px-4 text-gray-500 dark:text-gray-400 text-sm">
                {list.length === 0 ? 'Aucune conversation antérieure' : 'Aucune correspondance trouvée'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-white dark:bg-gray-950 px-4 py-1">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        exportChat={exportChat}
                        onDelete={(event) => handleDeleteClick(event, item)}
                        onDuplicate={() => handleDuplicate(item.id)}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedItems.includes(item.id)}
                        onSelect={(id) => {
                          const isSelected = selectedItems.includes(id);
                          setSelectedItems(isSelected ? selectedItems.filter(itemId => itemId !== id) : [...selectedItems, id]);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {(dialogContent?.type === 'delete' || dialogContent?.type === 'delete-multiple') && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">
                        {dialogContent.type === 'delete' ? 'Supprimer la conversation ?' : 'Supprimer les conversations ?'}
                      </DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        {dialogContent.type === 'delete' ? (
                          <p>
                            Vous êtes sur le point de supprimer {' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {dialogContent.item.description}
                            </span>
                          </p>
                        ) : (
                          <p>
                            Vous êtes sur le point de supprimer {' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {dialogContent.items.length} conversations
                            </span>
                          </p>
                        )}
                        <p className="mt-2">
                          {dialogContent.type === 'delete' 
                            ? 'Êtes-vous sûr de vouloir supprimer cette discussion ?'
                            : 'Êtes-vous sûr de vouloir supprimer ces discussions ?'}
                        </p>
                      </DialogDescription>
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-white rounded-lg border border-red-200 dark:border-red-500/30">
                        ⚠️ Cette action est irréversible - toutes les données {dialogContent.type === 'delete' ? 'de la discussion' : 'des discussions'} seront définitivement perdues !
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Annuler
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          if (dialogContent.type === 'delete') {
                            deleteItem(event, dialogContent.item);
                          } else {
                            deleteItems(dialogContent.items);
                            setIsSelectionMode(false);
                            setSelectedItems([]);
                          }
                          closeDialog();
                        }}
                      >
                        Supprimer
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3">
            <SettingsButton onClick={handleSettingsClick} />
            <div className="flex items-center gap-3">
              <button
                onClick={() => enableContextOptimization(!contextOptimizationEnabled)}
                className={classNames(
                  'group relative flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
                  contextOptimizationEnabled
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'bg-gray-100 dark:bg-transparent text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary'
                )}
                title={`Optimisation du contexte ${contextOptimizationEnabled ? 'activée' : 'désactivée'}`}
              >
              <span className="i-ph-brain-duotone text-xl" />              
              </button>
              <div className="relative min-w-[140px] focus-within:ring-2 focus-within:ring-purple-400 rounded-lg transition-all"
                tabIndex={0}
              >
                <select
                  value={promptId}
                  onChange={(e) => setPromptId(e.target.value)}
                  className="appearance-none bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 text-gray-600 dark:text-gray-400 rounded-lg pl-2 pr-8 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer w-full"
                  aria-label="Prompt template selection"
                  title="Select a prompt template for your new conversation"
                  disabled={PromptLibrary.getList().length === 0}
                >
                  {PromptLibrary.getList().length === 0 ? (
                    <option value="">No templates available</option>
                  ) : (
                    PromptLibrary.getList().map((prompt) => (
                      <option key={prompt.id} value={prompt.id}>
                        {prompt.label}
                      </option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center h-full">
                  <span className="i-ph:caret-down h-4 w-4 text-gray-400" />
                </div>
              </div>
              <ThemeSwitch />
            </div>
          </div>
        </div>
      </motion.div>

      <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
