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
      approval_requests: {
        Row: {
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
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
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
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
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
          approved_at: string | null
          approved_by_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          identity_id: string
          is_self_campaign: boolean | null
          metadata: Json | null
          name: string
          org_id: string
          scheduled_at: string | null
          script: string
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          identity_id: string
          is_self_campaign?: boolean | null
          metadata?: Json | null
          name: string
          org_id: string
          scheduled_at?: string | null
          script: string
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          identity_id?: string
          is_self_campaign?: boolean | null
          metadata?: Json | null
          name?: string
          org_id?: string
          scheduled_at?: string | null
          script?: string
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
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      identities: {
        Row: {
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
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
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
          last_name: string | null
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
          last_name?: string | null
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
          last_name?: string | null
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
