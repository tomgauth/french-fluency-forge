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
      app_accounts: {
        Row: {
          access_status: string
          created_at: string
          email: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_status?: string
          created_at?: string
          email: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_status?: string
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      archetype_feedback: {
        Row: {
          created_at: string
          feedback_text: string
          id: string
          marketing_consent: boolean
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text: string
          id?: string
          marketing_consent?: boolean
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string
          id?: string
          marketing_consent?: boolean
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archetype_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          age_band: Database["public"]["Enums"]["age_band_type"] | null
          archetype: string | null
          completed_at: string | null
          comprehension_locked: boolean
          comprehension_locked_at: string | null
          confidence_locked: boolean
          confidence_locked_at: string | null
          conversation_locked: boolean
          conversation_locked_at: string | null
          created_at: string
          fluency_locked: boolean
          fluency_locked_at: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          goals: string | null
          id: string
          languages_spoken: string[] | null
          primary_track: Database["public"]["Enums"]["track_type"] | null
          purchase_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          syntax_locked: boolean
          syntax_locked_at: string | null
          updated_at: string
          user_id: string
          variant: string | null
        }
        Insert: {
          age_band?: Database["public"]["Enums"]["age_band_type"] | null
          archetype?: string | null
          completed_at?: string | null
          comprehension_locked?: boolean
          comprehension_locked_at?: string | null
          confidence_locked?: boolean
          confidence_locked_at?: string | null
          conversation_locked?: boolean
          conversation_locked_at?: string | null
          created_at?: string
          fluency_locked?: boolean
          fluency_locked_at?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goals?: string | null
          id?: string
          languages_spoken?: string[] | null
          primary_track?: Database["public"]["Enums"]["track_type"] | null
          purchase_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          syntax_locked?: boolean
          syntax_locked_at?: string | null
          updated_at?: string
          user_id: string
          variant?: string | null
        }
        Update: {
          age_band?: Database["public"]["Enums"]["age_band_type"] | null
          archetype?: string | null
          completed_at?: string | null
          comprehension_locked?: boolean
          comprehension_locked_at?: string | null
          confidence_locked?: boolean
          confidence_locked_at?: string | null
          conversation_locked?: boolean
          conversation_locked_at?: string | null
          created_at?: string
          fluency_locked?: boolean
          fluency_locked_at?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goals?: string | null
          id?: string
          languages_spoken?: string[] | null
          primary_track?: Database["public"]["Enums"]["track_type"] | null
          purchase_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          syntax_locked?: boolean
          syntax_locked_at?: string | null
          updated_at?: string
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comprehension_items: {
        Row: {
          answer_key: Json
          audio_url: string | null
          cefr_level: string
          created_at: string
          estimated_duration_s: number
          id: string
          language: string
          options: Json
          prompt: Json
          transcript_fr: string
          updated_at: string
          word_count: number
        }
        Insert: {
          answer_key: Json
          audio_url?: string | null
          cefr_level: string
          created_at?: string
          estimated_duration_s: number
          id: string
          language?: string
          options: Json
          prompt: Json
          transcript_fr: string
          updated_at?: string
          word_count: number
        }
        Update: {
          answer_key?: Json
          audio_url?: string | null
          cefr_level?: string
          created_at?: string
          estimated_duration_s?: number
          id?: string
          language?: string
          options?: Json
          prompt?: Json
          transcript_fr?: string
          updated_at?: string
          word_count?: number
        }
        Relationships: []
      }
      comprehension_recordings: {
        Row: {
          ai_confidence: number | null
          ai_feedback_fr: string | null
          ai_score: number | null
          asr_version: string | null
          attempt_number: number
          audio_played_at: string | null
          audio_storage_path: string | null
          completed_at: string | null
          correct_option_ids: string[] | null
          correct_selections: string[] | null
          created_at: string
          error_message: string | null
          id: string
          incorrect_selections: string[] | null
          intent_match: Json | null
          item_id: string
          missed_selections: string[] | null
          prompt_version: string | null
          scorer_version: string | null
          selected_option_ids: string[] | null
          session_id: string
          status: string
          superseded: boolean
          transcript: string | null
          understood_facts: Json | null
          used_for_scoring: boolean
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_feedback_fr?: string | null
          ai_score?: number | null
          asr_version?: string | null
          attempt_number?: number
          audio_played_at?: string | null
          audio_storage_path?: string | null
          completed_at?: string | null
          correct_option_ids?: string[] | null
          correct_selections?: string[] | null
          created_at?: string
          error_message?: string | null
          id?: string
          incorrect_selections?: string[] | null
          intent_match?: Json | null
          item_id: string
          missed_selections?: string[] | null
          prompt_version?: string | null
          scorer_version?: string | null
          selected_option_ids?: string[] | null
          session_id: string
          status?: string
          superseded?: boolean
          transcript?: string | null
          understood_facts?: Json | null
          used_for_scoring?: boolean
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_feedback_fr?: string | null
          ai_score?: number | null
          asr_version?: string | null
          attempt_number?: number
          audio_played_at?: string | null
          audio_storage_path?: string | null
          completed_at?: string | null
          correct_option_ids?: string[] | null
          correct_selections?: string[] | null
          created_at?: string
          error_message?: string | null
          id?: string
          incorrect_selections?: string[] | null
          intent_match?: Json | null
          item_id?: string
          missed_selections?: string[] | null
          prompt_version?: string | null
          scorer_version?: string | null
          selected_option_ids?: string[] | null
          session_id?: string
          status?: string
          superseded?: boolean
          transcript?: string | null
          understood_facts?: Json | null
          used_for_scoring?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comprehension_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      confidence_questionnaire_responses: {
        Row: {
          created_at: string
          honesty_flag: boolean | null
          id: string
          normalized_score: number | null
          raw_score: number | null
          responses: Json
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          honesty_flag?: boolean | null
          id?: string
          normalized_score?: number | null
          raw_score?: number | null
          responses?: Json
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          honesty_flag?: boolean | null
          id?: string
          normalized_score?: number | null
          raw_score?: number | null
          responses?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confidence_questionnaire_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confidence_questionnaire_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consented_at: string
          data_processing_consent: boolean
          id: string
          ip_address: string | null
          recording_consent: boolean
          retention_acknowledged: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consented_at?: string
          data_processing_consent?: boolean
          id?: string
          ip_address?: string | null
          recording_consent?: boolean
          retention_acknowledged?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consented_at?: string
          data_processing_consent?: boolean
          id?: string
          ip_address?: string | null
          recording_consent?: boolean
          retention_acknowledged?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          account_id: string
          created_at: string
          delta: number
          id: string
          reason: string
          systemeio_message_id: string | null
          systemeio_offer_price_plan_id: string | null
          systemeio_order_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          delta: number
          id?: string
          reason: string
          systemeio_message_id?: string | null
          systemeio_offer_price_plan_id?: string | null
          systemeio_order_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          systemeio_message_id?: string | null
          systemeio_offer_price_plan_id?: string | null
          systemeio_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_wallets: {
        Row: {
          account_id: string
          id: string
          test_credits_lifetime: number
          test_credits_remaining: number
          updated_at: string
        }
        Insert: {
          account_id: string
          id?: string
          test_credits_lifetime?: number
          test_credits_remaining?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          id?: string
          test_credits_lifetime?: number
          test_credits_remaining?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_wallets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fluency_events: {
        Row: {
          attempt_number: number | null
          created_at: string
          event_type: string
          id: string
          item_id: string | null
          metadata: Json | null
          session_id: string
          user_id: string
        }
        Insert: {
          attempt_number?: number | null
          created_at?: string
          event_type: string
          id?: string
          item_id?: string | null
          metadata?: Json | null
          session_id: string
          user_id: string
        }
        Update: {
          attempt_number?: number | null
          created_at?: string
          event_type?: string
          id?: string
          item_id?: string | null
          metadata?: Json | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fluency_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluency_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fluency_recordings: {
        Row: {
          attempt_number: number
          audio_storage_path: string | null
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          item_id: string
          pause_count: number | null
          session_id: string
          status: string
          superseded: boolean
          total_pause_duration: number | null
          transcript: string | null
          used_for_scoring: boolean
          user_id: string
          word_count: number | null
          wpm: number | null
        }
        Insert: {
          attempt_number?: number
          audio_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          item_id: string
          pause_count?: number | null
          session_id: string
          status?: string
          superseded?: boolean
          total_pause_duration?: number | null
          transcript?: string | null
          used_for_scoring?: boolean
          user_id: string
          word_count?: number | null
          wpm?: number | null
        }
        Update: {
          attempt_number?: number
          audio_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          item_id?: string
          pause_count?: number | null
          session_id?: string
          status?: string
          superseded?: boolean
          total_pause_duration?: number | null
          transcript?: string | null
          used_for_scoring?: boolean
          user_id?: string
          word_count?: number | null
          wpm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fluency_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluency_recordings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          completed_at: string | null
          created_at: string
          currency: string
          email: string
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          email: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          email?: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_calls: {
        Row: {
          answers: Json | null
          created_at: string
          created_by: string | null
          follow_up_email: string | null
          id: string
          lead_id: string
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          qualification_reason: string | null
          qualification_score: number | null
          stage: Database["public"]["Enums"]["call_stage"]
          summary: string | null
          tags: Json | null
          transcript_notes: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          created_by?: string | null
          follow_up_email?: string | null
          id?: string
          lead_id: string
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          qualification_reason?: string | null
          qualification_score?: number | null
          stage?: Database["public"]["Enums"]["call_stage"]
          summary?: string | null
          tags?: Json | null
          transcript_notes?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json | null
          created_at?: string
          created_by?: string | null
          follow_up_email?: string | null
          id?: string
          lead_id?: string
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          qualification_reason?: string | null
          qualification_score?: number | null
          stage?: Database["public"]["Enums"]["call_stage"]
          summary?: string | null
          tags?: Json | null
          transcript_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          biggest_blockers: string[] | null
          budget_comfort: number | null
          country: string | null
          created_at: string
          created_by: string | null
          current_level: string | null
          deadline_urgency: string | null
          decision_maker: string | null
          email: string | null
          goal: string | null
          id: string
          linked_user_id: string | null
          motivation: string | null
          name: string | null
          notes: string | null
          past_methods_tried: string[] | null
          time_available_per_week: number | null
          timezone: string | null
          updated_at: string
          willingness_to_speak: number | null
        }
        Insert: {
          biggest_blockers?: string[] | null
          budget_comfort?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_level?: string | null
          deadline_urgency?: string | null
          decision_maker?: string | null
          email?: string | null
          goal?: string | null
          id?: string
          linked_user_id?: string | null
          motivation?: string | null
          name?: string | null
          notes?: string | null
          past_methods_tried?: string[] | null
          time_available_per_week?: number | null
          timezone?: string | null
          updated_at?: string
          willingness_to_speak?: number | null
        }
        Update: {
          biggest_blockers?: string[] | null
          budget_comfort?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_level?: string | null
          deadline_urgency?: string | null
          decision_maker?: string | null
          email?: string | null
          goal?: string | null
          id?: string
          linked_user_id?: string | null
          motivation?: string | null
          name?: string | null
          notes?: string | null
          past_methods_tried?: string[] | null
          time_available_per_week?: number | null
          timezone?: string | null
          updated_at?: string
          willingness_to_speak?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_playbook: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          playbook_data: Json
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          playbook_data: Json
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          playbook_data?: Json
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_playbook_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_traces: {
        Row: {
          created_at: string | null
          id: string
          module_type: string
          session_id: string | null
          trace_data: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_type: string
          session_id?: string | null
          trace_data: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          module_type?: string
          session_id?: string | null
          trace_data?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoring_traces_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_recordings: {
        Row: {
          ai_breakdown: Json | null
          ai_feedback: string | null
          ai_score: number | null
          attempt_number: number
          audio_storage_path: string | null
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          item_id: string
          module_type: string
          session_id: string
          status: string
          superseded: boolean
          transcript: string | null
          used_for_scoring: boolean
          user_id: string
          word_count: number | null
        }
        Insert: {
          ai_breakdown?: Json | null
          ai_feedback?: string | null
          ai_score?: number | null
          attempt_number?: number
          audio_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          item_id: string
          module_type: string
          session_id: string
          status?: string
          superseded?: boolean
          transcript?: string | null
          used_for_scoring?: boolean
          user_id: string
          word_count?: number | null
        }
        Update: {
          ai_breakdown?: Json | null
          ai_feedback?: string | null
          ai_score?: number | null
          attempt_number?: number
          audio_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          item_id?: string
          module_type?: string
          session_id?: string
          status?: string
          superseded?: boolean
          transcript?: string | null
          used_for_scoring?: boolean
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_recordings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      systemeio_product_map: {
        Row: {
          active: boolean
          credits_delta: number
          grants_access: boolean
          id: string
          note: string | null
          offer_price_plan_id: string
          product_key: string
        }
        Insert: {
          active?: boolean
          credits_delta?: number
          grants_access?: boolean
          id?: string
          note?: string | null
          offer_price_plan_id: string
          product_key: string
        }
        Update: {
          active?: boolean
          credits_delta?: number
          grants_access?: boolean
          id?: string
          note?: string | null
          offer_price_plan_id?: string
          product_key?: string
        }
        Relationships: []
      }
      // V0-CORE: Habits and Goals persistence tables
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          frequency: "daily" | "weekly"
          source: "system" | "personal"
          intensity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          frequency: "daily" | "weekly"
          source?: "system" | "personal"
          intensity?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          frequency?: "daily" | "weekly"
          source?: "system" | "personal"
          intensity?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_cells: {
        Row: {
          id: string
          habit_id: string
          user_id: string
          date: string
          status: "done" | "missed" | "na" | "future"
          intensity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          habit_id: string
          user_id: string
          date: string
          status?: "done" | "missed" | "na" | "future"
          intensity?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          habit_id?: string
          user_id?: string
          date?: string
          status?: "done" | "missed" | "na" | "future"
          intensity?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_cells_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          acceptance_criteria: string | null
          deadline: string | null
          goal_type: "skill" | "volume" | "freeform"
          locked: boolean
          dimension: string | null
          target_score: number | null
          metric: string | null
          target_value: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          acceptance_criteria?: string | null
          deadline?: string | null
          goal_type: "skill" | "volume" | "freeform"
          locked?: boolean
          dimension?: string | null
          target_score?: number | null
          metric?: string | null
          target_value?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          acceptance_criteria?: string | null
          deadline?: string | null
          goal_type?: "skill" | "volume" | "freeform"
          locked?: boolean
          dimension?: string | null
          target_score?: number | null
          metric?: string | null
          target_value?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      systemeio_webhook_events: {
        Row: {
          error: string | null
          event_name: string
          event_timestamp: string | null
          id: string
          payload: Json
          processed_at: string | null
          processing_status: string
          received_at: string
        }
        Insert: {
          error?: string | null
          event_name: string
          event_timestamp?: string | null
          id: string
          payload: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
        }
        Update: {
          error?: string | null
          event_name?: string
          event_timestamp?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_user: { Args: { user_email: string }; Returns: boolean }
    }
    Enums: {
      age_band_type: "18_24" | "25_34" | "35_44" | "45_54" | "55_64" | "65_plus"
      call_outcome: "won" | "lost" | "follow_up" | "refer_out"
      call_stage:
        | "rapport"
        | "diagnose"
        | "qualify"
        | "present"
        | "objections"
        | "close"
        | "next_steps"
      gender_type: "male" | "female" | "non_binary" | "prefer_not"
      session_status:
        | "intake"
        | "consent"
        | "quiz"
        | "mic_check"
        | "assessment"
        | "processing"
        | "completed"
        | "abandoned"
      track_type:
        | "small_talk"
        | "transactions"
        | "bilingual_friends"
        | "work"
        | "home"
        | "in_laws"
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
      age_band_type: ["18_24", "25_34", "35_44", "45_54", "55_64", "65_plus"],
      call_outcome: ["won", "lost", "follow_up", "refer_out"],
      call_stage: [
        "rapport",
        "diagnose",
        "qualify",
        "present",
        "objections",
        "close",
        "next_steps",
      ],
      gender_type: ["male", "female", "non_binary", "prefer_not"],
      session_status: [
        "intake",
        "consent",
        "quiz",
        "mic_check",
        "assessment",
        "processing",
        "completed",
        "abandoned",
      ],
      track_type: [
        "small_talk",
        "transactions",
        "bilingual_friends",
        "work",
        "home",
        "in_laws",
      ],
    },
  },
} as const
