'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useAppContext } from '@/components/app/AppContext';
import { useToast } from '@/components/ui/ToastProvider';
import { buildAgentPayload, buildInitialDefinition } from '@/lib/agents/defaults';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateAgentModal = ({ isOpen, onClose }: CreateAgentModalProps) => {
  const router = useRouter();
  const supabase = createClient();
  const { workspace, user } = useAppContext();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Please enter an agent name.', 'info');
      return;
    }

    setIsSaving(true);

    try {
      const agentPayload = buildAgentPayload('custom', name);
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
            <label className="text-xs font-bold text-secondary uppercase tracking-widest block mb-2">
              Agent Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. My Custom Agent"
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
            {isSaving ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
