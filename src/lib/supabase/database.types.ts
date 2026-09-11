export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_automation_activation_intents: {
        Row: {
          actor_id: string
          agent_id: string
          automation_id: string
          completed_at: string | null
          created_at: string
          generation: number
          lease_expires_at: string | null
          lease_token: string | null
          provider_trigger_created: boolean | null
          provider_trigger_id: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actor_id: string
          agent_id: string
          automation_id: string
          completed_at?: string | null
          created_at?: string
          generation?: number
          lease_expires_at?: string | null
          lease_token?: string | null
          provider_trigger_created?: boolean | null
          provider_trigger_id?: string | null
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actor_id?: string
          agent_id?: string
          automation_id?: string
          completed_at?: string | null
          created_at?: string
          generation?: number
          lease_expires_at?: string | null
          lease_token?: string | null
          provider_trigger_created?: boolean | null
          provider_trigger_id?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      agent_automation_provider_outbox: {
        Row: {
          agent_id: string
          attempt_count: number
          automation_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          desired_state: string
          generation: number
          id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          operation: string
          provider: string
          provider_trigger_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          attempt_count?: number
          automation_id: string
          available_at?: string
          completed_at?: string | null
          created_at?: string
          desired_state: string
          generation?: number
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          operation: string
          provider: string
          provider_trigger_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          attempt_count?: number
          automation_id?: string
          available_at?: string
          completed_at?: string | null
          created_at?: string
          desired_state?: string
          generation?: number
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          operation?: string
          provider?: string
          provider_trigger_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      agent_automations: {
        Row: {
          agent_id: string
          composio_trigger_id: string | null
          connection_id: string | null
          created_at: string
          id: string
          last_error: string | null
          last_event_at: string | null
          provider: string
          status: string
          toolkit_slug: string
          trigger_config: Json
          trigger_slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          composio_trigger_id?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_event_at?: string | null
          provider?: string
          status?: string
          toolkit_slug?: string
          trigger_config?: Json
          trigger_slug?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          composio_trigger_id?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_event_at?: string | null
          provider?: string
          status?: string
          toolkit_slug?: string
          trigger_config?: Json
          trigger_slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_automations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_automations_agent_workspace_fkey"
            columns: ["agent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "agent_automations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_channels: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string
          delivery_state: string
          id: string
          kind: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by: string
          delivery_state?: string
          id?: string
          kind: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string
          delivery_state?: string
          id?: string
          kind?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_channels_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_channels_agent_workspace_fkey"
            columns: ["agent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "agent_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_connections: {
        Row: {
          agent_id: string
          connection_id: string
          created_at: string
          id: string
        }
        Insert: {
          agent_id: string
          connection_id: string
          created_at?: string
          id?: string
        }
        Update: {
          agent_id?: string
          connection_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_connections_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_drafts: {
        Row: {
          agent_id: string
          created_at: string
          definition: Json
          id: string
          updated_at: string
          updated_by: string
          version: number
          workspace_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          definition?: Json
          id?: string
          updated_at?: string
          updated_by: string
          version?: number
          workspace_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          definition?: Json
          id?: string
          updated_at?: string
          updated_by?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_drafts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_drafts_agent_workspace_fkey"
            columns: ["agent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "agent_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_folders: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          knowledge_folder_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          knowledge_folder_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          knowledge_folder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_folders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_folders_knowledge_folder_id_fkey"
            columns: ["knowledge_folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_sources: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          knowledge_source_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          knowledge_source_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          knowledge_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_sources_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_sources_knowledge_source_id_fkey"
            columns: ["knowledge_source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_library_template_sources: {
        Row: {
          content_text: string
          created_at: string
          file_size_bytes: number | null
          id: string
          metadata: Json
          mime_type: string | null
          original_source_id: string | null
          original_source_type: string
          source_description: string
          source_name: string
          template_id: string
        }
        Insert: {
          content_text: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_source_id?: string | null
          original_source_type: string
          source_description?: string
          source_name: string
          template_id: string
        }
        Update: {
          content_text?: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_source_id?: string | null
          original_source_type?: string
          source_description?: string
          source_name?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_library_template_sources_original_source_id_fkey"
            columns: ["original_source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_library_template_sources_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agent_library_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_library_templates: {
        Row: {
          approved_at: string | null
          created_at: string
          definition: Json
          description: string
          id: string
          instructions: string
          kind: string | null
          knowledge_source_count: number
          model: string
          name: string
          rejected_at: string | null
          rejection_reason: string | null
          required_integrations: string[]
          reviewed_by: string | null
          slug: string
          source_agent_id: string | null
          source_workspace_id: string
          starter_prompts: string[]
          status: string
          submitted_by: string
          surface: string
          template_variables: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          definition?: Json
          description?: string
          id?: string
          instructions?: string
          kind?: string | null
          knowledge_source_count?: number
          model: string
          name: string
          rejected_at?: string | null
          rejection_reason?: string | null
          required_integrations?: string[]
          reviewed_by?: string | null
          slug: string
          source_agent_id?: string | null
          source_workspace_id: string
          starter_prompts?: string[]
          status?: string
          submitted_by: string
          surface?: string
          template_variables?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          definition?: Json
          description?: string
          id?: string
          instructions?: string
          kind?: string | null
          knowledge_source_count?: number
          model?: string
          name?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          required_integrations?: string[]
          reviewed_by?: string | null
          slug?: string
          source_agent_id?: string | null
          source_workspace_id?: string
          starter_prompts?: string[]
          status?: string
          submitted_by?: string
          surface?: string
          template_variables?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_library_templates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_library_templates_source_agent_id_fkey"
            columns: ["source_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_library_templates_source_workspace_id_fkey"
            columns: ["source_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_library_templates_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_site_assets: {
        Row: {
          agent_id: string
          asset_kind: string
          created_at: string
          created_by: string
          id: string
          mime_type: string
          size_bytes: number
          storage_object_id: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          asset_kind: string
          created_at?: string
          created_by: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_object_id: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          asset_kind?: string
          created_at?: string
          created_by?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_object_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_site_assets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_site_assets_agent_workspace_fkey"
            columns: ["agent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "agent_site_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_site_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_site_drafts: {
        Row: {
          agent_id: string
          channel_id: string
          created_at: string
          created_by: string
          display_name: string
          human_contact_label: string | null
          human_contact_type: string
          human_contact_value: string | null
          id: string
          locale: string
          logo_asset_id: string | null
          primary_color: string
          public_key: string
          revision: number
          secondary_color: string
          slug: string
          starter_prompts: string[]
          theme: string
          updated_at: string
          updated_by: string
          welcome_heading: string
          welcome_message: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          channel_id: string
          created_at?: string
          created_by: string
          display_name: string
          human_contact_label?: string | null
          human_contact_type?: string
          human_contact_value?: string | null
          id?: string
          locale?: string
          logo_asset_id?: string | null
          primary_color?: string
          public_key?: string
          revision?: number
          secondary_color?: string
          slug: string
          starter_prompts?: string[]
          theme?: string
          updated_at?: string
          updated_by: string
          welcome_heading?: string
          welcome_message?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          channel_id?: string
          created_at?: string
          created_by?: string
          display_name?: string
          human_contact_label?: string | null
          human_contact_type?: string
          human_contact_value?: string | null
          id?: string
          locale?: string
          logo_asset_id?: string | null
          primary_color?: string
          public_key?: string
          revision?: number
          secondary_color?: string
          slug?: string
          starter_prompts?: string[]
          theme?: string
          updated_at?: string
          updated_by?: string
          welcome_heading?: string
          welcome_message?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_site_drafts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_site_drafts_agent_workspace_fkey"
            columns: ["agent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "agent_site_drafts_channel_identity_fkey"
            columns: ["channel_id", "workspace_id", "agent_id"]
            isOneToOne: false
            referencedRelation: "agent_channels"
            referencedColumns: ["id", "workspace_id", "agent_id"]
          },
          {
            foreignKeyName: "agent_site_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_site_drafts_logo_identity_fkey"
            columns: ["logo_asset_id", "workspace_id", "agent_id"]
            isOneToOne: false
            referencedRelation: "agent_site_assets"
            referencedColumns: ["id", "workspace_id", "agent_id"]
          },
          {
            foreignKeyName: "agent_site_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_site_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          agent_id: string
          created_at: string
          definition: Json
          id: string
          published_by: string
          version: number
          workspace_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          definition?: Json
          id?: string
          published_by: string
          version: number
          workspace_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          definition?: Json
          id?: string
          published_by?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_versions_agent_workspace_fkey"
            columns: ["agent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "agent_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          instructions: string
          kind: string | null
          model: string
          name: string
          published_version_id: string | null
          slug: string
          starter_prompts: string[]
          status: string
          surface: string
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          instructions?: string
          kind?: string | null
          model?: string
          name: string
          published_version_id?: string | null
          slug: string
          starter_prompts?: string[]
          status?: string
          surface?: string
          timezone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          instructions?: string
          kind?: string | null
          model?: string
          name?: string
          published_version_id?: string | null
          slug?: string
          starter_prompts?: string[]
          status?: string
          surface?: string
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_published_version_id_fkey"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_published_version_identity_fkey"
            columns: ["published_version_id", "id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id", "agent_id", "workspace_id"]
          },
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          agent_id: string | null
          created_at: string
          id: string
          metadata: Json
          run_id: string | null
          summary: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          agent_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          run_id?: string | null
          summary: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          agent_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          run_id?: string | null
          summary?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          agent_id: string
          automation_id: string
          created_at: string
          external_event_id: string
          id: string
          payload: Json
          run_id: string | null
          status: string
          trigger_slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          automation_id: string
          created_at?: string
          external_event_id: string
          id?: string
          payload?: Json
          run_id?: string | null
          status?: string
          trigger_slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          automation_id?: string
          created_at?: string
          external_event_id?: string
          id?: string
          payload?: Json
          run_id?: string | null
          status?: string
          trigger_slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "agent_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          active_turn_request_id: string | null
          active_turn_started_at: string | null
          agent_id: string
          created_at: string
          created_by: string
          id: string
          source: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active_turn_request_id?: string | null
          active_turn_started_at?: string | null
          agent_id: string
          created_at?: string
          created_by: string
          id?: string
          source?: string
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active_turn_request_id?: string | null
          active_turn_started_at?: string | null
          agent_id?: string
          created_at?: string
          created_by?: string
          id?: string
          source?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_auth_links: {
        Row: {
          completed_connection_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          status: string
          token_hash: string
          toolkit_slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_connection_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          status?: string
          token_hash: string
          toolkit_slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_connection_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          status?: string
          token_hash?: string
          toolkit_slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_auth_links_completed_connection_id_fkey"
            columns: ["completed_connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_auth_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_auth_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          account_label: string
          created_at: string
          created_by: string
          display_name: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          provider: string
          status: string
          toolkit_data: Json
          toolkit_slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_label?: string
          created_at?: string
          created_by: string
          display_name: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: string
          toolkit_data?: Json
          toolkit_slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_label?: string
          created_at?: string
          created_by?: string
          display_name?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: string
          toolkit_data?: Json
          toolkit_slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_conversation_summaries: {
        Row: {
          active_agent_id: string | null
          active_widget_agent_id: string | null
          assistant_message_count: number
          first_seen_at: string
          last_activity_at: string
          latest_snippet: string | null
          lead_count: number
          lead_email: string | null
          lead_name: string | null
          lead_phone: string | null
          message_count: number
          page_url: string | null
          referrer: string | null
          search_text: string | null
          session_id: string
          source: string
          status: string
          updated_at: string
          user_message_count: number
          widget_id: string
          widget_session_id: string
          workspace_id: string
        }
        Insert: {
          active_agent_id?: string | null
          active_widget_agent_id?: string | null
          assistant_message_count?: number
          first_seen_at: string
          last_activity_at: string
          latest_snippet?: string | null
          lead_count?: number
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          message_count?: number
          page_url?: string | null
          referrer?: string | null
          search_text?: string | null
          session_id: string
          source: string
          status: string
          updated_at?: string
          user_message_count?: number
          widget_id: string
          widget_session_id: string
          workspace_id: string
        }
        Update: {
          active_agent_id?: string | null
          active_widget_agent_id?: string | null
          assistant_message_count?: number
          first_seen_at?: string
          last_activity_at?: string
          latest_snippet?: string | null
          lead_count?: number
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          message_count?: number
          page_url?: string | null
          referrer?: string | null
          search_text?: string | null
          session_id?: string
          source?: string
          status?: string
          updated_at?: string
          user_message_count?: number
          widget_id?: string
          widget_session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_conversation_summaries_active_agent_id_fkey"
            columns: ["active_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_conversation_summaries_active_widget_agent_id_fkey"
            columns: ["active_widget_agent_id"]
            isOneToOne: false
            referencedRelation: "widget_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_conversation_summaries_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_conversation_summaries_widget_session_id_fkey"
            columns: ["widget_session_id"]
            isOneToOne: true
            referencedRelation: "widget_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_conversation_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_length: number
          created_at: string
          embedding: string
          id: string
          metadata: Json
          source_id: string
          widget_session_id: string | null
          workspace_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          content_length: number
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json
          source_id: string
          widget_session_id?: string | null
          workspace_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_length?: number
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json
          source_id?: string
          widget_session_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_folder_sources: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          knowledge_source_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          knowledge_source_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          knowledge_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_folder_sources_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_folder_sources_knowledge_source_id_fkey"
            columns: ["knowledge_source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_folders: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          metadata: Json
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          chunk_count: number
          created_at: string
          created_by: string
          description: string
          error_message: string | null
          file_size_bytes: number | null
          id: string
          last_processed_at: string | null
          metadata: Json
          mime_type: string | null
          name: string
          processing_expires_at: string | null
          processing_token: string | null
          raw_text: string | null
          source_type: string
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          widget_session_id: string | null
          workspace_id: string
        }
        Insert: {
          chunk_count?: number
          created_at?: string
          created_by: string
          description?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          last_processed_at?: string | null
          metadata?: Json
          mime_type?: string | null
          name: string
          processing_expires_at?: string | null
          processing_token?: string | null
          raw_text?: string | null
          source_type: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          widget_session_id?: string | null
          workspace_id: string
        }
        Update: {
          chunk_count?: number
          created_at?: string
          created_by?: string
          description?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          last_processed_at?: string | null
          metadata?: Json
          mime_type?: string | null
          name?: string
          processing_expires_at?: string | null
          processing_token?: string | null
          raw_text?: string | null
          source_type?: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          widget_session_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversation_summaries: {
        Row: {
          created_at: string
          error_message: string | null
          generated_at: string | null
          lead_id: string
          model: string | null
          source_hash: string | null
          source_last_message_at: string | null
          source_message_count: number
          status: string
          summary: Json | null
          updated_at: string
          widget_session_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          lead_id: string
          model?: string | null
          source_hash?: string | null
          source_last_message_at?: string | null
          source_message_count?: number
          status?: string
          summary?: Json | null
          updated_at?: string
          widget_session_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          lead_id?: string
          model?: string | null
          source_hash?: string | null
          source_last_message_at?: string | null
          source_message_count?: number
          status?: string
          summary?: Json | null
          updated_at?: string
          widget_session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversation_summaries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "widget_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_summaries_widget_session_id_fkey"
            columns: ["widget_session_id"]
            isOneToOne: false
            referencedRelation: "widget_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_widget_deployments: {
        Row: {
          agent_id: string
          allowed_origins: string[]
          background_color: string
          brand_name: string
          contact_form_settings: Json
          created_at: string
          deployed_at: string | null
          greeting: string
          id: string
          interaction_mode: string
          logo_url: string | null
          placeholder: string
          primary_color: string
          privacy_policy_url: string | null
          published_version_id: string | null
          quick_actions: Json
          show_branding: boolean
          status: string
          text_color: string
          theme: string
          updated_at: string
          widget_public_key: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          allowed_origins?: string[]
          background_color?: string
          brand_name: string
          contact_form_settings?: Json
          created_at?: string
          deployed_at?: string | null
          greeting?: string
          id?: string
          interaction_mode?: string
          logo_url?: string | null
          placeholder?: string
          primary_color?: string
          privacy_policy_url?: string | null
          published_version_id?: string | null
          quick_actions?: Json
          show_branding?: boolean
          status?: string
          text_color?: string
          theme?: string
          updated_at?: string
          widget_public_key?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          allowed_origins?: string[]
          background_color?: string
          brand_name?: string
          contact_form_settings?: Json
          created_at?: string
          deployed_at?: string | null
          greeting?: string
          id?: string
          interaction_mode?: string
          logo_url?: string | null
          placeholder?: string
          primary_color?: string
          privacy_policy_url?: string | null
          published_version_id?: string | null
          quick_actions?: Json
          show_branding?: boolean
          status?: string
          text_color?: string
          theme?: string
          updated_at?: string
          widget_public_key?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_deployments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_deployments_published_version_id_fkey"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_deployments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_widget_leads: {
        Row: {
          created_at: string
          deployment_id: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          widget_session_id: string | null
        }
        Insert: {
          created_at?: string
          deployment_id: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          widget_session_id?: string | null
        }
        Update: {
          created_at?: string
          deployment_id?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          widget_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_leads_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "legacy_widget_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_leads_widget_session_id_fkey"
            columns: ["widget_session_id"]
            isOneToOne: false
            referencedRelation: "legacy_widget_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_widget_session_messages: {
        Row: {
          content: string
          created_at: string
          deployment_id: string
          id: string
          metadata: Json
          role: string
          widget_session_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          deployment_id: string
          id?: string
          metadata?: Json
          role: string
          widget_session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deployment_id?: string
          id?: string
          metadata?: Json
          role?: string
          widget_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_session_messages_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "legacy_widget_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_session_messages_widget_session_id_fkey"
            columns: ["widget_session_id"]
            isOneToOne: false
            referencedRelation: "legacy_widget_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_widget_sessions: {
        Row: {
          deployment_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          origin: string | null
          page_url: string | null
          referrer: string | null
          session_id: string
          source: string
        }
        Insert: {
          deployment_id: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          origin?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id: string
          source: string
        }
        Update: {
          deployment_id?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          origin?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_sessions_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "legacy_widget_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          role: string
          thread_id: string
          tool_call_id: string | null
          tool_name: string | null
          workspace_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          role: string
          thread_id: string
          tool_call_id?: string | null
          tool_name?: string | null
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          role?: string
          thread_id?: string
          tool_call_id?: string | null
          tool_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_windows: {
        Row: {
          created_at: string
          endpoint: string
          expires_at: string
          hit_count: number
          id: string
          scope_key: string
          scope_kind: string
          updated_at: string
          window_seconds: number
          window_started_at: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          expires_at: string
          hit_count?: number
          id?: string
          scope_key: string
          scope_kind: string
          updated_at?: string
          window_seconds: number
          window_started_at: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          expires_at?: string
          hit_count?: number
          id?: string
          scope_key?: string
          scope_kind?: string
          updated_at?: string
          window_seconds?: number
          window_started_at?: string
        }
        Relationships: []
      }
      run_approvals: {
        Row: {
          agent_id: string
          created_at: string
          detail: string | null
          id: string
          metadata: Json
          requested_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          status: string
          step_id: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          detail?: string | null
          id?: string
          metadata?: Json
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
          status?: string
          step_id?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          metadata?: Json
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
          status?: string
          step_id?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_approvals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_approvals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_approvals_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "run_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      run_steps: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          detail: string | null
          id: string
          payload: Json
          run_id: string
          started_at: string
          status: string
          step_key: string
          step_type: string
          title: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          payload?: Json
          run_id: string
          started_at?: string
          status?: string
          step_key: string
          step_type: string
          title: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          payload?: Json
          run_id?: string
          started_at?: string
          status?: string
          step_key?: string
          step_type?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_steps_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          input: Json
          model: string | null
          output: Json
          started_at: string
          status: string
          thread_id: string | null
          workspace_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          input?: Json
          model?: string | null
          output?: Json
          started_at?: string
          status?: string
          thread_id?: string | null
          workspace_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          input?: Json
          model?: string | null
          output?: Json
          started_at?: string
          status?: string
          thread_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          error_message: string | null
          event_created_at: number
          event_id: string
          event_type: string
          processed_at: string | null
          processing_status: string
          received_at: string
          updated_at: string
        }
        Insert: {
          error_message?: string | null
          event_created_at: number
          event_id: string
          event_type: string
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          updated_at?: string
        }
        Update: {
          error_message?: string | null
          event_created_at?: number
          event_id?: string
          event_type?: string
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      unanswered_queries: {
        Row: {
          agent_id: string
          assistant_answer: string
          assistant_message_id: string | null
          confidence: number
          context_excerpt: string
          created_at: string
          dedupe_hash: string
          detection_reason: string
          duplicate_of: string | null
          id: string
          metadata: Json
          question: string
          resolved_at: string | null
          status: string
          updated_at: string
          user_message_id: string | null
          widget_agent_id: string | null
          widget_id: string
          widget_session_id: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          assistant_answer?: string
          assistant_message_id?: string | null
          confidence?: number
          context_excerpt?: string
          created_at?: string
          dedupe_hash: string
          detection_reason?: string
          duplicate_of?: string | null
          id?: string
          metadata?: Json
          question: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_message_id?: string | null
          widget_agent_id?: string | null
          widget_id: string
          widget_session_id: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          assistant_answer?: string
          assistant_message_id?: string | null
          confidence?: number
          context_excerpt?: string
          created_at?: string
          dedupe_hash?: string
          detection_reason?: string
          duplicate_of?: string | null
          id?: string
          metadata?: Json
          question?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_message_id?: string | null
          widget_agent_id?: string | null
          widget_id?: string
          widget_session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unanswered_queries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_queries_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "widget_session_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_queries_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "unanswered_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_queries_user_message_id_fkey"
            columns: ["user_message_id"]
            isOneToOne: false
            referencedRelation: "widget_session_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_queries_widget_agent_id_fkey"
            columns: ["widget_agent_id"]
            isOneToOne: false
            referencedRelation: "widget_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_queries_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_queries_widget_session_id_fkey"
            columns: ["widget_session_id"]
            isOneToOne: false
            referencedRelation: "widget_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unanswered_queries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_legal_acceptances: {
        Row: {
          acceptance_method: string
          accepted_at: string
          id: string
          privacy_version: string
          recorded_at: string
          terms_version: string
          user_id: string
        }
        Insert: {
          acceptance_method: string
          accepted_at: string
          id?: string
          privacy_version: string
          recorded_at?: string
          terms_version: string
          user_id: string
        }
        Update: {
          acceptance_method?: string
          accepted_at?: string
          id?: string
          privacy_version?: string
          recorded_at?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      verified_facts: {
        Row: {
          agent_id: string
          answer: string
          created_at: string
          created_by: string
          id: string
          knowledge_source_id: string | null
          metadata: Json
          published_at: string | null
          question: string
          retired_at: string | null
          status: string
          unanswered_query_id: string | null
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          answer: string
          created_at?: string
          created_by: string
          id?: string
          knowledge_source_id?: string | null
          metadata?: Json
          published_at?: string | null
          question: string
          retired_at?: string | null
          status?: string
          unanswered_query_id?: string | null
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          answer?: string
          created_at?: string
          created_by?: string
          id?: string
          knowledge_source_id?: string | null
          metadata?: Json
          published_at?: string | null
          question?: string
          retired_at?: string | null
          status?: string
          unanswered_query_id?: string | null
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_facts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_facts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_facts_knowledge_source_id_fkey"
            columns: ["knowledge_source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_facts_unanswered_query_id_fkey"
            columns: ["unanswered_query_id"]
            isOneToOne: false
            referencedRelation: "unanswered_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_facts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_agents: {
        Row: {
          agent_id: string
          contact_form_settings: Json
          created_at: string
          description: string
          greeting: string
          icon: string | null
          id: string
          interaction_mode: string
          label: string
          placeholder: string
          published_version_id: string | null
          quick_actions: Json
          show_quick_actions: boolean
          sort_order: number
          updated_at: string
          widget_id: string
        }
        Insert: {
          agent_id: string
          contact_form_settings?: Json
          created_at?: string
          description?: string
          greeting?: string
          icon?: string | null
          id?: string
          interaction_mode?: string
          label: string
          placeholder?: string
          published_version_id?: string | null
          quick_actions?: Json
          show_quick_actions?: boolean
          sort_order?: number
          updated_at?: string
          widget_id: string
        }
        Update: {
          agent_id?: string
          contact_form_settings?: Json
          created_at?: string
          description?: string
          greeting?: string
          icon?: string | null
          id?: string
          interaction_mode?: string
          label?: string
          placeholder?: string
          published_version_id?: string | null
          quick_actions?: Json
          show_quick_actions?: boolean
          sort_order?: number
          updated_at?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_agents_published_version_id_fkey"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_agents_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_attachments: {
        Row: {
          created_at: string
          file_size_bytes: number
          id: string
          mime_type: string
          original_name: string
          storage_bucket: string
          storage_path: string
          widget_id: string
          widget_session_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_size_bytes: number
          id?: string
          mime_type: string
          original_name: string
          storage_bucket?: string
          storage_path: string
          widget_id: string
          widget_session_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          original_name?: string
          storage_bucket?: string
          storage_path?: string
          widget_id?: string
          widget_session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_attachments_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_attachments_widget_session_id_fkey"
            columns: ["widget_session_id"]
            isOneToOne: false
            referencedRelation: "widget_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_leads: {
        Row: {
          agent_id: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          widget_agent_id: string | null
          widget_id: string
          widget_session_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          widget_agent_id?: string | null
          widget_id: string
          widget_session_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          widget_agent_id?: string | null
          widget_id?: string
          widget_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_leads_widget_agent_id_fkey"
            columns: ["widget_agent_id"]
            isOneToOne: false
            referencedRelation: "widget_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_leads_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_leads_widget_session_id_fkey1"
            columns: ["widget_session_id"]
            isOneToOne: false
            referencedRelation: "widget_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_preview_drafts: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          payload: Json
          revision: string
          widget_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          payload?: Json
          revision: string
          widget_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          payload?: Json
          revision?: string
          widget_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_preview_drafts_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_preview_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_session_messages: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json
          role: string
          widget_agent_id: string | null
          widget_id: string
          widget_session_id: string
        }
        Insert: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          widget_agent_id?: string | null
          widget_id: string
          widget_session_id: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          widget_agent_id?: string | null
          widget_id?: string
          widget_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_session_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_session_messages_widget_agent_id_fkey"
            columns: ["widget_agent_id"]
            isOneToOne: false
            referencedRelation: "widget_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_session_messages_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_session_messages_widget_session_id_fkey1"
            columns: ["widget_session_id"]
            isOneToOne: false
            referencedRelation: "widget_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_sessions: {
        Row: {
          active_agent_id: string | null
          active_turn_request_id: string | null
          active_turn_started_at: string | null
          active_widget_agent_id: string | null
          conversation_title: string | null
          end_reason: string | null
          ended_at: string | null
          first_seen_at: string
          id: string
          last_assistant_message_at: string | null
          last_message_preview: string | null
          last_seen_at: string
          last_user_message_at: string | null
          origin: string | null
          page_url: string | null
          referrer: string | null
          session_id: string
          source: string
          status: string
          visitor_token_hash: string | null
          widget_id: string
        }
        Insert: {
          active_agent_id?: string | null
          active_turn_request_id?: string | null
          active_turn_started_at?: string | null
          active_widget_agent_id?: string | null
          conversation_title?: string | null
          end_reason?: string | null
          ended_at?: string | null
          first_seen_at?: string
          id?: string
          last_assistant_message_at?: string | null
          last_message_preview?: string | null
          last_seen_at?: string
          last_user_message_at?: string | null
          origin?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id: string
          source: string
          status?: string
          visitor_token_hash?: string | null
          widget_id: string
        }
        Update: {
          active_agent_id?: string | null
          active_turn_request_id?: string | null
          active_turn_started_at?: string | null
          active_widget_agent_id?: string | null
          conversation_title?: string | null
          end_reason?: string | null
          ended_at?: string | null
          first_seen_at?: string
          id?: string
          last_assistant_message_at?: string | null
          last_message_preview?: string | null
          last_seen_at?: string
          last_user_message_at?: string | null
          origin?: string | null
          page_url?: string | null
          referrer?: string | null
          session_id?: string
          source?: string
          status?: string
          visitor_token_hash?: string | null
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_sessions_active_agent_id_fkey"
            columns: ["active_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_sessions_active_widget_agent_id_fkey"
            columns: ["active_widget_agent_id"]
            isOneToOne: false
            referencedRelation: "widget_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_sessions_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      widgets: {
        Row: {
          allowed_origins: string[]
          background_color: string
          brand_name: string
          created_at: string
          deployed_at: string | null
          description: string
          home_subtitle: string | null
          home_title: string | null
          hosted_enabled: boolean
          id: string
          language: string
          logo_url: string | null
          name: string
          primary_color: string
          privacy_policy_url: string | null
          secondary_color: string
          show_branding: boolean
          slug: string
          status: string
          template: string
          text_color: string
          theme: string
          updated_at: string
          widget_public_key: string
          workspace_id: string
        }
        Insert: {
          allowed_origins?: string[]
          background_color?: string
          brand_name: string
          created_at?: string
          deployed_at?: string | null
          description?: string
          home_subtitle?: string | null
          home_title?: string | null
          hosted_enabled?: boolean
          id?: string
          language?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          privacy_policy_url?: string | null
          secondary_color?: string
          show_branding?: boolean
          slug: string
          status?: string
          template?: string
          text_color?: string
          theme?: string
          updated_at?: string
          widget_public_key?: string
          workspace_id: string
        }
        Update: {
          allowed_origins?: string[]
          background_color?: string
          brand_name?: string
          created_at?: string
          deployed_at?: string | null
          description?: string
          home_subtitle?: string | null
          home_title?: string | null
          hosted_enabled?: boolean
          id?: string
          language?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          privacy_policy_url?: string | null
          secondary_color?: string
          show_branding?: boolean
          slug?: string
          status?: string
          template?: string
          text_color?: string
          theme?: string
          updated_at?: string
          widget_public_key?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          agents_limit: number
          billing_cycle_end: string
          billing_cycle_start: string
          created_at: string
          id: string
          integrations_enabled: boolean
          messages_limit: number
          messages_used: number
          plan_tier: string
          storage_limit_bytes: number
          stripe_current_price_id: string | null
          stripe_customer_id: string | null
          stripe_last_event_created_at: number
          stripe_last_event_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agents_limit?: number
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          id?: string
          integrations_enabled?: boolean
          messages_limit?: number
          messages_used?: number
          plan_tier?: string
          storage_limit_bytes?: number
          stripe_current_price_id?: string | null
          stripe_customer_id?: string | null
          stripe_last_event_created_at?: number
          stripe_last_event_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agents_limit?: number
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          id?: string
          integrations_enabled?: boolean
          messages_limit?: number
          messages_used?: number
          plan_tier?: string
          storage_limit_bytes?: number
          stripe_current_price_id?: string | null
          stripe_customer_id?: string | null
          stripe_last_event_created_at?: number
          stripe_last_event_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          agent_site_private_preview_enabled: boolean
          automations_enabled: boolean
          created_at: string
          description: string | null
          id: string
          internal_assistants_enabled: boolean
          name: string
          onboarding_completed: boolean
          owner_id: string
          primary_customer_agent_id: string | null
          primary_widget_id: string | null
          product_experience: string
          slug: string
          updated_at: string
          website_agents_enabled: boolean
        }
        Insert: {
          agent_site_private_preview_enabled?: boolean
          automations_enabled?: boolean
          created_at?: string
          description?: string | null
          id?: string
          internal_assistants_enabled?: boolean
          name: string
          onboarding_completed?: boolean
          owner_id: string
          primary_customer_agent_id?: string | null
          primary_widget_id?: string | null
          product_experience?: string
          slug: string
          updated_at?: string
          website_agents_enabled?: boolean
        }
        Update: {
          agent_site_private_preview_enabled?: boolean
          automations_enabled?: boolean
          created_at?: string
          description?: string | null
          id?: string
          internal_assistants_enabled?: boolean
          name?: string
          onboarding_completed?: boolean
          owner_id?: string
          primary_customer_agent_id?: string | null
          primary_widget_id?: string | null
          product_experience?: string
          slug?: string
          updated_at?: string
          website_agents_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_primary_customer_agent_id_fkey"
            columns: ["primary_customer_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_primary_widget_id_fkey"
            columns: ["primary_widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_automation_provider_activation_v1: {
        Args: {
          p_actor_id: string
          p_agent_id: string
          p_automation_id: string
          p_generation: number
          p_lease_token: string
          p_provider_trigger_created: boolean
          p_provider_trigger_id: string
        }
        Returns: Json
      }
      acquire_chat_thread_turn_lock: {
        Args: {
          p_request_id: string
          p_stale_before: string
          p_started_at: string
          p_thread_id: string
        }
        Returns: {
          acquired: boolean
          active_turn_request_id: string
          active_turn_started_at: string
          source: string
          thread_id: string
        }[]
      }
      acquire_widget_session_turn_lock: {
        Args: {
          p_request_id: string
          p_session_id: string
          p_stale_before: string
          p_started_at: string
          p_widget_id: string
        }
        Returns: {
          acquired: boolean
          active_turn_request_id: string
          active_turn_started_at: string
          status: string
          widget_session_id: string
        }[]
      }
      apply_workspace_subscription_event: {
        Args: {
          p_agents_limit: number
          p_customer_id: string
          p_event_created_at: number
          p_event_id: string
          p_integrations_enabled: boolean
          p_messages_limit: number
          p_period_end: string
          p_period_start: string
          p_plan_tier: string
          p_price_id: string
          p_storage_limit_bytes: number
          p_subscription_id: string
          p_subscription_status: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      archive_agent_v1: {
        Args: {
          p_actor_id: string
          p_agent_id: string
          p_archived: boolean
          p_expected_agent_updated_at: string
        }
        Returns: Json
      }
      can_edit_agent: { Args: { p_agent_id: string }; Returns: boolean }
      cancel_automation_provider_activation_v1: {
        Args: { p_actor_id: string; p_agent_id: string }
        Returns: Json
      }
      checkpoint_knowledge_processing: {
        Args: {
          p_chunks: Json
          p_complete?: boolean
          p_revision: string
          p_source_id: string
          p_token: string
          p_total_chunks: number
        }
        Returns: undefined
      }
      claim_agent_automation_provider_outbox_v1: {
        Args: { p_limit: number; p_outbox_id: string }
        Returns: {
          agent_id: string
          attempt_count: number
          automation_id: string
          desired_state: string
          generation: number
          lease_expires_at: string
          lease_token: string
          operation: string
          outbox_id: string
          provider: string
          provider_trigger_id: string
          workspace_id: string
        }[]
      }
      claim_knowledge_processing: {
        Args: { p_source_id: string; p_token: string }
        Returns: boolean
      }
      cleanup_ephemeral_knowledge: { Args: never; Returns: undefined }
      close_stale_widget_sessions: {
        Args: { p_dry_run?: boolean; p_limit?: number; p_stale_after?: string }
        Returns: {
          completed_sessions: number
          cutoff_at: string
          matched_sessions: number
        }[]
      }
      complete_agent_automation_provider_outbox_v1: {
        Args: {
          p_error: string
          p_generation: number
          p_lease_token: string
          p_outbox_id: string
          p_succeeded: boolean
        }
        Returns: Json
      }
      confirm_automation_provider_cleanup_v1: {
        Args: { p_automation_id: string; p_provider_trigger_id: string }
        Returns: Json
      }
      consume_rate_limit_window: {
        Args: {
          p_endpoint: string
          p_limit: number
          p_now?: string
          p_scope_key: string
          p_scope_kind: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          expires_at: string
          hit_count: number
          limit_value: number
          remaining: number
          retry_after_seconds: number
          window_started_at: string
        }[]
      }
      create_agent_v1: {
        Args: {
          p_actor_id: string
          p_description?: string
          p_identity_kind: string
          p_initial_definition?: Json
          p_instructions?: string
          p_model?: string
          p_name: string
          p_request_id: string
          p_source?: string
          p_starter_prompts?: string[]
          p_template_id?: string
          p_timezone?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      finalize_automation_provider_activation_v1: {
        Args: {
          p_actor_id: string
          p_agent_id: string
          p_automation_id: string
          p_generation: number
          p_lease_token: string
          p_provider_trigger_created: boolean
          p_provider_trigger_id: string
        }
        Returns: Json
      }
      get_agent_automation_provider_outbox_health_v1: {
        Args: never
        Returns: Json
      }
      get_agent_product_bootstrap_v1: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      grant_workspace_extra_messages: {
        Args: { p_actor_id: string; p_amount: number; p_workspace_id: string }
        Returns: {
          granted_amount: number
          messages_limit: number
          messages_used: number
          workspace_id: string
        }[]
      }
      grant_workspace_purchased_messages: {
        Args: {
          p_actor_id: string
          p_stripe_session_id: string
          p_workspace_id: string
        }
        Returns: {
          already_granted: boolean
          granted_amount: number
          messages_limit: number
          messages_used: number
          workspace_id: string
        }[]
      }
      import_agent_library_template_v1: {
        Args: {
          p_actor_id: string
          p_identity_kind: string
          p_initial_definition?: Json
          p_request_id: string
          p_template_id: string
          p_template_updated_at: string
          p_variable_values?: Json
          p_workspace_id: string
        }
        Returns: Json
      }
      increment_workspace_message_usage: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { target_workspace: string }
        Returns: boolean
      }
      match_agent_knowledge_chunks:
        | {
            Args: {
              input_agent_id: string
              input_workspace_id: string
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              chunk_id: string
              chunk_index: number
              content: string
              metadata: Json
              similarity: number
              source_id: string
              source_name: string
            }[]
          }
        | {
            Args: {
              input_agent_id: string
              input_widget_session_id?: string
              input_workspace_id: string
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              chunk_id: string
              chunk_index: number
              content: string
              metadata: Json
              similarity: number
              source_id: string
              source_name: string
            }[]
          }
      match_agent_knowledge_chunks_scoped: {
        Args: {
          input_agent_id: string
          input_folder_ids: string[]
          input_source_ids: string[]
          input_widget_session_id?: string
          input_workspace_id: string
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          metadata: Json
          similarity: number
          source_id: string
          source_name: string
        }[]
      }
      prepare_automation_provider_activation_v1: {
        Args: { p_actor_id: string; p_agent_id: string }
        Returns: Json
      }
      provision_workspace_milo_v1: {
        Args: { p_actor_id: string; p_workspace_id: string }
        Returns: Json
      }
      prune_expired_rate_limit_windows: {
        Args: { p_expires_before?: string }
        Returns: number
      }
      publish_agent_version_v1: {
        Args: {
          p_agent_id: string
          p_definition: Json
          p_description: string
          p_expected_agent_updated_at: string
          p_instructions: string
          p_model: string
          p_name: string
          p_starter_prompts: string[]
        }
        Returns: Json
      }
      purge_agent_automation_v1: {
        Args: { p_actor_id: string; p_agent_id: string }
        Returns: Json
      }
      purge_agent_v1: {
        Args: { p_actor_id: string; p_agent_id: string }
        Returns: Json
      }
      release_chat_thread_turn_lock: {
        Args: { p_request_id: string; p_thread_id: string }
        Returns: boolean
      }
      release_widget_session_turn_lock: {
        Args: {
          p_request_id: string
          p_session_id: string
          p_widget_id: string
        }
        Returns: boolean
      }
      replace_agent_connections: {
        Args: { p_agent_id: string; p_connection_ids: string[] }
        Returns: undefined
      }
      replace_agent_knowledge_v1: {
        Args: {
          p_agent_id: string
          p_folder_ids: string[]
          p_source_ids: string[]
        }
        Returns: undefined
      }
      reserve_knowledge_source_storage: {
        Args: {
          p_size_bytes: number
          p_source_id: string
          p_workspace_id: string
        }
        Returns: {
          reserved_total_bytes: number
          storage_limit_bytes: number
        }[]
      }
      rollback_agent_v1: {
        Args: {
          p_actor_id: string
          p_agent_id: string
          p_expected_agent_updated_at: string
          p_expected_draft_version: number
          p_version_id: string
        }
        Returns: Json
      }
      save_agent_draft_v1: {
        Args: {
          p_agent_id: string
          p_connection_ids: string[]
          p_definition: Json
          p_description: string
          p_expected_agent_updated_at: string
          p_expected_draft_version: number
          p_instructions: string
          p_knowledge_folder_ids: string[]
          p_knowledge_source_ids: string[]
          p_model: string
          p_name: string
          p_starter_prompts: string[]
          p_surface: string
          p_timezone: string
        }
        Returns: Json
      }
      update_agent_site_draft_v1: {
        Args: {
          p_actor_id: string
          p_agent_id: string
          p_expected_revision: number
          p_patch: Json
        }
        Returns: {
          agent_id: string
          channel_id: string
          created_at: string
          created_by: string
          display_name: string
          human_contact_label: string | null
          human_contact_type: string
          human_contact_value: string | null
          id: string
          locale: string
          logo_asset_id: string | null
          primary_color: string
          public_key: string
          revision: number
          secondary_color: string
          slug: string
          starter_prompts: string[]
          theme: string
          updated_at: string
          updated_by: string
          welcome_heading: string
          welcome_message: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_site_drafts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_knowledge_source_text: {
        Args: {
          p_raw_text: string
          p_source_id: string
          p_workspace_id: string
        }
        Returns: {
          reserved_total_bytes: number
          source_size_bytes: number
          storage_limit_bytes: number
        }[]
      }
      workspace_internal_assistants_enabled: {
        Args: { target_workspace: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
