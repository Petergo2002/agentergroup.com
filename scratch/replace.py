import re

with open("src/app/(app)/agents/[id]/builder/page.tsx", "r") as f:
    content = f.read()

# 1. Replace isNodeLibraryOpen -> isAddMenuOpen
content = content.replace(
    "const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);",
    "const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);"
)

# 2. Replace onPaneClick
content = content.replace(
    "onPaneClick={() => setSelectedNodeId(null)}",
    "onPaneClick={() => { setSelectedNodeId(null); setIsAddMenuOpen(false); }}"
)

# 3. Remove the left sidebar <aside>
# We can use regex to remove from <div className={`group absolute bottom-0 left-0 top-0 z-30 w-[22rem]
# to the matching closing div before <section
pattern_sidebar = re.compile(
    r'(<div\s+className={`group absolute bottom-0 left-0 top-0 z-30 w-\[22rem\].*?)\n\s*<section',
    re.DOTALL
)
content = re.sub(pattern_sidebar, r'<section', content)

# 4. Insert the bottom bar inside the section
bottom_bar_code = """
            </ReactFlow>

            {/* Bottom Floating Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
              {isAddMenuOpen && (
                <div className="mb-4 w-72 overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface/95 shadow-premium backdrop-blur-3xl p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1">
                    {nodeLibraryItems.map((item) => {
                      const isTriggerAdded = item.key === 'trigger' && hasTriggerNode;
                      const isAgentAdded = item.key === 'agent' && hasAgentNode;
                      const isKnowledgeAdded = item.key === 'knowledge' && hasKnowledgeNode;
                      const isEndChatAdded = item.key === 'endchat' && hasEndChatNode;
                      const isFixed = item.fixed;
                      const isDisabled =
                        isFixed ||
                        isTriggerAdded ||
                        isAgentAdded ||
                        isKnowledgeAdded ||
                        isEndChatAdded ||
                        item.disabled;

                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            if (item.disabled) {
                              showToast(t('settings.billing.featureLocked') || 'Please upgrade your plan to unlock this feature.', 'error');
                              return;
                            }
                            if (isFixed) return;
                            
                            if (item.key === 'trigger') handleAddTriggerNode();
                            else if (item.key === 'agent') handleAddAgentNode();
                            else if (item.key === 'knowledge') handleAddKnowledgeNode();
                            else if (item.key === 'endchat') handleAddEndChatNode();
                            else if (item.key === 'tools') setIsToolPickerOpen(true);
                            
                            setIsAddMenuOpen(false);
                          }}
                          disabled={isDisabled && !item.disabled}
                          className={`group/item flex items-center gap-3 rounded-2xl p-2.5 text-left transition-all duration-200 ${
                            item.disabled
                              ? 'opacity-50 grayscale cursor-not-allowed'
                              : isFixed
                              ? 'bg-surface-container-lowest/30'
                              : isDisabled
                              ? 'opacity-60 cursor-not-allowed'
                              : 'hover:bg-surface-container-low hover:text-primary active:scale-[0.98]'
                          }`}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                            item.disabled || isFixed || isDisabled 
                            ? 'bg-surface-container-high text-on-surface-variant/40' 
                            : 'bg-primary/10 text-primary group-hover/item:bg-primary group-hover/item:text-on-primary'
                          }`}>
                            <span className="material-symbols-outlined text-lg">
                              {item.icon}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-[13px] font-bold tracking-tight truncate ${
                                item.disabled || isFixed || isDisabled ? 'text-on-surface-variant' : 'text-on-surface'
                              }`}>
                                {item.label}
                              </p>
                              {item.disabled && (
                                <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">
                                  {t('common.locked')}
                                </span>
                              )}
                              {isFixed && !item.disabled && (
                                <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-on-surface-variant/60">
                                  {t('common.fixed')}
                                </span>
                              )}
                              {(isTriggerAdded || isAgentAdded || isKnowledgeAdded || isEndChatAdded) && !isFixed && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-primary">
                                  {t('common.added')}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] text-on-surface-variant/60 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className={`flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full shadow-premium transition-all duration-300 hover:scale-105 active:scale-95 ${
                  isAddMenuOpen ? 'bg-surface text-primary border border-outline-variant/20' : 'bg-primary text-on-primary hover:shadow-primary/20'
                }`}
                aria-label={t('agentBuilder.nodeLibraryTitle')}
              >
                <span className={`material-symbols-outlined text-2xl transition-transform duration-300 ${isAddMenuOpen ? 'rotate-45' : ''}`}>
                  add
                </span>
              </button>
            </div>
          </div>
"""

content = content.replace(
    '</ReactFlow>\n          </div>',
    bottom_bar_code
)

# 5. Fix <div className="h-full w-full"> to be relative
content = content.replace(
    '<div className="h-full w-full">\n            <ReactFlow',
    '<div className="relative h-full w-full">\n            <ReactFlow'
)

with open("src/app/(app)/agents/[id]/builder/page.tsx", "w") as f:
    f.write(content)
