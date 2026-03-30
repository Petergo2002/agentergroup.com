'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useAppContext } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/ToastProvider';
import { buildAgentPayload, buildInitialDefinition } from '@/lib/agents/defaults';
import type { AgentSurface } from '@/lib/types';
import { hasInternalAssistantsEnabled } from '@/lib/assistants/feature-flags';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSurface?: AgentSurface;
}

export const CreateAgentModal = ({
  isOpen,
  onClose,
  initialSurface = 'widget',
}: CreateAgentModalProps) => {
  const router = useRouter();
  const supabase = createClient();
  const { workspace, user } = useAppContext();
  const { showToast } = useToast();
  const internalAssistantsEnabled = hasInternalAssistantsEnabled(workspace);
  const [name, setName] = useState('');
  const [surface, setSurface] = useState<AgentSurface>(initialSurface);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSurface(
        initialSurface === 'assistant' && !internalAssistantsEnabled
          ? 'widget'
          : initialSurface,
      );
    }
  }, [initialSurface, internalAssistantsEnabled, isOpen]);

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Please enter an agent name.', 'info');
      return;
    }

    if (surface === 'assistant' && !internalAssistantsEnabled) {
      showToast('Internal assistants are disabled for this workspace.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const agentPayload = buildAgentPayload('custom', name, surface);
      const definition = buildInitialDefinition('custom');

      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          ...agentPayload,
        })
        .select()
        .single();

      if (agentError || !agent) {
        throw agentError ?? new Error('Failed to create agent.');
      }

      const { error: draftError } = await supabase.from('agent_drafts').insert({
        agent_id: agent.id,
        workspace_id: workspace.id,
        updated_by: user.id,
        definition,
      });

      if (draftError) {
        throw draftError;
      }

      showToast('Agent created.', 'success');
      onClose();
      setName('');
      setSurface('widget');
      router.push(`/agents/${agent.id}/builder`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create the agent.';
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Agent">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary">
              Surface
            </label>
            <div className={`grid gap-3 ${internalAssistantsEnabled ? 'sm:grid-cols-2' : ''}`}>
              {internalAssistantsEnabled ? (
                <button
                  type="button"
                  onClick={() => setSurface('assistant')}
                  className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                    surface === 'assistant'
                      ? 'border-primary bg-primary/5 text-on-surface'
                      : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <p className="text-sm font-bold text-on-surface">Internal Assistant</p>
                  <p className="mt-1 text-xs leading-5">
                    Shared inside the workspace and available in Assistants after the first save.
                  </p>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSurface('widget')}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  surface === 'widget'
                    ? 'border-primary bg-primary/5 text-on-surface'
                    : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <p className="text-sm font-bold text-on-surface">Website Widget</p>
                <p className="mt-1 text-xs leading-5">
                  Built for hosted and embeddable customer-facing chat surfaces.
                </p>
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-secondary uppercase tracking-widest block mb-2">
              {surface === 'assistant' ? 'Assistant Name' : 'Agent Name'}
            </label>
            <input 
              type="text" 
              placeholder={surface === 'assistant' ? 'e.g. Sales Assistant' : 'e.g. My Custom Agent'}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>

        <div className="pt-2 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={isSaving}
            className="flex-1 px-4 py-3 signature-gradient text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            {isSaving ? 'Creating...' : surface === 'assistant' ? 'Create Assistant' : 'Create Agent'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
