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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_domain_group: string | null
          created_at: string
          created_from: string | null
          domain: string | null
          id: string
          name: string
          normalized_name: string | null
          org_id: string
        }
        Insert: {
          account_domain_group?: string | null
          created_at?: string
          created_from?: string | null
          domain?: string | null
          id?: string
          name: string
          normalized_name?: string | null
          org_id: string
        }
        Update: {
          account_domain_group?: string | null
          created_at?: string
          created_from?: string | null
          domain?: string | null
          id?: string
          name?: string
          normalized_name?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_context: {
        Row: {
          campaign_id: string
          committee_size_declared: number | null
          competitive_situation: string | null
          crm_stage: string | null
          decision_structure: string | null
          decision_window: string | null
          id: string
          incumbent_present: boolean | null
          incumbent_type: string | null
          key_contacts: Json | null
          motion_type: string | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          committee_size_declared?: number | null
          competitive_situation?: string | null
          crm_stage?: string | null
          decision_structure?: string | null
          decision_window?: string | null
          id?: string
          incumbent_present?: boolean | null
          incumbent_type?: string | null
          key_contacts?: Json | null
          motion_type?: string | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          committee_size_declared?: number | null
          competitive_situation?: string | null
          crm_stage?: string | null
          decision_structure?: string | null
          decision_window?: string | null
          id?: string
          incumbent_present?: boolean | null
          incumbent_type?: string | null
          key_contacts?: Json | null
          motion_type?: string | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_context_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          campaign_id: string
          context_snapshot: Json | null
          created_at: string
          feedback: string | null
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          context_snapshot?: Json | null
          created_at?: string
          feedback?: string | null
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          context_snapshot?: Json | null
          created_at?: string
          feedback?: string | null
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approval_token: string | null
          approval_type: string
          assigned_to_user_id: string | null
          campaign_id: string
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          decision_comment: string | null
          id: string
          org_id: string
          requested_by_user_id: string | null
          script_snapshot: string | null
          slack_metadata: Json | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approval_token?: string | null
          approval_type?: string
          assigned_to_user_id?: string | null
          campaign_id: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_comment?: string | null
          id?: string
          org_id: string
          requested_by_user_id?: string | null
          script_snapshot?: string | null
          slack_metadata?: Json | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approval_token?: string | null
          approval_type?: string
          assigned_to_user_id?: string | null
          campaign_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_comment?: string | null
          id?: string
          org_id?: string
          requested_by_user_id?: string | null
          script_snapshot?: string | null
          slack_metadata?: Json | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_deliveries: {
        Row: {
          asset_id: string
          campaign_id: string
          created_at: string
          delivery_token: string
          id: string
          intended_contact_id: string | null
          sent_at: string | null
          share_mode: string | null
        }
        Insert: {
          asset_id: string
          campaign_id: string
          created_at?: string
          delivery_token: string
          id?: string
          intended_contact_id?: string | null
          sent_at?: string | null
          share_mode?: string | null
        }
        Update: {
          asset_id?: string
          campaign_id?: string
          created_at?: string
          delivery_token?: string
          id?: string
          intended_contact_id?: string | null
          sent_at?: string | null
          share_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_deliveries_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "deal_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_page_events: {
        Row: {
          asset_id: string
          campaign_id: string
          created_at: string
          event_hash: string | null
          id: string
          identity_cluster_id: string | null
          max_scroll_pct: number | null
          page_number: number | null
          time_spent_seconds: number | null
          viewer_id: string | null
        }
        Insert: {
          asset_id: string
          campaign_id: string
          created_at?: string
          event_hash?: string | null
          id?: string
          identity_cluster_id?: string | null
          max_scroll_pct?: number | null
          page_number?: number | null
          time_spent_seconds?: number | null
          viewer_id?: string | null
        }
        Update: {
          asset_id?: string
          campaign_id?: string
          created_at?: string
          event_hash?: string | null
          id?: string
          identity_cluster_id?: string | null
          max_scroll_pct?: number | null
          page_number?: number | null
          time_spent_seconds?: number | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_page_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "deal_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_page_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_page_events_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "viewers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: Database["public"]["Enums"]["audit_event_type"]
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          org_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: Database["public"]["Enums"]["audit_event_type"]
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: Database["public"]["Enums"]["audit_event_type"]
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          committee_size_declared: number | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          crm_stage: string | null
          deal_experience_mode: string | null
          deal_identity_status: string | null
          deal_owner_id: string | null
          deal_risk_level: string | null
          deal_risk_override: boolean | null
          deal_status: string | null
          deal_value: number | null
          deleted_at: string | null
          description: string | null
          first_action_completed_at: string | null
          first_outcome_detected_at: string | null
          first_signal_at: string | null
          id: string
          identity_id: string | null
          is_self_campaign: boolean | null
          metadata: Json | null
          name: string
          org_id: string
          parent_campaign_id: string | null
          scheduled_at: string | null
          script: string
          script_oral: string | null
          script_oral_generated_at: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          committee_size_declared?: number | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          crm_stage?: string | null
          deal_experience_mode?: string | null
          deal_identity_status?: string | null
          deal_owner_id?: string | null
          deal_risk_level?: string | null
          deal_risk_override?: boolean | null
          deal_status?: string | null
          deal_value?: number | null
          deleted_at?: string | null
          description?: string | null
          first_action_completed_at?: string | null
          first_outcome_detected_at?: string | null
          first_signal_at?: string | null
          id?: string
          identity_id?: string | null
          is_self_campaign?: boolean | null
          metadata?: Json | null
          name: string
          org_id: string
          parent_campaign_id?: string | null
          scheduled_at?: string | null
          script: string
          script_oral?: string | null
          script_oral_generated_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          committee_size_declared?: number | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          crm_stage?: string | null
          deal_experience_mode?: string | null
          deal_identity_status?: string | null
          deal_owner_id?: string | null
          deal_risk_level?: string | null
          deal_risk_override?: boolean | null
          deal_status?: string | null
          deal_value?: number | null
          deleted_at?: string | null
          description?: string | null
          first_action_completed_at?: string | null
          first_outcome_detected_at?: string | null
          first_signal_at?: string | null
          id?: string
          identity_id?: string | null
          is_self_campaign?: boolean | null
          metadata?: Json | null
          name?: string
          org_id?: string
          parent_campaign_id?: string | null
          scheduled_at?: string | null
          script?: string
          script_oral?: string | null
          script_oral_generated_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_parent_campaign_id_fkey"
            columns: ["parent_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_signals: {
        Row: {
          action_taken: string | null
          detected_at: string
          id: string
          org_id: string
          resolved_at: string | null
          risk_level: string
          signal_type: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          detected_at?: string
          id?: string
          org_id: string
          resolved_at?: string | null
          risk_level: string
          signal_type: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          detected_at?: string
          id?: string
          org_id?: string
          resolved_at?: string | null
          risk_level?: string
          signal_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "churn_signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_layers: {
        Row: {
          asset_affinity: string[] | null
          expected_weight: number
          layer: string
          level: string
          typical_titles: string[] | null
        }
        Insert: {
          asset_affinity?: string[] | null
          expected_weight: number
          layer: string
          level: string
          typical_titles?: string[] | null
        }
        Update: {
          asset_affinity?: string[] | null
          expected_weight?: number
          layer?: string
          level?: string
          typical_titles?: string[] | null
        }
        Relationships: []
      }
      deal_assets: {
        Row: {
          asset_hash: string | null
          asset_purpose: string
          asset_status: string | null
          asset_type: string
          campaign_id: string
          created_at: string
          deleted_at: string | null
          file_url: string | null
          id: string
          parent_asset_id: string | null
          tracked_links: Json | null
          version_number: number | null
        }
        Insert: {
          asset_hash?: string | null
          asset_purpose: string
          asset_status?: string | null
          asset_type: string
          campaign_id: string
          created_at?: string
          deleted_at?: string | null
          file_url?: string | null
          id?: string
          parent_asset_id?: string | null
          tracked_links?: Json | null
          version_number?: number | null
        }
        Update: {
          asset_hash?: string | null
          asset_purpose?: string
          asset_status?: string | null
          asset_type?: string
          campaign_id?: string
          created_at?: string
          deleted_at?: string | null
          file_url?: string | null
          id?: string
          parent_asset_id?: string | null
          tracked_links?: Json | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_assets_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "deal_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contact_roles: {
        Row: {
          campaign_id: string
          confidence: number | null
          created_at: string
          deleted_at: string | null
          id: string
          identity_cluster_id: string | null
          insight_reasons: Json | null
          layer: string | null
          role: string | null
          source: string | null
          viewer_id: string | null
        }
        Insert: {
          campaign_id: string
          confidence?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          identity_cluster_id?: string | null
          insight_reasons?: Json | null
          layer?: string | null
          role?: string | null
          source?: string | null
          viewer_id?: string | null
        }
        Update: {
          campaign_id?: string
          confidence?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          identity_cluster_id?: string | null
          insight_reasons?: Json | null
          layer?: string | null
          role?: string | null
          source?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contact_roles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contact_roles_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "viewers"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contradictions: {
        Row: {
          campaign_id: string | null
          contradiction_id: string
          detected_at: string | null
          id: string
          is_active: boolean | null
          message: string
          org_id: string | null
          resolved_at: string | null
          severity: string
          signal_a: string | null
          signal_b: string | null
        }
        Insert: {
          campaign_id?: string | null
          contradiction_id: string
          detected_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          org_id?: string | null
          resolved_at?: string | null
          severity: string
          signal_a?: string | null
          signal_b?: string | null
        }
        Update: {
          campaign_id?: string | null
          contradiction_id?: string
          detected_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          org_id?: string | null
          resolved_at?: string | null
          severity?: string
          signal_a?: string | null
          signal_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contradictions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contradictions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_outcomes: {
        Row: {
          calibration_weight: number | null
          campaign_id: string
          created_at: string
          final_des: number | null
          final_patterns: Json | null
          id: string
          notes: string | null
          outcome: string
          outcome_at: string | null
        }
        Insert: {
          calibration_weight?: number | null
          campaign_id: string
          created_at?: string
          final_des?: number | null
          final_patterns?: Json | null
          id?: string
          notes?: string | null
          outcome: string
          outcome_at?: string | null
        }
        Update: {
          calibration_weight?: number | null
          campaign_id?: string
          created_at?: string
          final_des?: number | null
          final_patterns?: Json | null
          id?: string
          notes?: string | null
          outcome?: string
          outcome_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_outcomes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_permissions: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_permissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_rooms: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_public: boolean | null
          slug: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          slug?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_rooms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_scores: {
        Row: {
          alerts: Json | null
          avg_watch_depth: number | null
          blocker_count: number | null
          breadth: number | null
          campaign_id: string
          cold_start_regime: string | null
          confidence_level: string | null
          created_at: string
          days_since_last_signal: number | null
          des: number | null
          engagement_half_life: number | null
          event_velocity: number | null
          graph_centralization: number | null
          id: string
          layer_coverage: Json | null
          metadata: Json | null
          momentum: string | null
          multi_threading_score: number | null
          priority_deal_score: number | null
          priority_score: number | null
          recommended_action: Json | null
          recommended_action_v2: Json | null
          risk_level: string | null
          scored_at: string
          signal_coverage: number | null
          sponsor_count: number | null
          stage_signal_gap: number | null
          trajectory: string | null
          viewer_count: number | null
        }
        Insert: {
          alerts?: Json | null
          avg_watch_depth?: number | null
          blocker_count?: number | null
          breadth?: number | null
          campaign_id: string
          cold_start_regime?: string | null
          confidence_level?: string | null
          created_at?: string
          days_since_last_signal?: number | null
          des?: number | null
          engagement_half_life?: number | null
          event_velocity?: number | null
          graph_centralization?: number | null
          id?: string
          layer_coverage?: Json | null
          metadata?: Json | null
          momentum?: string | null
          multi_threading_score?: number | null
          priority_deal_score?: number | null
          priority_score?: number | null
          recommended_action?: Json | null
          recommended_action_v2?: Json | null
          risk_level?: string | null
          scored_at?: string
          signal_coverage?: number | null
          sponsor_count?: number | null
          stage_signal_gap?: number | null
          trajectory?: string | null
          viewer_count?: number | null
        }
        Update: {
          alerts?: Json | null
          avg_watch_depth?: number | null
          blocker_count?: number | null
          breadth?: number | null
          campaign_id?: string
          cold_start_regime?: string | null
          confidence_level?: string | null
          created_at?: string
          days_since_last_signal?: number | null
          des?: number | null
          engagement_half_life?: number | null
          event_velocity?: number | null
          graph_centralization?: number | null
          id?: string
          layer_coverage?: Json | null
          metadata?: Json | null
          momentum?: string | null
          multi_threading_score?: number | null
          priority_deal_score?: number | null
          priority_score?: number | null
          recommended_action?: Json | null
          recommended_action_v2?: Json | null
          risk_level?: string | null
          scored_at?: string
          signal_coverage?: number | null
          sponsor_count?: number | null
          stage_signal_gap?: number | null
          trajectory?: string | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_scores_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_signals: {
        Row: {
          campaign_id: string | null
          confidence: number | null
          created_at: string | null
          id: string
          interpretation: string | null
          org_id: string | null
          raw_data: Json | null
          signal_layer: string
          signal_type: string
        }
        Insert: {
          campaign_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          interpretation?: string | null
          org_id?: string | null
          raw_data?: Json | null
          signal_layer: string
          signal_type: string
        }
        Update: {
          campaign_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          interpretation?: string | null
          org_id?: string | null
          raw_data?: Json | null
          signal_layer?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_signals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_triggers: {
        Row: {
          acted_on_at: string | null
          campaign_id: string
          created_at: string
          delivered_at: string | null
          id: string
          message_action: string | null
          message_what: string | null
          message_why: string | null
          owner_type: string
          priority_score: number | null
          trigger_type: string
        }
        Insert: {
          acted_on_at?: string | null
          campaign_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          message_action?: string | null
          message_what?: string | null
          message_why?: string | null
          owner_type?: string
          priority_score?: number | null
          trigger_type: string
        }
        Update: {
          acted_on_at?: string | null
          campaign_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          message_action?: string | null
          message_what?: string | null
          message_why?: string | null
          owner_type?: string
          priority_score?: number | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_triggers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_actions: {
        Row: {
          action_type: string
          created_at: string
          executed_at: string | null
          executed_from: string | null
          execution_token: string
          guardrail_status: string | null
          id: string
          trigger_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          executed_at?: string | null
          executed_from?: string | null
          execution_token: string
          guardrail_status?: string | null
          id?: string
          trigger_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          executed_at?: string | null
          executed_from?: string | null
          execution_token?: string
          guardrail_status?: string | null
          id?: string
          trigger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_actions_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "deal_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      identities: {
        Row: {
          clone_status: string | null
          consent_given: boolean | null
          consent_given_at: string | null
          created_at: string
          display_name: string
          id: string
          is_shareable: boolean | null
          metadata: Json | null
          org_id: string
          owner_user_id: string | null
          provider_id: string | null
          provider_identity_id: string | null
          reference_video_duration: number | null
          reference_video_path: string | null
          status: Database["public"]["Enums"]["identity_status"]
          type: Database["public"]["Enums"]["identity_type"]
          updated_at: string
        }
        Insert: {
          clone_status?: string | null
          consent_given?: boolean | null
          consent_given_at?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_shareable?: boolean | null
          metadata?: Json | null
          org_id: string
          owner_user_id?: string | null
          provider_id?: string | null
          provider_identity_id?: string | null
          reference_video_duration?: number | null
          reference_video_path?: string | null
          status?: Database["public"]["Enums"]["identity_status"]
          type?: Database["public"]["Enums"]["identity_type"]
          updated_at?: string
        }
        Update: {
          clone_status?: string | null
          consent_given?: boolean | null
          consent_given_at?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_shareable?: boolean | null
          metadata?: Json | null
          org_id?: string
          owner_user_id?: string | null
          provider_id?: string | null
          provider_identity_id?: string | null
          reference_video_duration?: number | null
          reference_video_path?: string | null
          status?: Database["public"]["Enums"]["identity_status"]
          type?: Database["public"]["Enums"]["identity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          org_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          org_id: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          org_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          joined_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          feature_flags: Json | null
          id: string
          is_demo_org: boolean | null
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_flags?: Json | null
          id?: string
          is_demo_org?: boolean | null
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_flags?: Json | null
          id?: string
          is_demo_org?: boolean | null
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          allow_self_approval_for_owners: boolean | null
          approval_required: boolean | null
          created_at: string
          id: string
          identities_shareable: boolean | null
          link_expiration_days: number | null
          max_videos_per_campaign: number | null
          org_id: string
          updated_at: string
          watermark_required: boolean | null
        }
        Insert: {
          allow_self_approval_for_owners?: boolean | null
          approval_required?: boolean | null
          created_at?: string
          id?: string
          identities_shareable?: boolean | null
          link_expiration_days?: number | null
          max_videos_per_campaign?: number | null
          org_id: string
          updated_at?: string
          watermark_required?: boolean | null
        }
        Update: {
          allow_self_approval_for_owners?: boolean | null
          approval_required?: boolean | null
          created_at?: string
          id?: string
          identities_shareable?: boolean | null
          link_expiration_days?: number | null
          max_videos_per_campaign?: number | null
          org_id?: string
          updated_at?: string
          watermark_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          default_identity_id: string | null
          email: string
          first_name: string | null
          id: string
          is_approved: boolean
          last_name: string | null
          notification_channels: string[] | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          default_identity_id?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_approved?: boolean
          last_name?: string | null
          notification_channels?: string[] | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          default_identity_id?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_approved?: boolean
          last_name?: string | null
          notification_channels?: string[] | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_identity_id_fkey"
            columns: ["default_identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          provider_type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          provider_type?: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          provider_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      recipients: {
        Row: {
          campaign_id: string
          company: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          org_id: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          campaign_id: string
          company?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          campaign_id?: string
          company?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_outcomes: {
        Row: {
          action_taken: string | null
          campaign_id: string
          confidence_at_rec: number | null
          created_at: string
          id: string
          metadata: Json | null
          outcome_30d: string | null
          outcome_7d: string | null
          recommended_action: string
          taken_at: string | null
        }
        Insert: {
          action_taken?: string | null
          campaign_id: string
          confidence_at_rec?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome_30d?: string | null
          outcome_7d?: string | null
          recommended_action: string
          taken_at?: string | null
        }
        Update: {
          action_taken?: string | null
          campaign_id?: string
          confidence_at_rec?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome_30d?: string | null
          outcome_7d?: string | null
          recommended_action?: string
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_outcomes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_calibration_profile: {
        Row: {
          active_profile: string | null
          calibration_confidence: number | null
          declared_profile: Json | null
          initial_hypothesis: Json | null
          observed_profile: Json | null
          org_id: string
          updated_at: string
        }
        Insert: {
          active_profile?: string | null
          calibration_confidence?: number | null
          declared_profile?: Json | null
          initial_hypothesis?: Json | null
          observed_profile?: Json | null
          org_id: string
          updated_at?: string
        }
        Update: {
          active_profile?: string | null
          calibration_confidence?: number | null
          declared_profile?: Json | null
          initial_hypothesis?: Json | null
          observed_profile?: Json | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_calibration_profile_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      script_versions: {
        Row: {
          campaign_id: string
          change_reason: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          org_id: string
          rejection_comment: string | null
          script: string
          version_number: number
        }
        Insert: {
          campaign_id: string
          change_reason?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          org_id: string
          rejection_comment?: string | null
          script: string
          version_number?: number
        }
        Update: {
          campaign_id?: string
          change_reason?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          org_id?: string
          rejection_comment?: string | null
          script?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "script_versions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_failures: {
        Row: {
          campaign_id: string | null
          detected_at: string
          failure_type: string
          id: string
          message: string
          reason: string | null
          resolved_at: string | null
          severity: string | null
          ui_message: string | null
        }
        Insert: {
          campaign_id?: string | null
          detected_at?: string
          failure_type: string
          id?: string
          message: string
          reason?: string | null
          resolved_at?: string | null
          severity?: string | null
          ui_message?: string | null
        }
        Update: {
          campaign_id?: string | null
          detected_at?: string
          failure_type?: string
          id?: string
          message?: string
          reason?: string | null
          resolved_at?: string | null
          severity?: string | null
          ui_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_failures_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          script_template: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          script_template?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          script_template?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          asset_id: string | null
          campaign_id: string
          created_at: string
          event_data: Json | null
          event_layer: string | null
          event_type: string
          id: string
          identity_cluster_id: string | null
          viewer_id: string | null
        }
        Insert: {
          asset_id?: string | null
          campaign_id: string
          created_at?: string
          event_data?: Json | null
          event_layer?: string | null
          event_type: string
          id?: string
          identity_cluster_id?: string | null
          viewer_id?: string | null
        }
        Update: {
          asset_id?: string | null
          campaign_id?: string
          created_at?: string
          event_data?: Json | null
          event_layer?: string | null
          event_type?: string
          id?: string
          identity_cluster_id?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "viewers"
            referencedColumns: ["id"]
          },
        ]
      }
      video_access_list: {
        Row: {
          access_type: string
          campaign_id: string
          created_at: string
          created_by_user_id: string | null
          domain: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          org_id: string
          title: string | null
        }
        Insert: {
          access_type?: string
          campaign_id: string
          created_at?: string
          created_by_user_id?: string | null
          domain?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id: string
          title?: string | null
        }
        Update: {
          access_type?: string
          campaign_id?: string
          created_at?: string
          created_by_user_id?: string | null
          domain?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_access_list_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_access_list_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      video_events: {
        Row: {
          campaign_id: string
          created_at: string
          device_type: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_country: string | null
          position_sec: number | null
          referred_by_hash: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          video_id: string
          viewer_domain: string | null
          viewer_email: string | null
          viewer_hash: string
          viewer_name: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          device_type?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_country?: string | null
          position_sec?: number | null
          referred_by_hash?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          video_id: string
          viewer_domain?: string | null
          viewer_email?: string | null
          viewer_hash: string
          viewer_name?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          device_type?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_country?: string | null
          position_sec?: number | null
          referred_by_hash?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          video_id?: string
          viewer_domain?: string | null
          viewer_email?: string | null
          viewer_hash?: string
          viewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_jobs: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          identity_id: string
          org_id: string
          provider_id: string | null
          provider_job_id: string | null
          recipient_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["video_job_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          identity_id: string
          org_id: string
          provider_id?: string | null
          provider_job_id?: string | null
          recipient_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["video_job_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          identity_id?: string
          org_id?: string
          provider_id?: string | null
          provider_job_id?: string | null
          recipient_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["video_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_jobs_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_jobs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_jobs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      video_reactions: {
        Row: {
          campaign_id: string
          comment: string | null
          created_at: string
          emoji: string | null
          id: string
          reaction_type: string
          video_id: string
          viewer_email: string | null
          viewer_hash: string
          viewer_name: string | null
        }
        Insert: {
          campaign_id: string
          comment?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          reaction_type?: string
          video_id: string
          viewer_email?: string | null
          viewer_hash: string
          viewer_name?: string | null
        }
        Update: {
          campaign_id?: string
          comment?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          reaction_type?: string
          video_id?: string
          viewer_email?: string | null
          viewer_hash?: string
          viewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_reactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_reactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          campaign_id: string
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          file_size_bytes: number | null
          first_viewed_at: string | null
          id: string
          is_active: boolean | null
          last_viewed_at: string | null
          metadata: Json | null
          org_id: string
          recipient_id: string
          share_token: string
          storage_path: string
          updated_at: string
          video_job_id: string
          view_count: number | null
          watermark_enabled: boolean | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          first_viewed_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          metadata?: Json | null
          org_id: string
          recipient_id: string
          share_token?: string
          storage_path: string
          updated_at?: string
          video_job_id: string
          view_count?: number | null
          watermark_enabled?: boolean | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          first_viewed_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          metadata?: Json | null
          org_id?: string
          recipient_id?: string
          share_token?: string
          storage_path?: string
          updated_at?: string
          video_job_id?: string
          view_count?: number | null
          watermark_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_video_job_id_fkey"
            columns: ["video_job_id"]
            isOneToOne: false
            referencedRelation: "video_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      view_events: {
        Row: {
          country_code: string | null
          id: string
          referer: string | null
          referred_by_hash: string | null
          user_agent: string | null
          video_id: string
          viewed_at: string
          viewer_email: string | null
          viewer_hash: string
          viewer_name: string | null
        }
        Insert: {
          country_code?: string | null
          id?: string
          referer?: string | null
          referred_by_hash?: string | null
          user_agent?: string | null
          video_id: string
          viewed_at?: string
          viewer_email?: string | null
          viewer_hash: string
          viewer_name?: string | null
        }
        Update: {
          country_code?: string | null
          id?: string
          referer?: string | null
          referred_by_hash?: string | null
          user_agent?: string | null
          video_id?: string
          viewed_at?: string
          viewer_email?: string | null
          viewer_hash?: string
          viewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      viewer_relationships: {
        Row: {
          campaign_id: string
          created_at: string
          evidence: Json | null
          forward_probability: number | null
          id: string
          relationship_type: string | null
          source_viewer_id: string
          target_viewer_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          evidence?: Json | null
          forward_probability?: number | null
          id?: string
          relationship_type?: string | null
          source_viewer_id: string
          target_viewer_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          evidence?: Json | null
          forward_probability?: number | null
          id?: string
          relationship_type?: string | null
          source_viewer_id?: string
          target_viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewer_relationships_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewer_relationships_source_viewer_id_fkey"
            columns: ["source_viewer_id"]
            isOneToOne: false
            referencedRelation: "viewers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewer_relationships_target_viewer_id_fkey"
            columns: ["target_viewer_id"]
            isOneToOne: false
            referencedRelation: "viewers"
            referencedColumns: ["id"]
          },
        ]
      }
      viewers: {
        Row: {
          blocker_score: number | null
          campaign_id: string
          company: string | null
          contact_score: number | null
          contact_type: string | null
          created_at: string
          cta_clicked: boolean | null
          domain: string | null
          email: string | null
          fingerprint: string | null
          first_seen_at: string | null
          id: string
          identity_cluster_id: string | null
          identity_confidence: string | null
          inferred_role: string | null
          influence_score: number | null
          is_known: boolean | null
          last_event_at: string | null
          last_signal_at: string | null
          last_signal_type: string | null
          metadata: Json | null
          name: string | null
          replay_count: number | null
          role_confidence: number | null
          share_count: number | null
          sponsor_score: number | null
          status: string | null
          title: string | null
          total_watch_depth: number | null
          updated_at: string
          via_viewer_id: string | null
          viewer_hash: string
          viewers_generated: number | null
        }
        Insert: {
          blocker_score?: number | null
          campaign_id: string
          company?: string | null
          contact_score?: number | null
          contact_type?: string | null
          created_at?: string
          cta_clicked?: boolean | null
          domain?: string | null
          email?: string | null
          fingerprint?: string | null
          first_seen_at?: string | null
          id?: string
          identity_cluster_id?: string | null
          identity_confidence?: string | null
          inferred_role?: string | null
          influence_score?: number | null
          is_known?: boolean | null
          last_event_at?: string | null
          last_signal_at?: string | null
          last_signal_type?: string | null
          metadata?: Json | null
          name?: string | null
          replay_count?: number | null
          role_confidence?: number | null
          share_count?: number | null
          sponsor_score?: number | null
          status?: string | null
          title?: string | null
          total_watch_depth?: number | null
          updated_at?: string
          via_viewer_id?: string | null
          viewer_hash: string
          viewers_generated?: number | null
        }
        Update: {
          blocker_score?: number | null
          campaign_id?: string
          company?: string | null
          contact_score?: number | null
          contact_type?: string | null
          created_at?: string
          cta_clicked?: boolean | null
          domain?: string | null
          email?: string | null
          fingerprint?: string | null
          first_seen_at?: string | null
          id?: string
          identity_cluster_id?: string | null
          identity_confidence?: string | null
          inferred_role?: string | null
          influence_score?: number | null
          is_known?: boolean | null
          last_event_at?: string | null
          last_signal_at?: string | null
          last_signal_type?: string | null
          metadata?: Json | null
          name?: string | null
          replay_count?: number | null
          role_confidence?: number | null
          share_count?: number | null
          sponsor_score?: number | null
          status?: string | null
          title?: string | null
          total_watch_depth?: number | null
          updated_at?: string
          via_viewer_id?: string | null
          viewer_hash?: string
          viewers_generated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "viewers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewers_via_viewer_id_fkey"
            columns: ["via_viewer_id"]
            isOneToOne: false
            referencedRelation: "viewers"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          company: string
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          message: string | null
          phone: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          company: string
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          message?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
        }
        Update: {
          company?: string
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
        }
        Relationships: []
      }
      watch_progress: {
        Row: {
          created_at: string
          first_watched_at: string
          id: string
          last_watched_at: string
          max_percentage_reached: number
          referred_by_hash: string | null
          session_count: number
          total_watch_seconds: number
          updated_at: string
          video_id: string
          viewer_company: string | null
          viewer_email: string | null
          viewer_hash: string
          viewer_name: string | null
          viewer_title: string | null
          watch_percentage: number
        }
        Insert: {
          created_at?: string
          first_watched_at?: string
          id?: string
          last_watched_at?: string
          max_percentage_reached?: number
          referred_by_hash?: string | null
          session_count?: number
          total_watch_seconds?: number
          updated_at?: string
          video_id: string
          viewer_company?: string | null
          viewer_email?: string | null
          viewer_hash: string
          viewer_name?: string | null
          viewer_title?: string | null
          watch_percentage?: number
        }
        Update: {
          created_at?: string
          first_watched_at?: string
          id?: string
          last_watched_at?: string
          max_percentage_reached?: number
          referred_by_hash?: string | null
          session_count?: number
          total_watch_seconds?: number
          updated_at?: string
          video_id?: string
          viewer_company?: string | null
          viewer_email?: string | null
          viewer_hash?: string
          viewer_name?: string | null
          viewer_title?: string | null
          watch_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "watch_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_role_in_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      handle_user_signup: {
        Args: { p_email: string; p_org_name: string; p_user_id: string }
        Returns: Json
      }
      has_min_role_in_org: {
        Args: {
          _min_role: Database["public"]["Enums"]["org_role"]
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      audit_event_type:
        | "user_signup"
        | "user_login"
        | "user_logout"
        | "onboarding_started"
        | "onboarding_profile_completed"
        | "onboarding_video_recorded"
        | "onboarding_completed"
        | "org_created"
        | "org_member_added"
        | "org_member_removed"
        | "org_member_role_changed"
        | "identity_created"
        | "identity_updated"
        | "identity_status_changed"
        | "campaign_created"
        | "campaign_updated"
        | "campaign_submitted"
        | "campaign_approved"
        | "campaign_rejected"
        | "video_job_created"
        | "video_job_completed"
        | "video_job_failed"
        | "video_viewed"
        | "video_shared"
        | "approval_requested"
        | "approval_approved"
        | "approval_rejected"
        | "policy_updated"
      campaign_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "generating"
        | "completed"
        | "cancelled"
      identity_status: "draft" | "pending_approval" | "ready" | "suspended"
      identity_type: "executive" | "sales_rep" | "hr" | "marketing" | "other"
      org_role: "org_owner" | "org_admin" | "org_manager" | "org_user"
      video_job_status: "queued" | "processing" | "completed" | "failed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pending", "approved", "rejected"],
      audit_event_type: [
        "user_signup",
        "user_login",
        "user_logout",
        "onboarding_started",
        "onboarding_profile_completed",
        "onboarding_video_recorded",
        "onboarding_completed",
        "org_created",
        "org_member_added",
        "org_member_removed",
        "org_member_role_changed",
        "identity_created",
        "identity_updated",
        "identity_status_changed",
        "campaign_created",
        "campaign_updated",
        "campaign_submitted",
        "campaign_approved",
        "campaign_rejected",
        "video_job_created",
        "video_job_completed",
        "video_job_failed",
        "video_viewed",
        "video_shared",
        "approval_requested",
        "approval_approved",
        "approval_rejected",
        "policy_updated",
      ],
      campaign_status: [
        "draft",
        "pending_approval",
        "approved",
        "generating",
        "completed",
        "cancelled",
      ],
      identity_status: ["draft", "pending_approval", "ready", "suspended"],
      identity_type: ["executive", "sales_rep", "hr", "marketing", "other"],
      org_role: ["org_owner", "org_admin", "org_manager", "org_user"],
      video_job_status: ["queued", "processing", "completed", "failed"],
    },
  },
} as const
