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
      admin_notifications: {
        Row: {
          created_at: string | null
          description: string | null
          dismissed_at: string | null
          id: string
          lead_id: string | null
          link: string | null
          meeting_id: string | null
          metadata: Json | null
          read_at: string | null
          severity: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          id?: string
          lead_id?: string | null
          link?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          read_at?: string | null
          severity?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          id?: string
          lead_id?: string | null
          link?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          read_at?: string | null
          severity?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          is_active: boolean | null
          is_premium: boolean | null
          link_url: string | null
          profile_id: string
          rejected_reason: string | null
          start_date: string
          status: string | null
          title: string
          views: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          link_url?: string | null
          profile_id: string
          rejected_reason?: string | null
          start_date: string
          status?: string | null
          title: string
          views?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          link_url?: string | null
          profile_id?: string
          rejected_reason?: string | null
          start_date?: string
          status?: string | null
          title?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_configs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ig_followup_context: string | null
          ig_followup_delay_min: number | null
          ig_followup_enabled: boolean | null
          instance_id: string | null
          persona: string | null
          product_info: string | null
          restrictions: string | null
          skills: Json | null
          uazapi_agent_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ig_followup_context?: string | null
          ig_followup_delay_min?: number | null
          ig_followup_enabled?: boolean | null
          instance_id?: string | null
          persona?: string | null
          product_info?: string | null
          restrictions?: string | null
          skills?: Json | null
          uazapi_agent_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ig_followup_context?: string | null
          ig_followup_delay_min?: number | null
          ig_followup_enabled?: boolean | null
          instance_id?: string | null
          persona?: string | null
          product_info?: string | null
          restrictions?: string | null
          skills?: Json | null
          uazapi_agent_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_knowledge: {
        Row: {
          agent_id: string | null
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_used_at: string | null
          media_url: string | null
          priority: number | null
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          agent_id?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          media_url?: string | null
          priority?: number | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          agent_id?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_used_at?: string | null
          media_url?: string | null
          priority?: number | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_cadence_enrollments: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          enrolled_at: string | null
          id: string
          last_step_at: string | null
          lead_id: string
          metadata: Json | null
          next_action_at: string | null
          post_action: string | null
          stage: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          enrolled_at?: string | null
          id?: string
          last_step_at?: string | null
          lead_id: string
          metadata?: Json | null
          next_action_at?: string | null
          post_action?: string | null
          stage: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          enrolled_at?: string | null
          id?: string
          last_step_at?: string | null
          lead_id?: string
          metadata?: Json | null
          next_action_at?: string | null
          post_action?: string | null
          stage?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_cadence_enrollments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_conversations: {
        Row: {
          agent_id: string | null
          bot_detection_flags: Json | null
          bot_detection_score: number | null
          created_at: string | null
          id: string
          last_message_id: string | null
          last_processed_at: string | null
          lead_id: string | null
          messages_history: Json | null
          metadata: Json | null
          pause_reason: string | null
          pause_until: string | null
          paused_at: string | null
          paused_by: string | null
          processing_lock: string | null
          status: string | null
          total_messages_received: number | null
          total_messages_sent: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          bot_detection_flags?: Json | null
          bot_detection_score?: number | null
          created_at?: string | null
          id?: string
          last_message_id?: string | null
          last_processed_at?: string | null
          lead_id?: string | null
          messages_history?: Json | null
          metadata?: Json | null
          pause_reason?: string | null
          pause_until?: string | null
          paused_at?: string | null
          paused_by?: string | null
          processing_lock?: string | null
          status?: string | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          bot_detection_flags?: Json | null
          bot_detection_score?: number | null
          created_at?: string | null
          id?: string
          last_message_id?: string | null
          last_processed_at?: string | null
          lead_id?: string | null
          messages_history?: Json | null
          metadata?: Json | null
          pause_reason?: string | null
          pause_until?: string | null
          paused_at?: string | null
          paused_by?: string | null
          processing_lock?: string | null
          status?: string | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_logs: {
        Row: {
          agent_id: string | null
          conversation_id: string | null
          cost_usd: number | null
          created_at: string | null
          data: Json | null
          duration_ms: number | null
          id: string
          lead_id: string | null
          log_type: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          agent_id?: string | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          data?: Json | null
          duration_ms?: number | null
          id?: string
          lead_id?: string | null
          log_type: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          data?: Json | null
          duration_ms?: number | null
          id?: string
          lead_id?: string | null
          log_type?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_send_counts: {
        Row: {
          agent_id: string | null
          bucket: string | null
          created_at: string | null
          id: string
          instance_id: string | null
          message_count: number | null
          window_start: string
          window_type: string
        }
        Insert: {
          agent_id?: string | null
          bucket?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          message_count?: number | null
          window_start: string
          window_type: string
        }
        Update: {
          agent_id?: string | null
          bucket?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          message_count?: number | null
          window_start?: string
          window_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_send_counts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_send_counts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sales_agents: {
        Row: {
          board_id: string | null
          cadence_steps: Json | null
          channel: string | null
          created_at: string | null
          description: string | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          is_default: boolean | null
          keyword_rules: Json | null
          max_tokens: number | null
          model: string | null
          name: string
          persona: Json | null
          priority: number | null
          provider: string | null
          settings: Json | null
          system_prompt: string
          target_stages: string[] | null
          temperature: number | null
          tools_enabled: string[] | null
          updated_at: string | null
        }
        Insert: {
          board_id?: string | null
          cadence_steps?: Json | null
          channel?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          keyword_rules?: Json | null
          max_tokens?: number | null
          model?: string | null
          name: string
          persona?: Json | null
          priority?: number | null
          provider?: string | null
          settings?: Json | null
          system_prompt: string
          target_stages?: string[] | null
          temperature?: number | null
          tools_enabled?: string[] | null
          updated_at?: string | null
        }
        Update: {
          board_id?: string | null
          cadence_steps?: Json | null
          channel?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          keyword_rules?: Json | null
          max_tokens?: number | null
          model?: string | null
          name?: string
          persona?: Json | null
          priority?: number | null
          provider?: string | null
          settings?: Json | null
          system_prompt?: string
          target_stages?: string[] | null
          temperature?: number | null
          tools_enabled?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_sales_agents_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          announcement_type: Database["public"]["Enums"]["announcement_type"]
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          target_profile_id: string | null
          title: string
        }
        Insert: {
          announcement_type?: Database["public"]["Enums"]["announcement_type"]
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          target_profile_id?: string | null
          title: string
        }
        Update: {
          announcement_type?: Database["public"]["Enums"]["announcement_type"]
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          target_profile_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_admins: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
        }
        Relationships: []
      }
      app_credentials: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          slug: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          slug: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          slug?: string
          valor?: string
        }
        Relationships: []
      }
      billing_config: {
        Row: {
          api_key: string | null
          config: Json | null
          gateway: string
          id: string
          is_active: boolean | null
          pix_key: string | null
          pix_name: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          config?: Json | null
          gateway: string
          id?: string
          is_active?: boolean | null
          pix_key?: string | null
          pix_name?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          config?: Json | null
          gateway?: string
          id?: string
          is_active?: boolean | null
          pix_key?: string | null
          pix_name?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      business_deals: {
        Row: {
          amount: number
          buyer_name: string | null
          buyer_profile_id: string | null
          created_at: string | null
          deal_date: string
          description: string | null
          id: string
          seller_profile_id: string
          status: string | null
          title: string
        }
        Insert: {
          amount: number
          buyer_name?: string | null
          buyer_profile_id?: string | null
          created_at?: string | null
          deal_date?: string
          description?: string | null
          id?: string
          seller_profile_id: string
          status?: string | null
          title: string
        }
        Update: {
          amount?: number
          buyer_name?: string | null
          buyer_profile_id?: string | null
          created_at?: string | null
          deal_date?: string
          description?: string | null
          id?: string
          seller_profile_id?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_deals_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_deals_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_enrollments: {
        Row: {
          cadence_id: string | null
          created_at: string | null
          current_step: number | null
          id: string
          lead_id: string | null
          next_send_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cadence_id?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          lead_id?: string | null
          next_send_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cadence_id?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          lead_id?: string | null
          next_send_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadence_enrollments_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadence_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_sequences: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          steps: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          steps?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          steps?: Json | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          attendees: Json | null
          attendees_user_ids: string[] | null
          color: string | null
          created_at: string | null
          description: string | null
          end_at: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          is_recurring: boolean | null
          lead_id: string | null
          location: string | null
          meeting_url: string | null
          metadata: Json | null
          owner_user_id: string | null
          recurrence_count: number | null
          recurrence_rule: string | null
          recurrence_until: string | null
          related_lesson_id: string | null
          related_meeting_id: string | null
          reminder_minutes_before: number | null
          reminder_sent_at: string | null
          reminder_whatsapp_phone: string | null
          rrule: string | null
          start_at: string
          status: string | null
          sync_status: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          attendees?: Json | null
          attendees_user_ids?: string[] | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          is_recurring?: boolean | null
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          owner_user_id?: string | null
          recurrence_count?: number | null
          recurrence_rule?: string | null
          recurrence_until?: string | null
          related_lesson_id?: string | null
          related_meeting_id?: string | null
          reminder_minutes_before?: number | null
          reminder_sent_at?: string | null
          reminder_whatsapp_phone?: string | null
          rrule?: string | null
          start_at: string
          status?: string | null
          sync_status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          attendees?: Json | null
          attendees_user_ids?: string[] | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          is_recurring?: boolean | null
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          owner_user_id?: string | null
          recurrence_count?: number | null
          recurrence_rule?: string | null
          recurrence_until?: string | null
          related_lesson_id?: string | null
          related_meeting_id?: string | null
          reminder_minutes_before?: number | null
          reminder_sent_at?: string | null
          reminder_whatsapp_phone?: string | null
          rrule?: string | null
          start_at?: string
          status?: string | null
          sync_status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      call_history: {
        Row: {
          ai_key_points: Json | null
          ai_processed_at: string | null
          ai_sentiment: string | null
          ai_suggested_tasks: Json | null
          ai_summary: string | null
          created_at: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          peer_name: string | null
          peer_phone: string
          started_at: string | null
          status: string | null
          transcription: string | null
          transcriptions: Json | null
          user_id: string
          wavoip_call_id: string | null
          wavoip_device_id: string | null
        }
        Insert: {
          ai_key_points?: Json | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_suggested_tasks?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          peer_name?: string | null
          peer_phone: string
          started_at?: string | null
          status?: string | null
          transcription?: string | null
          transcriptions?: Json | null
          user_id: string
          wavoip_call_id?: string | null
          wavoip_device_id?: string | null
        }
        Update: {
          ai_key_points?: Json | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_suggested_tasks?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          peer_name?: string | null
          peer_phone?: string
          started_at?: string | null
          status?: string | null
          transcription?: string | null
          transcriptions?: Json | null
          user_id?: string
          wavoip_call_id?: string | null
          wavoip_device_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_history_wavoip_device_id_fkey"
            columns: ["wavoip_device_id"]
            isOneToOne: false
            referencedRelation: "wavoip_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          ai_analysis: Json | null
          assigned_to: string | null
          created_at: string | null
          email: string | null
          id: string
          interview_date: string | null
          interview_notes: string | null
          interview_url: string | null
          name: string
          phone: string | null
          photo_url: string | null
          position: string | null
          rating: number | null
          resume_notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interview_date?: string | null
          interview_notes?: string | null
          interview_url?: string | null
          name: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          rating?: number | null
          resume_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interview_date?: string | null
          interview_notes?: string | null
          interview_url?: string | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          rating?: number | null
          resume_notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          lesson_id: string | null
          member_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          member_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          member_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "member_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_destinos: {
        Row: {
          ativo: boolean
          created_at: string
          gateway: string | null
          id: string
          nome: string
          ordem: number
          param_codigo: string
          slug: string
          url: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          gateway?: string | null
          id?: string
          nome: string
          ordem?: number
          param_codigo?: string
          slug: string
          url?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          gateway?: string | null
          id?: string
          nome?: string
          ordem?: number
          param_codigo?: string
          slug?: string
          url?: string | null
        }
        Relationships: []
      }
      client_audience: {
        Row: {
          client_id: string
          created_at: string
          id: string
          main_audience_profile: string | null
          main_objections: string | null
          preferred_channels: string | null
          product_user: string | null
          purchase_decision_maker: string | null
          purchase_triggers: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          main_audience_profile?: string | null
          main_objections?: string | null
          preferred_channels?: string | null
          product_user?: string | null
          purchase_decision_maker?: string | null
          purchase_triggers?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          main_audience_profile?: string | null
          main_objections?: string | null
          preferred_channels?: string | null
          product_user?: string | null
          purchase_decision_maker?: string | null
          purchase_triggers?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_audience_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_branding: {
        Row: {
          ai_introduction: string | null
          ai_name: string | null
          ai_presentation_style: string | null
          brand_behaviors: string | null
          brand_tone: string | null
          client_id: string
          client_treatment: string | null
          created_at: string
          id: string
          phrases_to_avoid: string | null
          phrases_to_use: string | null
          product_vocabulary: string | null
          serious_mistakes: string | null
          updated_at: string
        }
        Insert: {
          ai_introduction?: string | null
          ai_name?: string | null
          ai_presentation_style?: string | null
          brand_behaviors?: string | null
          brand_tone?: string | null
          client_id: string
          client_treatment?: string | null
          created_at?: string
          id?: string
          phrases_to_avoid?: string | null
          phrases_to_use?: string | null
          product_vocabulary?: string | null
          serious_mistakes?: string | null
          updated_at?: string
        }
        Update: {
          ai_introduction?: string | null
          ai_name?: string | null
          ai_presentation_style?: string | null
          brand_behaviors?: string | null
          brand_tone?: string | null
          client_id?: string
          client_treatment?: string | null
          created_at?: string
          id?: string
          phrases_to_avoid?: string | null
          phrases_to_use?: string | null
          product_vocabulary?: string | null
          serious_mistakes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_branding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          client_id: string | null
          contract_date: string
          created_at: string
          due_day: number
          id: string
          monthly_value: number
          notes: string | null
          service_name: string
          setup_paid: boolean | null
          setup_payment_date: string | null
          setup_value: number | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          contract_date?: string
          created_at?: string
          due_day: number
          id?: string
          monthly_value: number
          notes?: string | null
          service_name: string
          setup_paid?: boolean | null
          setup_payment_date?: string | null
          setup_value?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          contract_date?: string
          created_at?: string
          due_day?: number
          id?: string
          monthly_value?: number
          notes?: string | null
          service_name?: string
          setup_paid?: boolean | null
          setup_payment_date?: string | null
          setup_value?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_expansion: {
        Row: {
          ai_functions: string | null
          automation_flows: string | null
          client_id: string
          created_at: string
          followup_count: number | null
          followup_intervals: string | null
          future_features: string | null
          id: string
          multiple_channels: boolean | null
          out_of_context_redirect: string | null
          special_messages: string | null
          top_10_faqs: Json | null
          updated_at: string
        }
        Insert: {
          ai_functions?: string | null
          automation_flows?: string | null
          client_id: string
          created_at?: string
          followup_count?: number | null
          followup_intervals?: string | null
          future_features?: string | null
          id?: string
          multiple_channels?: boolean | null
          out_of_context_redirect?: string | null
          special_messages?: string | null
          top_10_faqs?: Json | null
          updated_at?: string
        }
        Update: {
          ai_functions?: string | null
          automation_flows?: string | null
          client_id?: string
          created_at?: string
          followup_count?: number | null
          followup_intervals?: string | null
          future_features?: string | null
          id?: string
          multiple_channels?: boolean | null
          out_of_context_redirect?: string | null
          special_messages?: string | null
          top_10_faqs?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_expansion_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_goals: {
        Row: {
          ai_expectations: string | null
          client_id: string
          created_at: string
          failure_criteria: string | null
          id: string
          kpis_to_measure: string | null
          success_criteria: string | null
          updated_at: string
        }
        Insert: {
          ai_expectations?: string | null
          client_id: string
          created_at?: string
          failure_criteria?: string | null
          id?: string
          kpis_to_measure?: string | null
          success_criteria?: string | null
          updated_at?: string
        }
        Update: {
          ai_expectations?: string | null
          client_id?: string
          created_at?: string
          failure_criteria?: string | null
          id?: string
          kpis_to_measure?: string | null
          success_criteria?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_goals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_materials: {
        Row: {
          brand_texts: string | null
          catalogs_manuals: string | null
          client_id: string
          created_at: string
          environment_media: Json | null
          id: string
          logo_url: string | null
          product_photos: Json | null
          testimonials: Json | null
          updated_at: string
        }
        Insert: {
          brand_texts?: string | null
          catalogs_manuals?: string | null
          client_id: string
          created_at?: string
          environment_media?: Json | null
          id?: string
          logo_url?: string | null
          product_photos?: Json | null
          testimonials?: Json | null
          updated_at?: string
        }
        Update: {
          brand_texts?: string | null
          catalogs_manuals?: string | null
          client_id?: string
          created_at?: string
          environment_media?: Json | null
          id?: string
          logo_url?: string | null
          product_photos?: Json | null
          testimonials?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_materials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_changes: {
        Row: {
          change_reason: string | null
          changed_by: string
          changed_fields: Json | null
          client_id: string
          created_at: string
          id: string
          new_values: Json | null
          previous_values: Json | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string
          changed_fields?: Json | null
          client_id: string
          created_at?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          changed_fields?: Json | null
          client_id?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_changes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_operations: {
        Row: {
          ai_main_objective: string | null
          attendance_flows: string | null
          automation_scope: string | null
          client_database: string | null
          client_id: string
          created_at: string
          current_systems: string | null
          desired_integrations: string | null
          growth_goals: string | null
          human_escalation_triggers: string | null
          id: string
          integrations: string | null
          marketing_channels: string | null
          max_response_time: string | null
          paid_ads: string | null
          required_client_data: string | null
          sales_scripts: string | null
          updated_at: string
          use_visual_language: boolean | null
        }
        Insert: {
          ai_main_objective?: string | null
          attendance_flows?: string | null
          automation_scope?: string | null
          client_database?: string | null
          client_id: string
          created_at?: string
          current_systems?: string | null
          desired_integrations?: string | null
          growth_goals?: string | null
          human_escalation_triggers?: string | null
          id?: string
          integrations?: string | null
          marketing_channels?: string | null
          max_response_time?: string | null
          paid_ads?: string | null
          required_client_data?: string | null
          sales_scripts?: string | null
          updated_at?: string
          use_visual_language?: boolean | null
        }
        Update: {
          ai_main_objective?: string | null
          attendance_flows?: string | null
          automation_scope?: string | null
          client_database?: string | null
          client_id?: string
          created_at?: string
          current_systems?: string | null
          desired_integrations?: string | null
          growth_goals?: string | null
          human_escalation_triggers?: string | null
          id?: string
          integrations?: string | null
          marketing_channels?: string | null
          max_response_time?: string | null
          paid_ads?: string | null
          required_client_data?: string | null
          sales_scripts?: string | null
          updated_at?: string
          use_visual_language?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_operations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_policies: {
        Row: {
          auto_bonuses: string | null
          client_id: string
          competitor_restrictions: string | null
          created_at: string
          discount_policies: string | null
          followup_routines: string | null
          forbidden_words: string | null
          id: string
          save_personal_data: boolean | null
          unsatisfied_client_handling: string | null
          updated_at: string
        }
        Insert: {
          auto_bonuses?: string | null
          client_id: string
          competitor_restrictions?: string | null
          created_at?: string
          discount_policies?: string | null
          followup_routines?: string | null
          forbidden_words?: string | null
          id?: string
          save_personal_data?: boolean | null
          unsatisfied_client_handling?: string | null
          updated_at?: string
        }
        Update: {
          auto_bonuses?: string | null
          client_id?: string
          competitor_restrictions?: string | null
          created_at?: string
          discount_policies?: string | null
          followup_routines?: string | null
          forbidden_words?: string | null
          id?: string
          save_personal_data?: boolean | null
          unsatisfied_client_handling?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_products: {
        Row: {
          best_sellers: string | null
          client_id: string
          created_at: string
          discount_approval: string | null
          exchange_policy: string | null
          id: string
          non_offered_products: string | null
          payment_methods: string | null
          products_list: Json | null
          profit_margins: string | null
          promotions: string | null
          reservation_policy: string | null
          seasonal_products: string | null
          updated_at: string
        }
        Insert: {
          best_sellers?: string | null
          client_id: string
          created_at?: string
          discount_approval?: string | null
          exchange_policy?: string | null
          id?: string
          non_offered_products?: string | null
          payment_methods?: string | null
          products_list?: Json | null
          profit_margins?: string | null
          promotions?: string | null
          reservation_policy?: string | null
          seasonal_products?: string | null
          updated_at?: string
        }
        Update: {
          best_sellers?: string | null
          client_id?: string
          created_at?: string
          discount_approval?: string | null
          exchange_policy?: string | null
          id?: string
          non_offered_products?: string | null
          payment_methods?: string | null
          products_list?: Json | null
          profit_margins?: string | null
          promotions?: string | null
          reservation_policy?: string | null
          seasonal_products?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_technical: {
        Row: {
          after_hours_redirect: string | null
          after_hours_response_time: string | null
          client_id: string
          created_at: string
          id: string
          main_contacts: Json | null
          operation_hours: string | null
          partner_email: string | null
          updated_at: string
        }
        Insert: {
          after_hours_redirect?: string | null
          after_hours_response_time?: string | null
          client_id: string
          created_at?: string
          id?: string
          main_contacts?: Json | null
          operation_hours?: string | null
          partner_email?: string | null
          updated_at?: string
        }
        Update: {
          after_hours_redirect?: string | null
          after_hours_response_time?: string | null
          client_id?: string
          created_at?: string
          id?: string
          main_contacts?: Json | null
          operation_hours?: string | null
          partner_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_technical_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          ai_insights: Json | null
          business_description: string | null
          client_main_pain: string | null
          company_age: string | null
          company_name: string
          created_at: string
          employees_count: string | null
          full_address: string | null
          id: string
          instagram_data: Json | null
          instagram_profile_pic_url: string | null
          lead_id: string | null
          main_differential: string | null
          onboarding_step: number
          onboarding_token: string
          position: string | null
          responsible_name: string
          served_regions: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_insights?: Json | null
          business_description?: string | null
          client_main_pain?: string | null
          company_age?: string | null
          company_name: string
          created_at?: string
          employees_count?: string | null
          full_address?: string | null
          id?: string
          instagram_data?: Json | null
          instagram_profile_pic_url?: string | null
          lead_id?: string | null
          main_differential?: string | null
          onboarding_step?: number
          onboarding_token?: string
          position?: string | null
          responsible_name: string
          served_regions?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_insights?: Json | null
          business_description?: string | null
          client_main_pain?: string | null
          company_age?: string | null
          company_name?: string
          created_at?: string
          employees_count?: string | null
          full_address?: string | null
          id?: string
          instagram_data?: Json | null
          instagram_profile_pic_url?: string | null
          lead_id?: string | null
          main_differential?: string | null
          onboarding_step?: number
          onboarding_token?: string
          position?: string | null
          responsible_name?: string
          served_regions?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_sessions: {
        Row: {
          alerts: Json
          call_history_id: string | null
          checklist_status: Json
          created_at: string
          current_phase: string | null
          id: string
          insights: Json
          playbook_id: string | null
          score: number | null
          updated_at: string
        }
        Insert: {
          alerts?: Json
          call_history_id?: string | null
          checklist_status?: Json
          created_at?: string
          current_phase?: string | null
          id?: string
          insights?: Json
          playbook_id?: string | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          alerts?: Json
          call_history_id?: string | null
          checklist_status?: Json
          created_at?: string
          current_phase?: string | null
          id?: string
          insights?: Json
          playbook_id?: string | null
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_sessions_call_history_id_fkey"
            columns: ["call_history_id"]
            isOneToOne: false
            referencedRelation: "call_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_sessions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "sales_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_event_invites: {
        Row: {
          assigned_room_id: string | null
          attendance_mode: string | null
          checked_in_at: string | null
          checkin_qr_payload: string | null
          created_at: string
          d1_email_sent_at: string | null
          d1_wa_sent_at: string | null
          d3_email_sent_at: string | null
          d3_wa_sent_at: string | null
          duration_seconds: number | null
          event_id: string
          h1_email_sent_at: string | null
          h1_wa_sent_at: string | null
          id: string
          invite_email_sent_at: string | null
          invite_wa_sent_at: string | null
          joined_at: string | null
          lead_id: string
          left_at: string | null
          no_show_marked_at: string | null
          opened_landing_at: string | null
          rsvp_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          assigned_room_id?: string | null
          attendance_mode?: string | null
          checked_in_at?: string | null
          checkin_qr_payload?: string | null
          created_at?: string
          d1_email_sent_at?: string | null
          d1_wa_sent_at?: string | null
          d3_email_sent_at?: string | null
          d3_wa_sent_at?: string | null
          duration_seconds?: number | null
          event_id: string
          h1_email_sent_at?: string | null
          h1_wa_sent_at?: string | null
          id?: string
          invite_email_sent_at?: string | null
          invite_wa_sent_at?: string | null
          joined_at?: string | null
          lead_id: string
          left_at?: string | null
          no_show_marked_at?: string | null
          opened_landing_at?: string | null
          rsvp_at?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          assigned_room_id?: string | null
          attendance_mode?: string | null
          checked_in_at?: string | null
          checkin_qr_payload?: string | null
          created_at?: string
          d1_email_sent_at?: string | null
          d1_wa_sent_at?: string | null
          d3_email_sent_at?: string | null
          d3_wa_sent_at?: string | null
          duration_seconds?: number | null
          event_id?: string
          h1_email_sent_at?: string | null
          h1_wa_sent_at?: string | null
          id?: string
          invite_email_sent_at?: string | null
          invite_wa_sent_at?: string | null
          joined_at?: string | null
          lead_id?: string
          left_at?: string | null
          no_show_marked_at?: string | null
          opened_landing_at?: string | null
          rsvp_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collective_event_invites_assigned_room_id_fkey"
            columns: ["assigned_room_id"]
            isOneToOne: false
            referencedRelation: "collective_event_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "collective_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_event_invites_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_event_invites_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_event_rooms: {
        Row: {
          attendance_mode: string
          capacity: number
          created_at: string
          current_count: number
          event_id: string
          id: string
          livekit_egress_id: string | null
          recording_url: string | null
          room_name: string
          shard_index: number
        }
        Insert: {
          attendance_mode?: string
          capacity?: number
          created_at?: string
          current_count?: number
          event_id: string
          id?: string
          livekit_egress_id?: string | null
          recording_url?: string | null
          room_name: string
          shard_index: number
        }
        Update: {
          attendance_mode?: string
          capacity?: number
          created_at?: string
          current_count?: number
          event_id?: string
          id?: string
          livekit_egress_id?: string | null
          recording_url?: string | null
          room_name?: string
          shard_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "collective_event_rooms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "collective_events"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_events: {
        Row: {
          broadcast_group_jids: Json | null
          created_at: string
          description: string | null
          duration_minutes: number
          email_template_id: string | null
          event_format: string
          host_user_id: string | null
          id: string
          max_per_room: number
          public_signup_token: string | null
          recording_destination: string
          recording_enabled: boolean
          recording_target_module_id: string | null
          recording_urls: Json | null
          reminders_config: Json
          room_prefix: string
          scheduled_at: string
          segment_last_synced_at: string | null
          segment_resync_enabled: boolean
          signup_enabled: boolean
          status: string
          target_segment: Json
          template_audio_url: string | null
          template_brief: string | null
          template_generated_by: string | null
          template_generations: Json | null
          template_html: string | null
          template_preheader: string | null
          template_subject: string | null
          template_wa_text: string | null
          title: string
          updated_at: string
          venue_address: string | null
          venue_capacity: number | null
          venue_complement: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_map_url: string | null
          venue_name: string | null
          wa_template_id: string | null
          whatsapp_group_label: string | null
          whatsapp_group_url: string | null
        }
        Insert: {
          broadcast_group_jids?: Json | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          email_template_id?: string | null
          event_format?: string
          host_user_id?: string | null
          id?: string
          max_per_room?: number
          public_signup_token?: string | null
          recording_destination?: string
          recording_enabled?: boolean
          recording_target_module_id?: string | null
          recording_urls?: Json | null
          reminders_config?: Json
          room_prefix: string
          scheduled_at: string
          segment_last_synced_at?: string | null
          segment_resync_enabled?: boolean
          signup_enabled?: boolean
          status?: string
          target_segment?: Json
          template_audio_url?: string | null
          template_brief?: string | null
          template_generated_by?: string | null
          template_generations?: Json | null
          template_html?: string | null
          template_preheader?: string | null
          template_subject?: string | null
          template_wa_text?: string | null
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_capacity?: number | null
          venue_complement?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_map_url?: string | null
          venue_name?: string | null
          wa_template_id?: string | null
          whatsapp_group_label?: string | null
          whatsapp_group_url?: string | null
        }
        Update: {
          broadcast_group_jids?: Json | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          email_template_id?: string | null
          event_format?: string
          host_user_id?: string | null
          id?: string
          max_per_room?: number
          public_signup_token?: string | null
          recording_destination?: string
          recording_enabled?: boolean
          recording_target_module_id?: string | null
          recording_urls?: Json | null
          reminders_config?: Json
          room_prefix?: string
          scheduled_at?: string
          segment_last_synced_at?: string | null
          segment_resync_enabled?: boolean
          signup_enabled?: boolean
          status?: string
          target_segment?: Json
          template_audio_url?: string | null
          template_brief?: string | null
          template_generated_by?: string | null
          template_generations?: Json | null
          template_html?: string | null
          template_preheader?: string | null
          template_subject?: string | null
          template_wa_text?: string | null
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_capacity?: number | null
          venue_complement?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_map_url?: string | null
          venue_name?: string | null
          wa_template_id?: string | null
          whatsapp_group_label?: string | null
          whatsapp_group_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collective_events_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      community_announcements: {
        Row: {
          created_at: string | null
          description: string
          icon_type: string | null
          id: string
          is_active: boolean | null
          member_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          icon_type?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          icon_type?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_announcements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["id"]
          },
        ]
      }
      community_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string
          event_time: string
          id: string
          is_online: boolean | null
          location: string
          registration_url: string | null
          spots_remaining: number | null
          spots_total: number | null
          status: string | null
          tier_required: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date: string
          event_time: string
          id?: string
          is_online?: boolean | null
          location: string
          registration_url?: string | null
          spots_remaining?: number | null
          spots_total?: number | null
          status?: string | null
          tier_required?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_time?: string
          id?: string
          is_online?: boolean | null
          location?: string
          registration_url?: string | null
          spots_remaining?: number | null
          spots_total?: number | null
          status?: string | null
          tier_required?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      community_members: {
        Row: {
          category: string
          company_name: string
          created_at: string | null
          description: string | null
          id: string
          instagram: string | null
          is_active: boolean | null
          is_new: boolean | null
          linkedin: string | null
          name: string
          profile_photo_url: string | null
          services: string[] | null
          tier: string
          updated_at: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          category: string
          company_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          is_new?: boolean | null
          linkedin?: string | null
          name: string
          profile_photo_url?: string | null
          services?: string[] | null
          tier?: string
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          category?: string
          company_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          is_new?: boolean | null
          linkedin?: string | null
          name?: string
          profile_photo_url?: string | null
          services?: string[] | null
          tier?: string
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      contract_broadcast: {
        Row: {
          contract_id: string | null
          created_at: string | null
          error: string | null
          id: string
          member_id: string | null
          message: string | null
          name: string | null
          phone: string | null
          request_id: number | null
          scheduled_at: string | null
          sent_at: string | null
          sign_token: string | null
          status: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          member_id?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          request_id?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          sign_token?: string | null
          status?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          member_id?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          request_id?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          sign_token?: string | null
          status?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          activity_type: string
          board_id: string | null
          board_name: string | null
          created_at: string | null
          description: string
          from_column_name: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          to_column_name: string | null
        }
        Insert: {
          activity_type: string
          board_id?: string | null
          board_name?: string | null
          created_at?: string | null
          description: string
          from_column_name?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          to_column_name?: string | null
        }
        Update: {
          activity_type?: string
          board_id?: string | null
          board_name?: string | null
          created_at?: string | null
          description?: string
          from_column_name?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          to_column_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_boards: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_call_reminders: {
        Row: {
          created_at: string | null
          id: string
          is_dismissed: boolean | null
          is_notified: boolean | null
          lead_id: string | null
          reminder_minutes_before: number | null
          scheduled_at: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_notified?: boolean | null
          lead_id?: string | null
          reminder_minutes_before?: number | null
          scheduled_at: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_notified?: boolean | null
          lead_id?: string | null
          reminder_minutes_before?: number | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_call_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_call_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_columns: {
        Row: {
          board_id: string | null
          color: string | null
          created_at: string | null
          id: string
          is_final_stage: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          board_id?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_final_stage?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          board_id?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_final_stage?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          ai_analysis: Json | null
          area_interesse: string | null
          assigned_to: string | null
          authorized_mural: boolean | null
          birthday: string | null
          board_id: string | null
          call_reminder_sent: boolean | null
          chatbot_paused_until: string | null
          closed_at: string | null
          column_id: string | null
          company_name: string | null
          cpf: string | null
          created_at: string | null
          deal_value: number | null
          disc_morning_blast_sent_at: string | null
          disc_profile: string | null
          disc_scores: Json | null
          email: string | null
          email_opted_out: boolean | null
          email_opted_out_at: string | null
          equipe_faixa: string | null
          evento: string | null
          expectativa_mc: string | null
          expectativa_mc_extra: string | null
          face_descriptor: Json | null
          face_url: string | null
          faturamento_faixa: string | null
          ferramentas_ia: string[] | null
          first_contact_at: string | null
          id: string
          instagram: string | null
          instagram_profile_pic_url: string | null
          instagram_raw: Json | null
          kirvano_amount: number | null
          kirvano_finalized_at: string | null
          kirvano_method: string | null
          kirvano_offer_id: string | null
          kirvano_transaction_id: string | null
          kirvano_utm: Json | null
          last_interaction_at: string | null
          lead_score: number | null
          lost_reason: string | null
          masterclass_recovery_sent_at: string | null
          maturidade_ia: string | null
          name: string
          notes: string | null
          onboarding_completed_at: string | null
          onboarding_token: string | null
          perfil_profissional: string | null
          post_sale_stage: string | null
          potential_value: number | null
          priority: string | null
          receptivo_mentoria: string | null
          scheduled_call_at: string | null
          shared_stories: boolean | null
          sort_order: number | null
          source: string | null
          source_lead_id: string | null
          tags: string[] | null
          tipo_negocio: string | null
          updated_at: string | null
          whatsapp: string
          whatsapp_opt_in: boolean | null
          whatsapp_opt_in_at: string | null
          whatsapp_opt_in_source: string | null
          whatsapp_profile_pic_url: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          area_interesse?: string | null
          assigned_to?: string | null
          authorized_mural?: boolean | null
          birthday?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string | null
          deal_value?: number | null
          disc_morning_blast_sent_at?: string | null
          disc_profile?: string | null
          disc_scores?: Json | null
          email?: string | null
          email_opted_out?: boolean | null
          email_opted_out_at?: string | null
          equipe_faixa?: string | null
          evento?: string | null
          expectativa_mc?: string | null
          expectativa_mc_extra?: string | null
          face_descriptor?: Json | null
          face_url?: string | null
          faturamento_faixa?: string | null
          ferramentas_ia?: string[] | null
          first_contact_at?: string | null
          id?: string
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          instagram_raw?: Json | null
          kirvano_amount?: number | null
          kirvano_finalized_at?: string | null
          kirvano_method?: string | null
          kirvano_offer_id?: string | null
          kirvano_transaction_id?: string | null
          kirvano_utm?: Json | null
          last_interaction_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          masterclass_recovery_sent_at?: string | null
          maturidade_ia?: string | null
          name: string
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_token?: string | null
          perfil_profissional?: string | null
          post_sale_stage?: string | null
          potential_value?: number | null
          priority?: string | null
          receptivo_mentoria?: string | null
          scheduled_call_at?: string | null
          shared_stories?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          tipo_negocio?: string | null
          updated_at?: string | null
          whatsapp: string
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_source?: string | null
          whatsapp_profile_pic_url?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          area_interesse?: string | null
          assigned_to?: string | null
          authorized_mural?: boolean | null
          birthday?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string | null
          deal_value?: number | null
          disc_morning_blast_sent_at?: string | null
          disc_profile?: string | null
          disc_scores?: Json | null
          email?: string | null
          email_opted_out?: boolean | null
          email_opted_out_at?: string | null
          equipe_faixa?: string | null
          evento?: string | null
          expectativa_mc?: string | null
          expectativa_mc_extra?: string | null
          face_descriptor?: Json | null
          face_url?: string | null
          faturamento_faixa?: string | null
          ferramentas_ia?: string[] | null
          first_contact_at?: string | null
          id?: string
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          instagram_raw?: Json | null
          kirvano_amount?: number | null
          kirvano_finalized_at?: string | null
          kirvano_method?: string | null
          kirvano_offer_id?: string | null
          kirvano_transaction_id?: string | null
          kirvano_utm?: Json | null
          last_interaction_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          masterclass_recovery_sent_at?: string | null
          maturidade_ia?: string | null
          name?: string
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_token?: string | null
          perfil_profissional?: string | null
          post_sale_stage?: string | null
          potential_value?: number | null
          priority?: string | null
          receptivo_mentoria?: string | null
          scheduled_call_at?: string | null
          shared_stories?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          tipo_negocio?: string | null
          updated_at?: string | null
          whatsapp?: string
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_source?: string | null
          whatsapp_profile_pic_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "crm_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads_backup_dedup_20260626: {
        Row: {
          ai_analysis: Json | null
          area_interesse: string | null
          assigned_to: string | null
          authorized_mural: boolean | null
          birthday: string | null
          board_id: string | null
          call_reminder_sent: boolean | null
          chatbot_paused_until: string | null
          closed_at: string | null
          column_id: string | null
          company_name: string | null
          cpf: string | null
          created_at: string | null
          deal_value: number | null
          disc_morning_blast_sent_at: string | null
          disc_profile: string | null
          disc_scores: Json | null
          email: string | null
          email_opted_out: boolean | null
          email_opted_out_at: string | null
          equipe_faixa: string | null
          evento: string | null
          expectativa_mc: string | null
          expectativa_mc_extra: string | null
          face_descriptor: Json | null
          face_url: string | null
          faturamento_faixa: string | null
          ferramentas_ia: string[] | null
          first_contact_at: string | null
          id: string | null
          instagram: string | null
          instagram_profile_pic_url: string | null
          instagram_raw: Json | null
          kirvano_amount: number | null
          kirvano_finalized_at: string | null
          kirvano_method: string | null
          kirvano_offer_id: string | null
          kirvano_transaction_id: string | null
          kirvano_utm: Json | null
          last_interaction_at: string | null
          lead_score: number | null
          lost_reason: string | null
          masterclass_recovery_sent_at: string | null
          maturidade_ia: string | null
          name: string | null
          notes: string | null
          onboarding_completed_at: string | null
          onboarding_token: string | null
          perfil_profissional: string | null
          post_sale_stage: string | null
          potential_value: number | null
          priority: string | null
          receptivo_mentoria: string | null
          scheduled_call_at: string | null
          shared_stories: boolean | null
          sort_order: number | null
          source: string | null
          source_lead_id: string | null
          tags: string[] | null
          tipo_negocio: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_opt_in: boolean | null
          whatsapp_opt_in_at: string | null
          whatsapp_opt_in_source: string | null
          whatsapp_profile_pic_url: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          area_interesse?: string | null
          assigned_to?: string | null
          authorized_mural?: boolean | null
          birthday?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string | null
          deal_value?: number | null
          disc_morning_blast_sent_at?: string | null
          disc_profile?: string | null
          disc_scores?: Json | null
          email?: string | null
          email_opted_out?: boolean | null
          email_opted_out_at?: string | null
          equipe_faixa?: string | null
          evento?: string | null
          expectativa_mc?: string | null
          expectativa_mc_extra?: string | null
          face_descriptor?: Json | null
          face_url?: string | null
          faturamento_faixa?: string | null
          ferramentas_ia?: string[] | null
          first_contact_at?: string | null
          id?: string | null
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          instagram_raw?: Json | null
          kirvano_amount?: number | null
          kirvano_finalized_at?: string | null
          kirvano_method?: string | null
          kirvano_offer_id?: string | null
          kirvano_transaction_id?: string | null
          kirvano_utm?: Json | null
          last_interaction_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          masterclass_recovery_sent_at?: string | null
          maturidade_ia?: string | null
          name?: string | null
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_token?: string | null
          perfil_profissional?: string | null
          post_sale_stage?: string | null
          potential_value?: number | null
          priority?: string | null
          receptivo_mentoria?: string | null
          scheduled_call_at?: string | null
          shared_stories?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          tipo_negocio?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_source?: string | null
          whatsapp_profile_pic_url?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          area_interesse?: string | null
          assigned_to?: string | null
          authorized_mural?: boolean | null
          birthday?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string | null
          deal_value?: number | null
          disc_morning_blast_sent_at?: string | null
          disc_profile?: string | null
          disc_scores?: Json | null
          email?: string | null
          email_opted_out?: boolean | null
          email_opted_out_at?: string | null
          equipe_faixa?: string | null
          evento?: string | null
          expectativa_mc?: string | null
          expectativa_mc_extra?: string | null
          face_descriptor?: Json | null
          face_url?: string | null
          faturamento_faixa?: string | null
          ferramentas_ia?: string[] | null
          first_contact_at?: string | null
          id?: string | null
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          instagram_raw?: Json | null
          kirvano_amount?: number | null
          kirvano_finalized_at?: string | null
          kirvano_method?: string | null
          kirvano_offer_id?: string | null
          kirvano_transaction_id?: string | null
          kirvano_utm?: Json | null
          last_interaction_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          masterclass_recovery_sent_at?: string | null
          maturidade_ia?: string | null
          name?: string | null
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_token?: string | null
          perfil_profissional?: string | null
          post_sale_stage?: string | null
          potential_value?: number | null
          priority?: string | null
          receptivo_mentoria?: string | null
          scheduled_call_at?: string | null
          shared_stories?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          tipo_negocio?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_source?: string | null
          whatsapp_profile_pic_url?: string | null
        }
        Relationships: []
      }
      crm_leads_backup_phone_norm_20260707: {
        Row: {
          ai_analysis: Json | null
          area_interesse: string | null
          assigned_to: string | null
          authorized_mural: boolean | null
          birthday: string | null
          board_id: string | null
          call_reminder_sent: boolean | null
          chatbot_paused_until: string | null
          closed_at: string | null
          column_id: string | null
          company_name: string | null
          cpf: string | null
          created_at: string | null
          deal_value: number | null
          disc_morning_blast_sent_at: string | null
          disc_profile: string | null
          disc_scores: Json | null
          email: string | null
          email_opted_out: boolean | null
          email_opted_out_at: string | null
          equipe_faixa: string | null
          evento: string | null
          expectativa_mc: string | null
          expectativa_mc_extra: string | null
          face_descriptor: Json | null
          face_url: string | null
          faturamento_faixa: string | null
          ferramentas_ia: string[] | null
          first_contact_at: string | null
          id: string | null
          instagram: string | null
          instagram_profile_pic_url: string | null
          instagram_raw: Json | null
          kirvano_amount: number | null
          kirvano_finalized_at: string | null
          kirvano_method: string | null
          kirvano_offer_id: string | null
          kirvano_transaction_id: string | null
          kirvano_utm: Json | null
          last_interaction_at: string | null
          lead_score: number | null
          lost_reason: string | null
          masterclass_recovery_sent_at: string | null
          maturidade_ia: string | null
          name: string | null
          notes: string | null
          onboarding_completed_at: string | null
          onboarding_token: string | null
          perfil_profissional: string | null
          post_sale_stage: string | null
          potential_value: number | null
          priority: string | null
          receptivo_mentoria: string | null
          scheduled_call_at: string | null
          shared_stories: boolean | null
          sort_order: number | null
          source: string | null
          source_lead_id: string | null
          tags: string[] | null
          tipo_negocio: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_opt_in: boolean | null
          whatsapp_opt_in_at: string | null
          whatsapp_opt_in_source: string | null
          whatsapp_profile_pic_url: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          area_interesse?: string | null
          assigned_to?: string | null
          authorized_mural?: boolean | null
          birthday?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string | null
          deal_value?: number | null
          disc_morning_blast_sent_at?: string | null
          disc_profile?: string | null
          disc_scores?: Json | null
          email?: string | null
          email_opted_out?: boolean | null
          email_opted_out_at?: string | null
          equipe_faixa?: string | null
          evento?: string | null
          expectativa_mc?: string | null
          expectativa_mc_extra?: string | null
          face_descriptor?: Json | null
          face_url?: string | null
          faturamento_faixa?: string | null
          ferramentas_ia?: string[] | null
          first_contact_at?: string | null
          id?: string | null
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          instagram_raw?: Json | null
          kirvano_amount?: number | null
          kirvano_finalized_at?: string | null
          kirvano_method?: string | null
          kirvano_offer_id?: string | null
          kirvano_transaction_id?: string | null
          kirvano_utm?: Json | null
          last_interaction_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          masterclass_recovery_sent_at?: string | null
          maturidade_ia?: string | null
          name?: string | null
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_token?: string | null
          perfil_profissional?: string | null
          post_sale_stage?: string | null
          potential_value?: number | null
          priority?: string | null
          receptivo_mentoria?: string | null
          scheduled_call_at?: string | null
          shared_stories?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          tipo_negocio?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_source?: string | null
          whatsapp_profile_pic_url?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          area_interesse?: string | null
          assigned_to?: string | null
          authorized_mural?: boolean | null
          birthday?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string | null
          deal_value?: number | null
          disc_morning_blast_sent_at?: string | null
          disc_profile?: string | null
          disc_scores?: Json | null
          email?: string | null
          email_opted_out?: boolean | null
          email_opted_out_at?: string | null
          equipe_faixa?: string | null
          evento?: string | null
          expectativa_mc?: string | null
          expectativa_mc_extra?: string | null
          face_descriptor?: Json | null
          face_url?: string | null
          faturamento_faixa?: string | null
          ferramentas_ia?: string[] | null
          first_contact_at?: string | null
          id?: string | null
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          instagram_raw?: Json | null
          kirvano_amount?: number | null
          kirvano_finalized_at?: string | null
          kirvano_method?: string | null
          kirvano_offer_id?: string | null
          kirvano_transaction_id?: string | null
          kirvano_utm?: Json | null
          last_interaction_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          masterclass_recovery_sent_at?: string | null
          maturidade_ia?: string | null
          name?: string | null
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_token?: string | null
          perfil_profissional?: string | null
          post_sale_stage?: string | null
          potential_value?: number | null
          priority?: string | null
          receptivo_mentoria?: string | null
          scheduled_call_at?: string | null
          shared_stories?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          tipo_negocio?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_opt_in?: boolean | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_source?: string | null
          whatsapp_profile_pic_url?: string | null
        }
        Relationships: []
      }
      cs_agent_config: {
        Row: {
          id: number
          knowledge: string | null
          min_gap_seconds: number
          model: string
          persona: string
          reply_max_chars: number
          rules: string
          updated_at: string
        }
        Insert: {
          id?: number
          knowledge?: string | null
          min_gap_seconds?: number
          model?: string
          persona: string
          reply_max_chars?: number
          rules: string
          updated_at?: string
        }
        Update: {
          id?: number
          knowledge?: string | null
          min_gap_seconds?: number
          model?: string
          persona?: string
          reply_max_chars?: number
          rules?: string
          updated_at?: string
        }
        Relationships: []
      }
      dedup_merge_log: {
        Row: {
          canonical_id: string | null
          dupe_ids: string[] | null
          id: number
          merged_at: string | null
          reason: string | null
          result: Json | null
        }
        Insert: {
          canonical_id?: string | null
          dupe_ids?: string[] | null
          id?: number
          merged_at?: string | null
          reason?: string | null
          result?: Json | null
        }
        Update: {
          canonical_id?: string | null
          dupe_ids?: string[] | null
          id?: number
          merged_at?: string | null
          reason?: string | null
          result?: Json | null
        }
        Relationships: []
      }
      disc_pdf_requests: {
        Row: {
          attempts: number | null
          error_msg: string | null
          id: string
          lead_id: string
          message_variant: number | null
          requested_at: string | null
          sent_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          error_msg?: string | null
          id?: string
          lead_id: string
          message_variant?: number | null
          requested_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          error_msg?: string | null
          id?: string
          lead_id?: string
          message_variant?: number | null
          requested_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disc_pdf_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disc_pdf_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      disc_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      drive_boards: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      drive_card_files: {
        Row: {
          card_id: string
          created_at: string
          file_id: string
          id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          file_id: string
          id?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          file_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_card_files_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "drive_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_card_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "drive_files"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_cards: {
        Row: {
          assignee_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          label_color: string | null
          list_id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          assignee_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          label_color?: string | null
          list_id: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          assignee_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          label_color?: string | null
          list_id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_cards_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "drive_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_files: {
        Row: {
          created_at: string
          file_key: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          folder_id: string | null
          id: string
          mime: string | null
          name: string
          thumbnail_url: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_key?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder_id?: string | null
          id?: string
          mime?: string | null
          name: string
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_key?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder_id?: string | null
          id?: string
          mime?: string | null
          name?: string
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_folders: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_lists: {
        Row: {
          board_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "drive_lists_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "drive_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_runs: {
        Row: {
          automation_id: string | null
          completed_at: string | null
          context: Json | null
          current_node_id: string | null
          id: string
          lead_id: string | null
          scheduled_next_at: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          automation_id?: string | null
          completed_at?: string | null
          context?: Json | null
          current_node_id?: string | null
          id?: string
          lead_id?: string | null
          scheduled_next_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          automation_id?: string | null
          completed_at?: string | null
          context?: Json | null
          current_node_id?: string | null
          id?: string
          lead_id?: string | null
          scheduled_next_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          flow_json: Json | null
          id: string
          is_active: boolean | null
          name: string
          trigger_event: string | null
          trigger_filter: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          flow_json?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_event?: string | null
          trigger_filter?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          flow_json?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_event?: string | null
          trigger_filter?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_campaign_leads: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          email: string
          error_message: string | null
          id: string
          lead_id: string | null
          opened_at: string | null
          resend_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience_filters: Json | null
          automation_id: string | null
          completed_at: string | null
          content_json: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          failed_count: number | null
          from_email: string | null
          from_name: string | null
          html_cache: string | null
          html_content: string | null
          id: string
          list_id: string | null
          name: string
          preheader: string | null
          reply_to: string | null
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number | null
          settings: Json | null
          source_type: string
          started_at: string | null
          status: string
          subject: string
          template_id: string | null
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_leads: number | null
          total_opened: number | null
          total_recipients: number | null
          total_sent: number | null
          total_unsubscribed: number | null
          updated_at: string | null
        }
        Insert: {
          audience_filters?: Json | null
          automation_id?: string | null
          completed_at?: string | null
          content_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          failed_count?: number | null
          from_email?: string | null
          from_name?: string | null
          html_cache?: string | null
          html_content?: string | null
          id?: string
          list_id?: string | null
          name: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          settings?: Json | null
          source_type?: string
          started_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_leads?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string | null
        }
        Update: {
          audience_filters?: Json | null
          automation_id?: string | null
          completed_at?: string | null
          content_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          failed_count?: number | null
          from_email?: string | null
          from_name?: string | null
          html_cache?: string | null
          html_content?: string | null
          id?: string
          list_id?: string | null
          name?: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          settings?: Json | null
          source_type?: string
          started_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_leads?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_config: {
        Row: {
          app_url: string | null
          company_address: string | null
          company_name: string | null
          created_at: string | null
          domain_verified: boolean | null
          from_email: string | null
          from_name: string | null
          id: string
          is_active: boolean | null
          reply_to: string | null
          resend_api_key: string | null
          resend_webhook_secret: string | null
          updated_at: string | null
        }
        Insert: {
          app_url?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string | null
          domain_verified?: boolean | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_active?: boolean | null
          reply_to?: string | null
          resend_api_key?: string | null
          resend_webhook_secret?: string | null
          updated_at?: string | null
        }
        Update: {
          app_url?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string | null
          domain_verified?: boolean | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_active?: boolean | null
          reply_to?: string | null
          resend_api_key?: string | null
          resend_webhook_secret?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          send_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          send_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          send_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      email_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          criteria: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          is_dynamic: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_dynamic?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_dynamic?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          automation_run_id: string | null
          bounce_reason: string | null
          bounced_at: string | null
          campaign_id: string | null
          click_count: number | null
          clicked_at: string | null
          clicked_url: string | null
          created_at: string | null
          delivered_at: string | null
          device_type: string | null
          email: string
          error_message: string | null
          html: string | null
          id: string
          lead_id: string | null
          open_count: number | null
          opened_at: string | null
          resend_id: string | null
          sent_at: string | null
          status: string | null
          unsubscribed_at: string | null
          user_agent: string | null
        }
        Insert: {
          automation_run_id?: string | null
          bounce_reason?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          clicked_url?: string | null
          created_at?: string | null
          delivered_at?: string | null
          device_type?: string | null
          email: string
          error_message?: string | null
          html?: string | null
          id?: string
          lead_id?: string | null
          open_count?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Update: {
          automation_run_id?: string | null
          bounce_reason?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          clicked_url?: string | null
          created_at?: string | null
          delivered_at?: string | null
          device_type?: string | null
          email?: string
          error_message?: string | null
          html?: string | null
          id?: string
          lead_id?: string | null
          open_count?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      email_subscribers: {
        Row: {
          bounce_reason: string | null
          consent_at: string | null
          consent_ip: string | null
          consent_source: string | null
          created_at: string | null
          email: string
          id: string
          lead_id: string | null
          status: string
          unsubscribe_token: string | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          bounce_reason?: string | null
          consent_at?: string | null
          consent_ip?: string | null
          consent_source?: string | null
          created_at?: string | null
          email: string
          id?: string
          lead_id?: string | null
          status?: string
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          bounce_reason?: string | null
          consent_at?: string | null
          consent_ip?: string | null
          consent_source?: string | null
          created_at?: string | null
          email?: string
          id?: string
          lead_id?: string | null
          status?: string
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_subscribers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_subscribers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string | null
          content_json: Json | null
          created_at: string | null
          created_by: string | null
          html_content: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          preheader: string | null
          subject: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          html_content?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          preheader?: string | null
          subject?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          html_content?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          preheader?: string | null
          subject?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          email: string
          id: string
          reason: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          amount: number | null
          checked_in_at: string | null
          checked_in_by: string | null
          checkin_code: string
          company: string | null
          cpf: string | null
          created_at: string
          crm_lead_id: string | null
          email: string | null
          event_id: string
          gateway_invoice_url: string | null
          gateway_payment_id: string | null
          id: string
          instagram: string | null
          instagram_data: Json | null
          instagram_profile_pic_url: string | null
          instagram_scraped_at: string | null
          member_payment_id: string | null
          name: string
          notes: string | null
          origin: string
          payment_method: string | null
          payment_status: string
          product: string | null
          product_slug: string | null
          role: string | null
          sales_event_id: string | null
          tickets_checked_in: number
          tickets_total: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          amount?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_code?: string
          company?: string | null
          cpf?: string | null
          created_at?: string
          crm_lead_id?: string | null
          email?: string | null
          event_id: string
          gateway_invoice_url?: string | null
          gateway_payment_id?: string | null
          id?: string
          instagram?: string | null
          instagram_data?: Json | null
          instagram_profile_pic_url?: string | null
          instagram_scraped_at?: string | null
          member_payment_id?: string | null
          name: string
          notes?: string | null
          origin?: string
          payment_method?: string | null
          payment_status?: string
          product?: string | null
          product_slug?: string | null
          role?: string | null
          sales_event_id?: string | null
          tickets_checked_in?: number
          tickets_total?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          amount?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_code?: string
          company?: string | null
          cpf?: string | null
          created_at?: string
          crm_lead_id?: string | null
          email?: string | null
          event_id?: string
          gateway_invoice_url?: string | null
          gateway_payment_id?: string | null
          id?: string
          instagram?: string | null
          instagram_data?: Json | null
          instagram_profile_pic_url?: string | null
          instagram_scraped_at?: string | null
          member_payment_id?: string | null
          name?: string
          notes?: string | null
          origin?: string
          payment_method?: string | null
          payment_status?: string
          product?: string | null
          product_slug?: string | null
          role?: string | null
          sales_event_id?: string | null
          tickets_checked_in?: number
          tickets_total?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "collective_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_group_broadcasts: {
        Row: {
          event_id: string
          group_jid: string
          milestone: string
          sent_at: string | null
        }
        Insert: {
          event_id: string
          group_jid: string
          milestone: string
          sent_at?: string | null
        }
        Update: {
          event_id?: string
          group_jid?: string
          milestone?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      event_interactions: {
        Row: {
          content: string | null
          created_at: string | null
          event_id: string | null
          id: string
          invite_token: string | null
          lead_id: string | null
          score: number | null
          type: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          invite_token?: string | null
          lead_id?: string | null
          score?: number | null
          type?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          invite_token?: string | null
          lead_id?: string | null
          score?: number | null
          type?: string | null
        }
        Relationships: []
      }
      event_planning: {
        Row: {
          branding_belief: string | null
          branding_enemy: Json | null
          branding_language: Json | null
          branding_ritual: Json | null
          created_at: string
          current_phase: number
          event_name: string | null
          founders: Json | null
          generated_playbook: Json | null
          icp_desires: Json | null
          icp_identity: Json | null
          icp_objections: Json | null
          icp_pains: Json | null
          id: string
          positioning_differential: Json | null
          positioning_transformation: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          branding_belief?: string | null
          branding_enemy?: Json | null
          branding_language?: Json | null
          branding_ritual?: Json | null
          created_at?: string
          current_phase?: number
          event_name?: string | null
          founders?: Json | null
          generated_playbook?: Json | null
          icp_desires?: Json | null
          icp_identity?: Json | null
          icp_objections?: Json | null
          icp_pains?: Json | null
          id?: string
          positioning_differential?: Json | null
          positioning_transformation?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          branding_belief?: string | null
          branding_enemy?: Json | null
          branding_language?: Json | null
          branding_ritual?: Json | null
          created_at?: string
          current_phase?: number
          event_name?: string | null
          founders?: Json | null
          generated_playbook?: Json | null
          icp_desires?: Json | null
          icp_identity?: Json | null
          icp_objections?: Json | null
          icp_pains?: Json | null
          id?: string
          positioning_differential?: Json | null
          positioning_transformation?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          attended: boolean | null
          event_id: string
          id: string
          profile_id: string
          registered_at: string | null
        }
        Insert: {
          attended?: boolean | null
          event_id: string
          id?: string
          profile_id: string
          registered_at?: string | null
        }
        Update: {
          attended?: boolean | null
          event_id?: string
          id?: string
          profile_id?: string
          registered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_template_library: {
        Row: {
          audio_url: string | null
          brief: string | null
          created_at: string
          created_by: string | null
          html_content: string
          id: string
          is_favorite: boolean | null
          last_used_at: string | null
          model: string | null
          name: string
          preheader: string | null
          source_event_id: string | null
          subject: string | null
          tags: string[] | null
          updated_at: string
          used_count: number | null
          wa_text: string | null
        }
        Insert: {
          audio_url?: string | null
          brief?: string | null
          created_at?: string
          created_by?: string | null
          html_content: string
          id?: string
          is_favorite?: boolean | null
          last_used_at?: string | null
          model?: string | null
          name: string
          preheader?: string | null
          source_event_id?: string | null
          subject?: string | null
          tags?: string[] | null
          updated_at?: string
          used_count?: number | null
          wa_text?: string | null
        }
        Update: {
          audio_url?: string | null
          brief?: string | null
          created_at?: string
          created_by?: string | null
          html_content?: string
          id?: string
          is_favorite?: boolean | null
          last_used_at?: string | null
          model?: string | null
          name?: string
          preheader?: string | null
          source_event_id?: string | null
          subject?: string | null
          tags?: string[] | null
          updated_at?: string
          used_count?: number | null
          wa_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_template_library_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "collective_events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string
          event_time: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          faixas_permitidas: Database["public"]["Enums"]["faixa"][]
          id: string
          is_active: boolean | null
          location: string | null
          meeting_url: string | null
          spots_remaining: number | null
          title: string
          total_spots: number | null
          treinador_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          faixas_permitidas?: Database["public"]["Enums"]["faixa"][]
          id?: string
          is_active?: boolean | null
          location?: string | null
          meeting_url?: string | null
          spots_remaining?: number | null
          title: string
          total_spots?: number | null
          treinador_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          faixas_permitidas?: Database["public"]["Enums"]["faixa"][]
          id?: string
          is_active?: boolean | null
          location?: string | null
          meeting_url?: string | null
          spots_remaining?: number | null
          title?: string
          total_spots?: number | null
          treinador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_treinador_id_fkey"
            columns: ["treinador_id"]
            isOneToOne: false
            referencedRelation: "treinadores"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_projections: {
        Row: {
          agent_capacity_factor: number
          agent_count: number
          agent_hours_monthly: number
          agent_monthly_cost: number
          areas_comparison: Json
          created_at: string
          employee_count: number
          employee_hours_monthly: number
          employee_salary: number
          employee_tax_rate: number
          id: string
          is_active: boolean
          name: string
          new_clients_per_month: number
          optimization_value: number
          projection_months: number
          setup_value: number
          updated_at: string
        }
        Insert: {
          agent_capacity_factor?: number
          agent_count?: number
          agent_hours_monthly?: number
          agent_monthly_cost?: number
          areas_comparison?: Json
          created_at?: string
          employee_count?: number
          employee_hours_monthly?: number
          employee_salary?: number
          employee_tax_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          new_clients_per_month?: number
          optimization_value?: number
          projection_months?: number
          setup_value?: number
          updated_at?: string
        }
        Update: {
          agent_capacity_factor?: number
          agent_count?: number
          agent_hours_monthly?: number
          agent_monthly_cost?: number
          areas_comparison?: Json
          created_at?: string
          employee_count?: number
          employee_hours_monthly?: number
          employee_salary?: number
          employee_tax_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          new_clients_per_month?: number
          optimization_value?: number
          projection_months?: number
          setup_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      glossary_terms: {
        Row: {
          aliases: string[] | null
          analogy: string | null
          category: string
          created_at: string | null
          definition: string
          emoji: string | null
          id: string
          is_published: boolean | null
          sort_order: number | null
          term: string
          updated_at: string | null
        }
        Insert: {
          aliases?: string[] | null
          analogy?: string | null
          category?: string
          created_at?: string | null
          definition: string
          emoji?: string | null
          id?: string
          is_published?: boolean | null
          sort_order?: number | null
          term: string
          updated_at?: string | null
        }
        Update: {
          aliases?: string[] | null
          analogy?: string | null
          category?: string
          created_at?: string | null
          definition?: string
          emoji?: string | null
          id?: string
          is_published?: boolean | null
          sort_order?: number | null
          term?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          owner_id: string
          refresh_token: string
          scope: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          owner_id: string
          refresh_token: string
          scope?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          owner_id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      instagram_snapshots: {
        Row: {
          avg_comments: number | null
          avg_likes: number | null
          biography: string | null
          category: string | null
          created_at: string
          engagement_rate: number | null
          external_url: string | null
          followers: number
          following: number
          full_name: string | null
          id: string
          is_business: boolean | null
          is_private: boolean | null
          is_verified: boolean | null
          lead_id: string
          posts_count: number
          posts_last_30d: number | null
          posts_metrics: Json | null
          profile_pic_url: string | null
          raw_posts: Json | null
          raw_profile: Json | null
          scraped_at: string
          top_hashtags: string[] | null
          username: string
        }
        Insert: {
          avg_comments?: number | null
          avg_likes?: number | null
          biography?: string | null
          category?: string | null
          created_at?: string
          engagement_rate?: number | null
          external_url?: string | null
          followers?: number
          following?: number
          full_name?: string | null
          id?: string
          is_business?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          lead_id: string
          posts_count?: number
          posts_last_30d?: number | null
          posts_metrics?: Json | null
          profile_pic_url?: string | null
          raw_posts?: Json | null
          raw_profile?: Json | null
          scraped_at?: string
          top_hashtags?: string[] | null
          username: string
        }
        Update: {
          avg_comments?: number | null
          avg_likes?: number | null
          biography?: string | null
          category?: string | null
          created_at?: string
          engagement_rate?: number | null
          external_url?: string | null
          followers?: number
          following?: number
          full_name?: string | null
          id?: string
          is_business?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          lead_id?: string
          posts_count?: number
          posts_last_30d?: number | null
          posts_metrics?: Json | null
          profile_pic_url?: string | null
          raw_posts?: Json | null
          raw_profile?: Json | null
          scraped_at?: string
          top_hashtags?: string[] | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_snapshots_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_snapshots_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_keys: {
        Row: {
          account_id: string | null
          api_key: string | null
          api_secret: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          service: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          api_key?: string | null
          api_secret?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          service: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          api_key?: string | null
          api_secret?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          service?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_conversation_insights: {
        Row: {
          analyzed_at: string
          id: string
          interest_level: number | null
          key_topics: Json | null
          lead_id: string
          message_count: number | null
          metadata: Json | null
          objections: Json | null
          opportunities: Json | null
          pain_points: Json | null
          raw_summary: string | null
          sentiment: string | null
          suggested_actions: Json | null
        }
        Insert: {
          analyzed_at?: string
          id?: string
          interest_level?: number | null
          key_topics?: Json | null
          lead_id: string
          message_count?: number | null
          metadata?: Json | null
          objections?: Json | null
          opportunities?: Json | null
          pain_points?: Json | null
          raw_summary?: string | null
          sentiment?: string | null
          suggested_actions?: Json | null
        }
        Update: {
          analyzed_at?: string
          id?: string
          interest_level?: number | null
          key_topics?: Json | null
          lead_id?: string
          message_count?: number | null
          metadata?: Json | null
          objections?: Json | null
          opportunities?: Json | null
          pain_points?: Json | null
          raw_summary?: string | null
          sentiment?: string | null
          suggested_actions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversation_insights_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_insights_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cidade: string | null
          cor: string | null
          created_at: string
          ddd: string | null
          emoji: string | null
          estado: string | null
          id: string
          instagram: string | null
          instagram_data: Json | null
          instagram_profile_pic_url: string | null
          mensagem: string | null
          mensagem_personalizada: string | null
          name: string
          region: string | null
          source: string | null
          updated_at: string
          webhook_sent: boolean | null
          webhook_sent_at: string | null
          whatsapp: string
        }
        Insert: {
          cidade?: string | null
          cor?: string | null
          created_at?: string
          ddd?: string | null
          emoji?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          instagram_data?: Json | null
          instagram_profile_pic_url?: string | null
          mensagem?: string | null
          mensagem_personalizada?: string | null
          name: string
          region?: string | null
          source?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
          whatsapp: string
        }
        Update: {
          cidade?: string | null
          cor?: string | null
          created_at?: string
          ddd?: string | null
          emoji?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          instagram_data?: Json | null
          instagram_profile_pic_url?: string | null
          mensagem?: string | null
          mensagem_personalizada?: string | null
          name?: string
          region?: string | null
          source?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      lesson_recording_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          lesson_id: string | null
          meeting_id: string | null
          module_id: string | null
          pdf_url: string | null
          source: string | null
          status: string | null
          step: string | null
          title: string
          transcription: string | null
          updated_at: string | null
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          lesson_id?: string | null
          meeting_id?: string | null
          module_id?: string | null
          pdf_url?: string | null
          source?: string | null
          status?: string | null
          step?: string | null
          title: string
          transcription?: string | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          lesson_id?: string | null
          meeting_id?: string | null
          module_id?: string | null
          pdf_url?: string | null
          source?: string | null
          status?: string | null
          step?: string | null
          title?: string
          transcription?: string | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: []
      }
      marketing_ai_messages: {
        Row: {
          agent: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          agent?: string | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          agent?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketing_ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ai_outputs: {
        Row: {
          agent: string
          briefing: Json | null
          created_at: string | null
          id: string
          initiative_id: string | null
          raw_text: string | null
          resultado: Json | null
          session_id: string | null
          status: string | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          agent: string
          briefing?: Json | null
          created_at?: string | null
          id?: string
          initiative_id?: string | null
          raw_text?: string | null
          resultado?: Json | null
          session_id?: string | null
          status?: string | null
          tipo: string
          titulo?: string | null
        }
        Update: {
          agent?: string
          briefing?: Json | null
          created_at?: string | null
          id?: string
          initiative_id?: string | null
          raw_text?: string | null
          resultado?: Json | null
          session_id?: string | null
          status?: string | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ai_outputs_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "marketing_initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_ai_outputs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketing_ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ai_sessions: {
        Row: {
          briefing_id: string | null
          created_at: string | null
          id: string
          initiative_id: string | null
          resumo: string | null
          status: string | null
          titulo: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          briefing_id?: string | null
          created_at?: string | null
          id?: string
          initiative_id?: string | null
          resumo?: string | null
          status?: string | null
          titulo?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          briefing_id?: string | null
          created_at?: string | null
          id?: string
          initiative_id?: string | null
          resumo?: string | null
          status?: string | null
          titulo?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ai_sessions_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "marketing_briefing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_ai_sessions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "marketing_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_briefing: {
        Row: {
          aprendizados: Json | null
          budget_mensal: number | null
          canais: Json | null
          created_at: string | null
          desejos: Json | null
          dores: Json | null
          empresa: string
          formalidade: string | null
          id: string
          identidade_visual: Json | null
          is_default: boolean | null
          objetivo_default: string | null
          palavras_banidas: Json | null
          palavras_caracteristicas: Json | null
          produto_servico: string | null
          publico_perfil: string | null
          responsavel: string | null
          ticket_medio: number | null
          tipo_negocio: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aprendizados?: Json | null
          budget_mensal?: number | null
          canais?: Json | null
          created_at?: string | null
          desejos?: Json | null
          dores?: Json | null
          empresa: string
          formalidade?: string | null
          id?: string
          identidade_visual?: Json | null
          is_default?: boolean | null
          objetivo_default?: string | null
          palavras_banidas?: Json | null
          palavras_caracteristicas?: Json | null
          produto_servico?: string | null
          publico_perfil?: string | null
          responsavel?: string | null
          ticket_medio?: number | null
          tipo_negocio?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aprendizados?: Json | null
          budget_mensal?: number | null
          canais?: Json | null
          created_at?: string | null
          desejos?: Json | null
          dores?: Json | null
          empresa?: string
          formalidade?: string | null
          id?: string
          identidade_visual?: Json | null
          is_default?: boolean | null
          objetivo_default?: string | null
          palavras_banidas?: Json | null
          palavras_caracteristicas?: Json | null
          produto_servico?: string | null
          publico_perfil?: string | null
          responsavel?: string | null
          ticket_medio?: number | null
          tipo_negocio?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      marketing_briefing_presets: {
        Row: {
          briefing: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          briefing?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          briefing?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          budget: number | null
          conversions: number | null
          cpl: number | null
          created_at: string | null
          end_date: string | null
          id: string
          leads: number | null
          name: string
          notes: string | null
          platform: string | null
          spent: number | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          budget?: number | null
          conversions?: number | null
          cpl?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          leads?: number | null
          name: string
          notes?: string | null
          platform?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          budget?: number | null
          conversions?: number | null
          cpl?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          leads?: number | null
          name?: string
          notes?: string | null
          platform?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
      marketing_initiative_checklist: {
        Row: {
          created_at: string | null
          deadline: string | null
          descricao: string | null
          id: string
          initiative_id: string | null
          ordem: number
          prioridade: string | null
          responsavel: string | null
          status: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deadline?: string | null
          descricao?: string | null
          id?: string
          initiative_id?: string | null
          ordem: number
          prioridade?: string | null
          responsavel?: string | null
          status?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deadline?: string | null
          descricao?: string | null
          id?: string
          initiative_id?: string | null
          ordem?: number
          prioridade?: string | null
          responsavel?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_initiative_checklist_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "marketing_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_initiatives: {
        Row: {
          briefing_id: string | null
          budget: number | null
          cpa_max: number | null
          cpl_max: number | null
          created_at: string | null
          data_evento: string | null
          data_fim: string | null
          data_inicio: string | null
          fase: string | null
          id: string
          mecanismo: string | null
          nome: string
          notes: string | null
          objetivo: string | null
          produto: string | null
          promessa_principal: string | null
          publico_alvo: Json | null
          resultado: Json | null
          status: string | null
          ticket: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          briefing_id?: string | null
          budget?: number | null
          cpa_max?: number | null
          cpl_max?: number | null
          created_at?: string | null
          data_evento?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          fase?: string | null
          id?: string
          mecanismo?: string | null
          nome: string
          notes?: string | null
          objetivo?: string | null
          produto?: string | null
          promessa_principal?: string | null
          publico_alvo?: Json | null
          resultado?: Json | null
          status?: string | null
          ticket?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          briefing_id?: string | null
          budget?: number | null
          cpa_max?: number | null
          cpl_max?: number | null
          created_at?: string | null
          data_evento?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          fase?: string | null
          id?: string
          mecanismo?: string | null
          nome?: string
          notes?: string | null
          objetivo?: string | null
          produto?: string | null
          promessa_principal?: string | null
          publico_alvo?: Json | null
          resultado?: Json | null
          status?: string | null
          ticket?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_initiatives_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "marketing_briefing"
            referencedColumns: ["id"]
          },
        ]
      }
      meet_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_agent: boolean
          lk_id: string | null
          meeting_id: string | null
          room_name: string
          sender_identity: string | null
          sender_name: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_agent?: boolean
          lk_id?: string | null
          meeting_id?: string | null
          room_name: string
          sender_identity?: string | null
          sender_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_agent?: boolean
          lk_id?: string | null
          meeting_id?: string | null
          room_name?: string
          sender_identity?: string | null
          sender_name?: string | null
        }
        Relationships: []
      }
      meet_questions: {
        Row: {
          answered: boolean
          answered_at: string | null
          asker_identity: string | null
          asker_name: string | null
          content: string
          created_at: string
          id: string
          livekit_room_name: string | null
          meeting_id: string | null
        }
        Insert: {
          answered?: boolean
          answered_at?: string | null
          asker_identity?: string | null
          asker_name?: string | null
          content: string
          created_at?: string
          id?: string
          livekit_room_name?: string | null
          meeting_id?: string | null
        }
        Update: {
          answered?: boolean
          answered_at?: string | null
          asker_identity?: string | null
          asker_name?: string | null
          content?: string
          created_at?: string
          id?: string
          livekit_room_name?: string | null
          meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meet_questions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meet_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          livekit_room_name: string | null
          meeting_id: string | null
          participant_identity: string | null
          participant_name: string | null
          score: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          livekit_room_name?: string | null
          meeting_id?: string | null
          participant_identity?: string | null
          participant_name?: string | null
          score: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          livekit_room_name?: string | null
          meeting_id?: string | null
          participant_identity?: string | null
          participant_name?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "meet_ratings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_access_requests: {
        Row: {
          created_at: string | null
          decided_at: string | null
          id: string
          meeting_id: string
          member_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          id?: string
          meeting_id: string
          member_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          id?: string
          meeting_id?: string
          member_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_access_requests_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_access_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_schedules: {
        Row: {
          active: boolean | null
          allowed_programs: string[] | null
          created_at: string | null
          duration_minutes: number
          gated_programs: string[] | null
          host_name: string | null
          hour: number
          id: string
          minute: number
          target_module_id: string | null
          title: string
          weekday: number
        }
        Insert: {
          active?: boolean | null
          allowed_programs?: string[] | null
          created_at?: string | null
          duration_minutes?: number
          gated_programs?: string[] | null
          host_name?: string | null
          hour: number
          id?: string
          minute?: number
          target_module_id?: string | null
          title: string
          weekday: number
        }
        Update: {
          active?: boolean | null
          allowed_programs?: string[] | null
          created_at?: string | null
          duration_minutes?: number
          gated_programs?: string[] | null
          host_name?: string | null
          hour?: number
          id?: string
          minute?: number
          target_module_id?: string | null
          title?: string
          weekday?: number
        }
        Relationships: []
      }
      meetings: {
        Row: {
          ai_key_points: Json | null
          ai_processed_at: string | null
          ai_sentiment: string | null
          ai_suggested_tasks: Json | null
          ai_summary: string | null
          allowed_programs: string[] | null
          collective_event_id: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          gated_programs: string[] | null
          host_name: string | null
          id: string
          kind: string | null
          lead_id: string | null
          lesson_mode: boolean | null
          livekit_room_name: string | null
          meeting_url: string | null
          members_duration_minutes: number | null
          members_scheduled_at: string | null
          members_visible: boolean | null
          metadata: Json | null
          processing_error: string | null
          processing_step: string | null
          recording_status: string | null
          recording_url: string | null
          scheduled_at: string | null
          session_started_at: string | null
          started_at: string | null
          status: string
          support_description: string | null
          support_key: string | null
          support_materials: Json | null
          target_accelerator_id: string | null
          target_lesson_id: string | null
          target_lesson_title: string | null
          target_module_id: string | null
          title: string
          transcription: string | null
          transcriptions: Json | null
          user_id: string | null
        }
        Insert: {
          ai_key_points?: Json | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_suggested_tasks?: Json | null
          ai_summary?: string | null
          allowed_programs?: string[] | null
          collective_event_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          gated_programs?: string[] | null
          host_name?: string | null
          id?: string
          kind?: string | null
          lead_id?: string | null
          lesson_mode?: boolean | null
          livekit_room_name?: string | null
          meeting_url?: string | null
          members_duration_minutes?: number | null
          members_scheduled_at?: string | null
          members_visible?: boolean | null
          metadata?: Json | null
          processing_error?: string | null
          processing_step?: string | null
          recording_status?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          session_started_at?: string | null
          started_at?: string | null
          status?: string
          support_description?: string | null
          support_key?: string | null
          support_materials?: Json | null
          target_accelerator_id?: string | null
          target_lesson_id?: string | null
          target_lesson_title?: string | null
          target_module_id?: string | null
          title?: string
          transcription?: string | null
          transcriptions?: Json | null
          user_id?: string | null
        }
        Update: {
          ai_key_points?: Json | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_suggested_tasks?: Json | null
          ai_summary?: string | null
          allowed_programs?: string[] | null
          collective_event_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          gated_programs?: string[] | null
          host_name?: string | null
          id?: string
          kind?: string | null
          lead_id?: string | null
          lesson_mode?: boolean | null
          livekit_room_name?: string | null
          meeting_url?: string | null
          members_duration_minutes?: number | null
          members_scheduled_at?: string | null
          members_visible?: boolean | null
          metadata?: Json | null
          processing_error?: string | null
          processing_step?: string | null
          recording_status?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          session_started_at?: string | null
          started_at?: string | null
          status?: string
          support_description?: string | null
          support_key?: string | null
          support_materials?: Json | null
          target_accelerator_id?: string | null
          target_lesson_id?: string | null
          target_lesson_title?: string | null
          target_module_id?: string | null
          title?: string
          transcription?: string | null
          transcriptions?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contracts: {
        Row: {
          access_ends_on: string | null
          access_starts_on: string | null
          copy_sent_at: string | null
          copy_sent_channels: string[] | null
          created_at: string | null
          crm_lead_id: string | null
          entry_method: string | null
          entry_paid: boolean | null
          entry_paid_at: string | null
          entry_value: number | null
          gateway: string | null
          gateway_customer_id: string | null
          gateway_subscription_id: string | null
          id: string
          installment_value: number | null
          is_promise: boolean | null
          member_id: string | null
          modality_label: string | null
          notes: string | null
          num_installments: number | null
          payment_method: string | null
          payment_origin: string | null
          pdf_hash: string | null
          pdf_url: string | null
          product_label: string | null
          program: string | null
          promise_date: string | null
          promise_reminder_sent: boolean | null
          sign_token: string | null
          signature_drawing_url: string | null
          signature_ip: string | null
          signature_name_typed: string | null
          signature_required: boolean | null
          signature_status: string | null
          signature_user_agent: string | null
          signed_at: string | null
          signer_snapshot: Json | null
          status: string | null
          template_version: string | null
          total_value: number
          updated_at: string | null
          vigencia_months: number | null
        }
        Insert: {
          access_ends_on?: string | null
          access_starts_on?: string | null
          copy_sent_at?: string | null
          copy_sent_channels?: string[] | null
          created_at?: string | null
          crm_lead_id?: string | null
          entry_method?: string | null
          entry_paid?: boolean | null
          entry_paid_at?: string | null
          entry_value?: number | null
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          installment_value?: number | null
          is_promise?: boolean | null
          member_id?: string | null
          modality_label?: string | null
          notes?: string | null
          num_installments?: number | null
          payment_method?: string | null
          payment_origin?: string | null
          pdf_hash?: string | null
          pdf_url?: string | null
          product_label?: string | null
          program?: string | null
          promise_date?: string | null
          promise_reminder_sent?: boolean | null
          sign_token?: string | null
          signature_drawing_url?: string | null
          signature_ip?: string | null
          signature_name_typed?: string | null
          signature_required?: boolean | null
          signature_status?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signer_snapshot?: Json | null
          status?: string | null
          template_version?: string | null
          total_value: number
          updated_at?: string | null
          vigencia_months?: number | null
        }
        Update: {
          access_ends_on?: string | null
          access_starts_on?: string | null
          copy_sent_at?: string | null
          copy_sent_channels?: string[] | null
          created_at?: string | null
          crm_lead_id?: string | null
          entry_method?: string | null
          entry_paid?: boolean | null
          entry_paid_at?: string | null
          entry_value?: number | null
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          installment_value?: number | null
          is_promise?: boolean | null
          member_id?: string | null
          modality_label?: string | null
          notes?: string | null
          num_installments?: number | null
          payment_method?: string | null
          payment_origin?: string | null
          pdf_hash?: string | null
          pdf_url?: string | null
          product_label?: string | null
          program?: string | null
          promise_date?: string | null
          promise_reminder_sent?: boolean | null
          sign_token?: string | null
          signature_drawing_url?: string | null
          signature_ip?: string | null
          signature_name_typed?: string | null
          signature_required?: boolean | null
          signature_status?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signer_snapshot?: Json | null
          status?: string | null
          template_version?: string | null
          total_value?: number
          updated_at?: string | null
          vigencia_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_contracts_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contracts_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contracts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_files: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          documentation: string | null
          download_count: number | null
          env_example: string | null
          features: Json | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          import_methods: Json | null
          installation_guide: string | null
          is_active: boolean
          is_featured: boolean
          is_published: boolean
          long_description: string | null
          lovable_remix_url: string | null
          order_index: number
          prerequisites: Json | null
          publish_at: string | null
          related_module_id: string | null
          setup_time: string | null
          slug: string | null
          sql_migrations: string | null
          stack: Json | null
          tags: Json | null
          thumbnail: string | null
          title: string
          troubleshooting: string | null
          updated_at: string
          uploaded_by: string | null
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          documentation?: string | null
          download_count?: number | null
          env_example?: string | null
          features?: Json | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          import_methods?: Json | null
          installation_guide?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_published?: boolean
          long_description?: string | null
          lovable_remix_url?: string | null
          order_index?: number
          prerequisites?: Json | null
          publish_at?: string | null
          related_module_id?: string | null
          setup_time?: string | null
          slug?: string | null
          sql_migrations?: string | null
          stack?: Json | null
          tags?: Json | null
          thumbnail?: string | null
          title: string
          troubleshooting?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          documentation?: string | null
          download_count?: number | null
          env_example?: string | null
          features?: Json | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          import_methods?: Json | null
          installation_guide?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_published?: boolean
          long_description?: string | null
          lovable_remix_url?: string | null
          order_index?: number
          prerequisites?: Json | null
          publish_at?: string | null
          related_module_id?: string | null
          setup_time?: string | null
          slug?: string | null
          sql_migrations?: string | null
          stack?: Json | null
          tags?: Json | null
          thumbnail?: string | null
          title?: string
          troubleshooting?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      member_lessons: {
        Row: {
          ai_exercises: Json | null
          ai_key_points: Json | null
          ai_summary: string | null
          ai_timestamps: Json | null
          attachments: Json | null
          content_url: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean | null
          meeting_id: string | null
          module_id: string | null
          pdf_error: string | null
          pdf_started_at: string | null
          pdf_status: string | null
          pdf_url: string | null
          processing_status: string | null
          processing_step: string | null
          quiz_data: Json | null
          sort_order: number | null
          source: string | null
          support_description: string | null
          support_materials: Json | null
          thumbnail_url: string | null
          title: string
          transcription: string | null
          type: string | null
        }
        Insert: {
          ai_exercises?: Json | null
          ai_key_points?: Json | null
          ai_summary?: string | null
          ai_timestamps?: Json | null
          attachments?: Json | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          meeting_id?: string | null
          module_id?: string | null
          pdf_error?: string | null
          pdf_started_at?: string | null
          pdf_status?: string | null
          pdf_url?: string | null
          processing_status?: string | null
          processing_step?: string | null
          quiz_data?: Json | null
          sort_order?: number | null
          source?: string | null
          support_description?: string | null
          support_materials?: Json | null
          thumbnail_url?: string | null
          title: string
          transcription?: string | null
          type?: string | null
        }
        Update: {
          ai_exercises?: Json | null
          ai_key_points?: Json | null
          ai_summary?: string | null
          ai_timestamps?: Json | null
          attachments?: Json | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean | null
          meeting_id?: string | null
          module_id?: string | null
          pdf_error?: string | null
          pdf_started_at?: string | null
          pdf_status?: string | null
          pdf_url?: string | null
          processing_status?: string | null
          processing_step?: string | null
          quiz_data?: Json | null
          sort_order?: number | null
          source?: string | null
          support_description?: string | null
          support_materials?: Json | null
          thumbnail_url?: string | null
          title?: string
          transcription?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "member_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      member_milestones: {
        Row: {
          description: string | null
          earned_at: string | null
          id: string
          member_id: string | null
          milestone_name: string
          milestone_type: string
          xp_earned: number | null
        }
        Insert: {
          description?: string | null
          earned_at?: string | null
          id?: string
          member_id?: string | null
          milestone_name: string
          milestone_type: string
          xp_earned?: number | null
        }
        Update: {
          description?: string | null
          earned_at?: string | null
          id?: string
          member_id?: string | null
          milestone_name?: string
          milestone_type?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_milestones_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_modules: {
        Row: {
          allowed_programs: string[] | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_locked: boolean | null
          is_published: boolean | null
          required_level: string | null
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          total_lessons: number | null
        }
        Insert: {
          allowed_programs?: string[] | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_locked?: boolean | null
          is_published?: boolean | null
          required_level?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          total_lessons?: number | null
        }
        Update: {
          allowed_programs?: string[] | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_locked?: boolean | null
          is_published?: boolean | null
          required_level?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          total_lessons?: number | null
        }
        Relationships: []
      }
      member_payments: {
        Row: {
          blocked_at_5d: boolean | null
          contract_id: string | null
          created_at: string | null
          due_date: string
          gateway_invoice_url: string | null
          gateway_payment_id: string | null
          id: string
          installment_number: number
          member_id: string | null
          notes: string | null
          paid_at: string | null
          paid_value: number | null
          payment_method: string | null
          payment_origin: string | null
          reminder_2d_sent: boolean | null
          reminder_3d_overdue_sent: boolean | null
          reminder_5d_sent: boolean | null
          reminder_due_sent: boolean | null
          status: string | null
          value: number
        }
        Insert: {
          blocked_at_5d?: boolean | null
          contract_id?: string | null
          created_at?: string | null
          due_date: string
          gateway_invoice_url?: string | null
          gateway_payment_id?: string | null
          id?: string
          installment_number: number
          member_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          payment_origin?: string | null
          reminder_2d_sent?: boolean | null
          reminder_3d_overdue_sent?: boolean | null
          reminder_5d_sent?: boolean | null
          reminder_due_sent?: boolean | null
          status?: string | null
          value: number
        }
        Update: {
          blocked_at_5d?: boolean | null
          contract_id?: string | null
          created_at?: string | null
          due_date?: string
          gateway_invoice_url?: string | null
          gateway_payment_id?: string | null
          id?: string
          installment_number?: number
          member_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          payment_origin?: string | null
          reminder_2d_sent?: boolean | null
          reminder_3d_overdue_sent?: boolean | null
          reminder_5d_sent?: boolean | null
          reminder_due_sent?: boolean | null
          status?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "member_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string | null
          member_id: string | null
          progress_percent: number | null
          quiz_score: number | null
          status: string | null
          time_spent_minutes: number | null
          updated_at: string | null
          video_position_seconds: number | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          member_id?: string | null
          progress_percent?: number | null
          quiz_score?: number | null
          status?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          video_position_seconds?: number | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          member_id?: string | null
          progress_percent?: number | null
          quiz_score?: number | null
          status?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          video_position_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "member_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_sessions: {
        Row: {
          device_info: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          ip_address: string | null
          member_id: string | null
          pages_visited: string[] | null
          started_at: string | null
        }
        Insert: {
          device_info?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          member_id?: string | null
          pages_visited?: string[] | null
          started_at?: string | null
        }
        Update: {
          device_info?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          member_id?: string | null
          pages_visited?: string[] | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          badges: string[] | null
          bio: string | null
          birth_date: string | null
          birthdate: string | null
          contratante_member_id: string | null
          cpf: string | null
          created_at: string | null
          credentials_sent_at: string | null
          crm_lead_id: string | null
          email: string
          enrollment_id: string | null
          id: string
          job_title: string | null
          last_active_at: string | null
          level: string | null
          marital_status: string | null
          member_role: string | null
          name: string
          nationality: string | null
          password_hash: string | null
          password_set_at: string | null
          phone: string
          profession: string | null
          program: string | null
          relationship: string | null
          rg: string | null
          session_device: string | null
          session_started_at: string | null
          session_token: string | null
          status: string | null
          streak_current: number | null
          streak_days: number | null
          streak_last_date: string | null
          streak_longest: number | null
          total_lessons_completed: number | null
          total_quizzes_completed: number | null
          total_time_minutes: number | null
          updated_at: string | null
          user_id: string | null
          welcome_message: string | null
          xp: number | null
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          birth_date?: string | null
          birthdate?: string | null
          contratante_member_id?: string | null
          cpf?: string | null
          created_at?: string | null
          credentials_sent_at?: string | null
          crm_lead_id?: string | null
          email: string
          enrollment_id?: string | null
          id?: string
          job_title?: string | null
          last_active_at?: string | null
          level?: string | null
          marital_status?: string | null
          member_role?: string | null
          name: string
          nationality?: string | null
          password_hash?: string | null
          password_set_at?: string | null
          phone: string
          profession?: string | null
          program?: string | null
          relationship?: string | null
          rg?: string | null
          session_device?: string | null
          session_started_at?: string | null
          session_token?: string | null
          status?: string | null
          streak_current?: number | null
          streak_days?: number | null
          streak_last_date?: string | null
          streak_longest?: number | null
          total_lessons_completed?: number | null
          total_quizzes_completed?: number | null
          total_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          welcome_message?: string | null
          xp?: number | null
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          birth_date?: string | null
          birthdate?: string | null
          contratante_member_id?: string | null
          cpf?: string | null
          created_at?: string | null
          credentials_sent_at?: string | null
          crm_lead_id?: string | null
          email?: string
          enrollment_id?: string | null
          id?: string
          job_title?: string | null
          last_active_at?: string | null
          level?: string | null
          marital_status?: string | null
          member_role?: string | null
          name?: string
          nationality?: string | null
          password_hash?: string | null
          password_set_at?: string | null
          phone?: string
          profession?: string | null
          program?: string | null
          relationship?: string | null
          rg?: string | null
          session_device?: string | null
          session_started_at?: string | null
          session_token?: string | null
          status?: string | null
          streak_current?: number | null
          streak_days?: number | null
          streak_last_date?: string | null
          streak_longest?: number | null
          total_lessons_completed?: number | null
          total_quizzes_completed?: number | null
          total_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          welcome_message?: string | null
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_contratante_member_id_fkey"
            columns: ["contratante_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          briefing_json: Json | null
          budget_total: number | null
          cpl_max: number | null
          created_at: string | null
          created_by: string | null
          id: string
          initiative_id: string | null
          last_insights_json: Json | null
          last_synced_at: string | null
          marketing_event_id: string | null
          meta_ad_ids: Json | null
          meta_adset_ids: Json | null
          meta_campaign_id: string
          meta_creative_ids: Json | null
          meta_image_hashes: Json | null
          name: string
          objective: string
          phase: string | null
          status: string | null
          ticket: number | null
          updated_at: string | null
        }
        Insert: {
          briefing_json?: Json | null
          budget_total?: number | null
          cpl_max?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          initiative_id?: string | null
          last_insights_json?: Json | null
          last_synced_at?: string | null
          marketing_event_id?: string | null
          meta_ad_ids?: Json | null
          meta_adset_ids?: Json | null
          meta_campaign_id: string
          meta_creative_ids?: Json | null
          meta_image_hashes?: Json | null
          name: string
          objective: string
          phase?: string | null
          status?: string | null
          ticket?: number | null
          updated_at?: string | null
        }
        Update: {
          briefing_json?: Json | null
          budget_total?: number | null
          cpl_max?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          initiative_id?: string | null
          last_insights_json?: Json | null
          last_synced_at?: string | null
          marketing_event_id?: string | null
          meta_ad_ids?: Json | null
          meta_adset_ids?: Json | null
          meta_campaign_id?: string
          meta_creative_ids?: Json | null
          meta_image_hashes?: Json | null
          name?: string
          objective?: string
          phase?: string | null
          status?: string | null
          ticket?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meta_custom_audiences: {
        Row: {
          created_at: string | null
          id: string
          last_sync_at: string | null
          last_sync_count: number | null
          last_sync_session_id: string | null
          meta_audience_id: string
          name: string
          parent_audience_id: string | null
          source_query: string | null
          source_type: string
          status: string | null
          subtype: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_count?: number | null
          last_sync_session_id?: string | null
          meta_audience_id: string
          name: string
          parent_audience_id?: string | null
          source_query?: string | null
          source_type: string
          status?: string | null
          subtype?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_count?: number | null
          last_sync_session_id?: string | null
          meta_audience_id?: string
          name?: string
          parent_audience_id?: string | null
          source_query?: string | null
          source_type?: string
          status?: string | null
          subtype?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_custom_audiences_parent_audience_id_fkey"
            columns: ["parent_audience_id"]
            isOneToOne: false
            referencedRelation: "meta_custom_audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_publish_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          meta_campaign_id: string | null
          request_json: Json | null
          response_json: Json | null
          step: string
          success: boolean
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          meta_campaign_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          step: string
          success?: boolean
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          meta_campaign_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          step?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meta_publish_log_meta_campaign_id_fkey"
            columns: ["meta_campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      metodo_squaad_enrollments: {
        Row: {
          ai_goals: string[] | null
          ai_level: string | null
          ai_tools_used: string | null
          biggest_challenge: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          company: string | null
          created_at: string | null
          crm_lead_id: string | null
          custom_goal: string | null
          email: string | null
          expectation: string | null
          id: string
          name: string
          onboarding_step: number | null
          onboarding_token: string | null
          payment_method: string | null
          payment_status: string | null
          payment_value: number | null
          personalized_plan: Json | null
          program: string | null
          reminder_sent_at: string | null
          role: string | null
          status: string | null
          updated_at: string | null
          uses_ai_tools: boolean | null
          weekly_hours: string | null
          whatsapp: string
        }
        Insert: {
          ai_goals?: string[] | null
          ai_level?: string | null
          ai_tools_used?: string | null
          biggest_challenge?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          company?: string | null
          created_at?: string | null
          crm_lead_id?: string | null
          custom_goal?: string | null
          email?: string | null
          expectation?: string | null
          id?: string
          name: string
          onboarding_step?: number | null
          onboarding_token?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_value?: number | null
          personalized_plan?: Json | null
          program?: string | null
          reminder_sent_at?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          uses_ai_tools?: boolean | null
          weekly_hours?: string | null
          whatsapp: string
        }
        Update: {
          ai_goals?: string[] | null
          ai_level?: string | null
          ai_tools_used?: string | null
          biggest_challenge?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          company?: string | null
          created_at?: string | null
          crm_lead_id?: string | null
          custom_goal?: string | null
          email?: string | null
          expectation?: string | null
          id?: string
          name?: string
          onboarding_step?: number | null
          onboarding_token?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_value?: number | null
          personalized_plan?: Json | null
          program?: string | null
          reminder_sent_at?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          uses_ai_tools?: boolean | null
          weekly_hours?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "metodo_squaad_enrollments_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metodo_squaad_enrollments_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          action_channel: string
          action_instance_id: string | null
          action_target_id: string | null
          action_target_phone: string | null
          action_target_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          id: string
          message_template: string
          name: string
          trigger_days: string[] | null
          trigger_event: string | null
          trigger_minutes: number | null
          trigger_time: string | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          action_channel: string
          action_instance_id?: string | null
          action_target_id?: string | null
          action_target_phone?: string | null
          action_target_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          message_template: string
          name: string
          trigger_days?: string[] | null
          trigger_event?: string | null
          trigger_minutes?: number | null
          trigger_time?: string | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          action_channel?: string
          action_instance_id?: string | null
          action_target_id?: string | null
          action_target_phone?: string | null
          action_target_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          message_template?: string
          name?: string
          trigger_days?: string[] | null
          trigger_event?: string | null
          trigger_minutes?: number | null
          trigger_time?: string | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_action_instance_id_fkey"
            columns: ["action_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          contract_id: string
          created_at: string
          due_date: string
          id: string
          month_reference: string
          payment_date: string | null
          status: string
          updated_at: string
          value: number
          webhook_sent: boolean | null
          webhook_sent_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          month_reference: string
          payment_date?: string | null
          status?: string
          updated_at?: string
          value: number
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          month_reference?: string
          payment_date?: string | null
          status?: string
          updated_at?: string
          value?: number
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "client_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          duration_label: string | null
          features: Json | null
          id: string
          ideal_for: string | null
          is_active: boolean | null
          name: string
          price_internal: number | null
          price_label: string | null
          slug: string
          sort_order: number | null
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_label?: string | null
          features?: Json | null
          id?: string
          ideal_for?: string | null
          is_active?: boolean | null
          name: string
          price_internal?: number | null
          price_label?: string | null
          slug: string
          sort_order?: number | null
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_label?: string | null
          features?: Json | null
          id?: string
          ideal_for?: string | null
          is_active?: boolean | null
          name?: string
          price_internal?: number | null
          price_label?: string | null
          slug?: string
          sort_order?: number | null
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_name: string
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          description: string | null
          email: string | null
          employee_count: string | null
          faixa: Database["public"]["Enums"]["faixa"]
          faixa_declarada: Database["public"]["Enums"]["faixa"] | null
          faixa_solicitada_em: string | null
          id: string
          instagram: string | null
          investment_amount: number | null
          is_approved: boolean | null
          is_new_member: boolean | null
          is_paid: boolean
          linkedin: string | null
          logo_url: string | null
          membership_expires_at: string
          membership_started_at: string
          nome_completo: string | null
          onboarding_completed: boolean | null
          owner_name: string
          photo_url: string | null
          profissao: string | null
          referral_code: string | null
          referred_by: string | null
          segment: string | null
          services: string[] | null
          telefone: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          website: string | null
          whatsapp: string | null
          years_in_business: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          description?: string | null
          email?: string | null
          employee_count?: string | null
          faixa?: Database["public"]["Enums"]["faixa"]
          faixa_declarada?: Database["public"]["Enums"]["faixa"] | null
          faixa_solicitada_em?: string | null
          id?: string
          instagram?: string | null
          investment_amount?: number | null
          is_approved?: boolean | null
          is_new_member?: boolean | null
          is_paid?: boolean
          linkedin?: string | null
          logo_url?: string | null
          membership_expires_at?: string
          membership_started_at?: string
          nome_completo?: string | null
          onboarding_completed?: boolean | null
          owner_name?: string
          photo_url?: string | null
          profissao?: string | null
          referral_code?: string | null
          referred_by?: string | null
          segment?: string | null
          services?: string[] | null
          telefone?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          website?: string | null
          whatsapp?: string | null
          years_in_business?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          description?: string | null
          email?: string | null
          employee_count?: string | null
          faixa?: Database["public"]["Enums"]["faixa"]
          faixa_declarada?: Database["public"]["Enums"]["faixa"] | null
          faixa_solicitada_em?: string | null
          id?: string
          instagram?: string | null
          investment_amount?: number | null
          is_approved?: boolean | null
          is_new_member?: boolean | null
          is_paid?: boolean
          linkedin?: string | null
          logo_url?: string | null
          membership_expires_at?: string
          membership_started_at?: string
          nome_completo?: string | null
          onboarding_completed?: boolean | null
          owner_name?: string
          photo_url?: string | null
          profissao?: string | null
          referral_code?: string | null
          referred_by?: string | null
          segment?: string | null
          services?: string[] | null
          telefone?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
          whatsapp?: string | null
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_buscas: {
        Row: {
          audience: string | null
          cidade: string | null
          created_at: string | null
          created_by_member_id: string | null
          created_by_user_id: string | null
          custo: number | null
          duracao_ms: number | null
          erro: string | null
          fontes_selecionadas: string[] | null
          id: string
          intent_detectada: Json | null
          limite_solicitado: number | null
          nicho: string | null
          query: string
          query_normalizada: string | null
          resultados_raw: Json | null
          status: string | null
          total_resultados: number | null
          uf: string | null
        }
        Insert: {
          audience?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          custo?: number | null
          duracao_ms?: number | null
          erro?: string | null
          fontes_selecionadas?: string[] | null
          id?: string
          intent_detectada?: Json | null
          limite_solicitado?: number | null
          nicho?: string | null
          query: string
          query_normalizada?: string | null
          resultados_raw?: Json | null
          status?: string | null
          total_resultados?: number | null
          uf?: string | null
        }
        Update: {
          audience?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          custo?: number | null
          duracao_ms?: number | null
          erro?: string | null
          fontes_selecionadas?: string[] | null
          id?: string
          intent_detectada?: Json | null
          limite_solicitado?: number | null
          nicho?: string | null
          query?: string
          query_normalizada?: string | null
          resultados_raw?: Json | null
          status?: string | null
          total_resultados?: number | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_buscas_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_diagnosticos: {
        Row: {
          achados_contexto_negocio: Json | null
          achados_doctoralia: Json | null
          achados_facebook: Json | null
          achados_google_ads: Json | null
          achados_ifood: Json | null
          achados_instagram: Json | null
          achados_linkedin: Json | null
          achados_maps: Json | null
          achados_meta_ads: Json | null
          achados_outros: Json | null
          achados_pagespeed: Json | null
          achados_posicao_google: Json | null
          achados_reclame_aqui: Json | null
          achados_site: Json | null
          achados_tiktok: Json | null
          achados_youtube: Json | null
          audience: string | null
          busca_id: string | null
          created_at: string | null
          created_by_member_id: string | null
          created_by_user_id: string | null
          custo_total: number | null
          erro: string | null
          fontes_consultadas: string[] | null
          fontes_falhadas: string[] | null
          fontes_pendentes: string[] | null
          id: string
          lead_descoberto_id: string | null
          oportunidades: Json | null
          pdf_imagens_urls: string[] | null
          pdf_url: string | null
          resumo_executivo: string | null
          score_atracao: number | null
          score_conversao: number | null
          score_doctoralia: number | null
          score_facebook: number | null
          score_geral: number | null
          score_google_ads: number | null
          score_google_maps: number | null
          score_ifood: number | null
          score_instagram: number | null
          score_linkedin: number | null
          score_meta_ads: number | null
          score_outros: Json | null
          score_pagespeed: number | null
          score_posicao_google: number | null
          score_qualificacao: number | null
          score_reclame_aqui: number | null
          score_retencao: number | null
          score_site: number | null
          score_tiktok: number | null
          score_youtube: number | null
          status: string | null
          tempo_analise_ms: number | null
          updated_at: string | null
        }
        Insert: {
          achados_contexto_negocio?: Json | null
          achados_doctoralia?: Json | null
          achados_facebook?: Json | null
          achados_google_ads?: Json | null
          achados_ifood?: Json | null
          achados_instagram?: Json | null
          achados_linkedin?: Json | null
          achados_maps?: Json | null
          achados_meta_ads?: Json | null
          achados_outros?: Json | null
          achados_pagespeed?: Json | null
          achados_posicao_google?: Json | null
          achados_reclame_aqui?: Json | null
          achados_site?: Json | null
          achados_tiktok?: Json | null
          achados_youtube?: Json | null
          audience?: string | null
          busca_id?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          custo_total?: number | null
          erro?: string | null
          fontes_consultadas?: string[] | null
          fontes_falhadas?: string[] | null
          fontes_pendentes?: string[] | null
          id?: string
          lead_descoberto_id?: string | null
          oportunidades?: Json | null
          pdf_imagens_urls?: string[] | null
          pdf_url?: string | null
          resumo_executivo?: string | null
          score_atracao?: number | null
          score_conversao?: number | null
          score_doctoralia?: number | null
          score_facebook?: number | null
          score_geral?: number | null
          score_google_ads?: number | null
          score_google_maps?: number | null
          score_ifood?: number | null
          score_instagram?: number | null
          score_linkedin?: number | null
          score_meta_ads?: number | null
          score_outros?: Json | null
          score_pagespeed?: number | null
          score_posicao_google?: number | null
          score_qualificacao?: number | null
          score_reclame_aqui?: number | null
          score_retencao?: number | null
          score_site?: number | null
          score_tiktok?: number | null
          score_youtube?: number | null
          status?: string | null
          tempo_analise_ms?: number | null
          updated_at?: string | null
        }
        Update: {
          achados_contexto_negocio?: Json | null
          achados_doctoralia?: Json | null
          achados_facebook?: Json | null
          achados_google_ads?: Json | null
          achados_ifood?: Json | null
          achados_instagram?: Json | null
          achados_linkedin?: Json | null
          achados_maps?: Json | null
          achados_meta_ads?: Json | null
          achados_outros?: Json | null
          achados_pagespeed?: Json | null
          achados_posicao_google?: Json | null
          achados_reclame_aqui?: Json | null
          achados_site?: Json | null
          achados_tiktok?: Json | null
          achados_youtube?: Json | null
          audience?: string | null
          busca_id?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          custo_total?: number | null
          erro?: string | null
          fontes_consultadas?: string[] | null
          fontes_falhadas?: string[] | null
          fontes_pendentes?: string[] | null
          id?: string
          lead_descoberto_id?: string | null
          oportunidades?: Json | null
          pdf_imagens_urls?: string[] | null
          pdf_url?: string | null
          resumo_executivo?: string | null
          score_atracao?: number | null
          score_conversao?: number | null
          score_doctoralia?: number | null
          score_facebook?: number | null
          score_geral?: number | null
          score_google_ads?: number | null
          score_google_maps?: number | null
          score_ifood?: number | null
          score_instagram?: number | null
          score_linkedin?: number | null
          score_meta_ads?: number | null
          score_outros?: Json | null
          score_pagespeed?: number | null
          score_posicao_google?: number | null
          score_qualificacao?: number | null
          score_reclame_aqui?: number | null
          score_retencao?: number | null
          score_site?: number | null
          score_tiktok?: number | null
          score_youtube?: number | null
          status?: string | null
          tempo_analise_ms?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_diagnosticos_busca_id_fkey"
            columns: ["busca_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_buscas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_diagnosticos_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_diagnosticos_lead_descoberto_id_fkey"
            columns: ["lead_descoberto_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_leads_descobertos"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_leads_descobertos: {
        Row: {
          audience: string | null
          bairro: string | null
          busca_id: string | null
          categoria: string | null
          cidade: string | null
          created_at: string | null
          created_by_member_id: string | null
          created_by_user_id: string | null
          deal_id: string | null
          endereco: string | null
          facebook_url: string | null
          faixa_preco: string | null
          id: string
          instagram_handle: string | null
          lead_id: string | null
          linkedin_url: string | null
          member_lead_id: string | null
          nome: string
          nota_google: number | null
          qtd_avaliacoes: number | null
          raw_data: Json | null
          selecionado_para_analise: boolean | null
          status: string | null
          telefone: string | null
          tiktok_handle: string | null
          uf: string | null
          updated_at: string | null
          url_maps: string | null
          url_site: string | null
          virou_lead_em: string | null
          youtube_url: string | null
        }
        Insert: {
          audience?: string | null
          bairro?: string | null
          busca_id?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          deal_id?: string | null
          endereco?: string | null
          facebook_url?: string | null
          faixa_preco?: string | null
          id?: string
          instagram_handle?: string | null
          lead_id?: string | null
          linkedin_url?: string | null
          member_lead_id?: string | null
          nome: string
          nota_google?: number | null
          qtd_avaliacoes?: number | null
          raw_data?: Json | null
          selecionado_para_analise?: boolean | null
          status?: string | null
          telefone?: string | null
          tiktok_handle?: string | null
          uf?: string | null
          updated_at?: string | null
          url_maps?: string | null
          url_site?: string | null
          virou_lead_em?: string | null
          youtube_url?: string | null
        }
        Update: {
          audience?: string | null
          bairro?: string | null
          busca_id?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          deal_id?: string | null
          endereco?: string | null
          facebook_url?: string | null
          faixa_preco?: string | null
          id?: string
          instagram_handle?: string | null
          lead_id?: string | null
          linkedin_url?: string | null
          member_lead_id?: string | null
          nome?: string
          nota_google?: number | null
          qtd_avaliacoes?: number | null
          raw_data?: Json | null
          selecionado_para_analise?: boolean | null
          status?: string | null
          telefone?: string | null
          tiktok_handle?: string | null
          uf?: string | null
          updated_at?: string | null
          url_maps?: string | null
          url_site?: string | null
          virou_lead_em?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_leads_descobertos_busca_id_fkey"
            columns: ["busca_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_buscas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_leads_descobertos_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_member_leads: {
        Row: {
          categoria: string | null
          cidade: string | null
          created_at: string | null
          data_fechamento: string | null
          dm_canal: string | null
          dm_enviada: boolean | null
          dm_enviada_em: string | null
          dm_texto: string | null
          email: string | null
          id: string
          instagram: string | null
          member_id: string
          metadata: Json | null
          motivo_perda: string | null
          nome: string
          notes: string | null
          origem: string | null
          prospeccao_diagnostico_id: string | null
          prospeccao_lead_descoberto_id: string | null
          site: string | null
          status: string
          tags: string[] | null
          uf: string | null
          updated_at: string | null
          valor_proposta: number | null
          whatsapp: string | null
        }
        Insert: {
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          data_fechamento?: string | null
          dm_canal?: string | null
          dm_enviada?: boolean | null
          dm_enviada_em?: string | null
          dm_texto?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          member_id: string
          metadata?: Json | null
          motivo_perda?: string | null
          nome: string
          notes?: string | null
          origem?: string | null
          prospeccao_diagnostico_id?: string | null
          prospeccao_lead_descoberto_id?: string | null
          site?: string | null
          status?: string
          tags?: string[] | null
          uf?: string | null
          updated_at?: string | null
          valor_proposta?: number | null
          whatsapp?: string | null
        }
        Update: {
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          data_fechamento?: string | null
          dm_canal?: string | null
          dm_enviada?: boolean | null
          dm_enviada_em?: string | null
          dm_texto?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          member_id?: string
          metadata?: Json | null
          motivo_perda?: string | null
          nome?: string
          notes?: string | null
          origem?: string | null
          prospeccao_diagnostico_id?: string | null
          prospeccao_lead_descoberto_id?: string | null
          site?: string | null
          status?: string
          tags?: string[] | null
          uf?: string | null
          updated_at?: string | null
          valor_proposta?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_member_leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_member_leads_prospeccao_diagnostico_id_fkey"
            columns: ["prospeccao_diagnostico_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_diagnosticos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_member_leads_prospeccao_lead_descoberto_id_fkey"
            columns: ["prospeccao_lead_descoberto_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_leads_descobertos"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_member_quotas: {
        Row: {
          analises_used_this_month: number | null
          buscas_used_this_month: number | null
          created_at: string | null
          current_period_start: string | null
          is_paid: boolean | null
          last_used_at: string | null
          member_id: string
          monthly_limit: number | null
          paid_until: string | null
          plan_name: string | null
          total_analises_lifetime: number | null
          total_buscas_lifetime: number | null
          total_custo_lifetime: number | null
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          analises_used_this_month?: number | null
          buscas_used_this_month?: number | null
          created_at?: string | null
          current_period_start?: string | null
          is_paid?: boolean | null
          last_used_at?: string | null
          member_id: string
          monthly_limit?: number | null
          paid_until?: string | null
          plan_name?: string | null
          total_analises_lifetime?: number | null
          total_buscas_lifetime?: number | null
          total_custo_lifetime?: number | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          analises_used_this_month?: number | null
          buscas_used_this_month?: number | null
          created_at?: string | null
          current_period_start?: string | null
          is_paid?: boolean | null
          last_used_at?: string | null
          member_id?: string
          monthly_limit?: number | null
          paid_until?: string | null
          plan_name?: string | null
          total_analises_lifetime?: number | null
          total_buscas_lifetime?: number | null
          total_custo_lifetime?: number | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_member_quotas_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_prompts_config: {
        Row: {
          ai_model: string | null
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          key: string
          label: string
          prompt_text: string
          temperature: number | null
          tom_voz: string | null
          updated_at: string | null
          variables_help: Json | null
        }
        Insert: {
          ai_model?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          label: string
          prompt_text: string
          temperature?: number | null
          tom_voz?: string | null
          updated_at?: string | null
          variables_help?: Json | null
        }
        Update: {
          ai_model?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          label?: string
          prompt_text?: string
          temperature?: number | null
          tom_voz?: string | null
          updated_at?: string | null
          variables_help?: Json | null
        }
        Relationships: []
      }
      prospeccao_templates_nicho: {
        Row: {
          created_at: string | null
          custo_estimado_lead: number | null
          descricao: string | null
          display_name: string
          emoji: string | null
          fontes_obrigatorias: string[] | null
          fontes_opcionais: string[] | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          nicho: string
          pesos_score: Json | null
          prompt_oportunidades: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custo_estimado_lead?: number | null
          descricao?: string | null
          display_name: string
          emoji?: string | null
          fontes_obrigatorias?: string[] | null
          fontes_opcionais?: string[] | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          nicho: string
          pesos_score?: Json | null
          prompt_oportunidades?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custo_estimado_lead?: number | null
          descricao?: string | null
          display_name?: string
          emoji?: string | null
          fontes_obrigatorias?: string[] | null
          fontes_opcionais?: string[] | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          nicho?: string
          pesos_score?: Json | null
          prompt_oportunidades?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prospeccao_uso_api: {
        Row: {
          api_provider: string
          audience: string | null
          busca_id: string | null
          created_at: string | null
          created_by_member_id: string | null
          created_by_user_id: string | null
          custo: number | null
          duracao_ms: number | null
          endpoint: string | null
          erro: string | null
          fonte: string | null
          id: string
          lead_descoberto_id: string | null
          metadata: Json | null
          sucesso: boolean | null
        }
        Insert: {
          api_provider: string
          audience?: string | null
          busca_id?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          custo?: number | null
          duracao_ms?: number | null
          endpoint?: string | null
          erro?: string | null
          fonte?: string | null
          id?: string
          lead_descoberto_id?: string | null
          metadata?: Json | null
          sucesso?: boolean | null
        }
        Update: {
          api_provider?: string
          audience?: string | null
          busca_id?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          created_by_user_id?: string | null
          custo?: number | null
          duracao_ms?: number | null
          endpoint?: string | null
          erro?: string | null
          fonte?: string | null
          id?: string
          lead_descoberto_id?: string | null
          metadata?: Json | null
          sucesso?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_uso_api_busca_id_fkey"
            columns: ["busca_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_buscas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_uso_api_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_uso_api_lead_descoberto_id_fkey"
            columns: ["lead_descoberto_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_leads_descobertos"
            referencedColumns: ["id"]
          },
        ]
      }
      r10x_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      reels_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          progress: number | null
          result: Json | null
          status: string
          step: string | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id: string
          progress?: number | null
          result?: Json | null
          status?: string
          step?: string | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          progress?: number | null
          result?: Json | null
          status?: string
          step?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          codigo: string
          created_at: string
          destino: string
          id: string
          referer: string | null
          referrer_id: string | null
          user_agent: string | null
          utm: Json | null
        }
        Insert: {
          codigo: string
          created_at?: string
          destino?: string
          id?: string
          referer?: string | null
          referrer_id?: string | null
          user_agent?: string | null
          utm?: Json | null
        }
        Update: {
          codigo?: string
          created_at?: string
          destino?: string
          id?: string
          referer?: string | null
          referrer_id?: string | null
          user_agent?: string | null
          utm?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_conversions: {
        Row: {
          codigo: string
          created_at: string
          id: string
          indicado_email: string | null
          indicado_lead_id: string | null
          indicado_profile_id: string | null
          indicado_telefone: string | null
          origem: string
          origem_id: string | null
          pontos: number
          produto: string
          referrer_id: string
          valor: number
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          indicado_email?: string | null
          indicado_lead_id?: string | null
          indicado_profile_id?: string | null
          indicado_telefone?: string | null
          origem?: string
          origem_id?: string | null
          pontos?: number
          produto: string
          referrer_id: string
          valor?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          indicado_email?: string | null
          indicado_lead_id?: string | null
          indicado_profile_id?: string | null
          indicado_telefone?: string | null
          origem?: string
          origem_id?: string | null
          pontos?: number
          produto?: string
          referrer_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_conversions_indicado_profile_id_fkey"
            columns: ["indicado_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_conversions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_stats: {
        Row: {
          id: string
          pending_referrals: number | null
          profile_id: string
          rank_position: number | null
          total_referrals: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          pending_referrals?: number | null
          profile_id: string
          rank_position?: number | null
          total_referrals?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          pending_referrals?: number | null
          profile_id?: string
          rank_position?: number | null
          total_referrals?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          approved_at: string | null
          counted_for_upgrade: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string
          referred_faixa: Database["public"]["Enums"]["faixa"] | null
          referred_id: string
          referrer_id: string
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          approved_at?: string | null
          counted_for_upgrade?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          referred_faixa?: Database["public"]["Enums"]["faixa"] | null
          referred_id: string
          referrer_id: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          approved_at?: string | null
          counted_for_upgrade?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          referred_faixa?: Database["public"]["Enums"]["faixa"] | null
          referred_id?: string
          referrer_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_events: {
        Row: {
          amount: number
          celebrated_at: string | null
          created_at: string | null
          crm_board_id: string | null
          crm_lead_id: string | null
          currency: string | null
          dedupe_key: string | null
          email: string | null
          id: string
          instagram: string | null
          instagram_profile_pic_url: string | null
          is_celebrated: boolean | null
          name: string
          payment_method: string | null
          product_name: string
          product_slug: string | null
          raw_payload: Json | null
          source: string | null
          transaction_id: string | null
          whatsapp: string
        }
        Insert: {
          amount?: number
          celebrated_at?: string | null
          created_at?: string | null
          crm_board_id?: string | null
          crm_lead_id?: string | null
          currency?: string | null
          dedupe_key?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          is_celebrated?: boolean | null
          name: string
          payment_method?: string | null
          product_name: string
          product_slug?: string | null
          raw_payload?: Json | null
          source?: string | null
          transaction_id?: string | null
          whatsapp: string
        }
        Update: {
          amount?: number
          celebrated_at?: string | null
          created_at?: string | null
          crm_board_id?: string | null
          crm_lead_id?: string | null
          currency?: string | null
          dedupe_key?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          is_celebrated?: boolean | null
          name?: string
          payment_method?: string | null
          product_name?: string
          product_slug?: string | null
          raw_payload?: Json | null
          source?: string | null
          transaction_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_events_crm_board_id_fkey"
            columns: ["crm_board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_events_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_events_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_playbooks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          phases: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          phases?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          phases?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sales_ranking: {
        Row: {
          contribution_amount: number | null
          contribution_paid: boolean | null
          eligible_for_spotlight: boolean | null
          id: string
          profile_id: string
          rank_position: number | null
          total_deals: number | null
          total_sales: number | null
          updated_at: string | null
        }
        Insert: {
          contribution_amount?: number | null
          contribution_paid?: boolean | null
          eligible_for_spotlight?: boolean | null
          id?: string
          profile_id: string
          rank_position?: number | null
          total_deals?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Update: {
          contribution_amount?: number | null
          contribution_paid?: boolean | null
          eligible_for_spotlight?: boolean | null
          id?: string
          profile_id?: string
          rank_position?: number | null
          total_deals?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      social_selling_automations: {
        Row: {
          cadence_config: Json | null
          created_at: string | null
          description: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          on_reply_config: Json | null
          qualification_config: Json | null
          rate_limit_overrides: Json | null
          trigger_config: Json | null
          trigger_type: string | null
          updated_at: string | null
        }
        Insert: {
          cadence_config?: Json | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          on_reply_config?: Json | null
          qualification_config?: Json | null
          rate_limit_overrides?: Json | null
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
        }
        Update: {
          cadence_config?: Json | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          on_reply_config?: Json | null
          qualification_config?: Json | null
          rate_limit_overrides?: Json | null
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      social_selling_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      social_selling_enrollments: {
        Row: {
          automation_id: string | null
          completed_at: string | null
          created_at: string | null
          current_day: number | null
          flow_config: Json | null
          id: string
          instagram_username: string | null
          last_action_at: string | null
          last_visited_at: string | null
          lead_id: string | null
          metadata: Json | null
          next_action_at: string | null
          started_at: string | null
          status: string | null
          total_days: number | null
        }
        Insert: {
          automation_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_day?: number | null
          flow_config?: Json | null
          id?: string
          instagram_username?: string | null
          last_action_at?: string | null
          last_visited_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          next_action_at?: string | null
          started_at?: string | null
          status?: string | null
          total_days?: number | null
        }
        Update: {
          automation_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_day?: number | null
          flow_config?: Json | null
          id?: string
          instagram_username?: string | null
          last_action_at?: string | null
          last_visited_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          next_action_at?: string | null
          started_at?: string | null
          status?: string | null
          total_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_selling_enrollments_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "social_selling_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_selling_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_selling_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      social_selling_ig_posts: {
        Row: {
          caption: string | null
          code: string
          comment_count: number | null
          created_at: string | null
          id: string
          instagram_profile_id: string | null
          like_count: number | null
          media_url: string | null
          metadata: Json | null
          permalink: string | null
          stored_media_url: string | null
          taken_at: string | null
        }
        Insert: {
          caption?: string | null
          code: string
          comment_count?: number | null
          created_at?: string | null
          id?: string
          instagram_profile_id?: string | null
          like_count?: number | null
          media_url?: string | null
          metadata?: Json | null
          permalink?: string | null
          stored_media_url?: string | null
          taken_at?: string | null
        }
        Update: {
          caption?: string | null
          code?: string
          comment_count?: number | null
          created_at?: string | null
          id?: string
          instagram_profile_id?: string | null
          like_count?: number | null
          media_url?: string | null
          metadata?: Json | null
          permalink?: string | null
          stored_media_url?: string | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_selling_ig_posts_instagram_profile_id_fkey"
            columns: ["instagram_profile_id"]
            isOneToOne: false
            referencedRelation: "social_selling_ig_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_selling_ig_profiles: {
        Row: {
          biography: string | null
          category: string | null
          created_at: string | null
          external_url: string | null
          follower_count: number | null
          following_count: number | null
          full_name: string | null
          id: string
          instagram_user_id: string | null
          is_business: boolean | null
          is_private: boolean | null
          is_verified: boolean | null
          media_count: number | null
          profile_picture_url_hd: string | null
          stored_profile_picture_url: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          biography?: string | null
          category?: string | null
          created_at?: string | null
          external_url?: string | null
          follower_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id?: string
          instagram_user_id?: string | null
          is_business?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          media_count?: number | null
          profile_picture_url_hd?: string | null
          stored_profile_picture_url?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          biography?: string | null
          category?: string | null
          created_at?: string | null
          external_url?: string | null
          follower_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id?: string
          instagram_user_id?: string | null
          is_business?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          media_count?: number | null
          profile_picture_url_hd?: string | null
          stored_profile_picture_url?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      social_selling_interactions: {
        Row: {
          action_type: string
          content: string | null
          day_number: number | null
          enrollment_id: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          instagram_target: string | null
          lead_id: string | null
          metadata: Json | null
          status: string
        }
        Insert: {
          action_type: string
          content?: string | null
          day_number?: number | null
          enrollment_id?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          instagram_target?: string | null
          lead_id?: string | null
          metadata?: Json | null
          status?: string
        }
        Update: {
          action_type?: string
          content?: string | null
          day_number?: number | null
          enrollment_id?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          instagram_target?: string | null
          lead_id?: string | null
          metadata?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_selling_interactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "social_selling_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_selling_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_selling_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      social_selling_known_followers: {
        Row: {
          enrollment_id: string | null
          first_seen_at: string | null
          for_account: string
          full_name: string | null
          id: string
          instagram_user_id: string | null
          is_private: boolean | null
          is_verified: boolean | null
          lead_id: string | null
          metadata: Json | null
          qualification_reason: string | null
          qualification_score: number | null
          qualified: boolean | null
          username: string
        }
        Insert: {
          enrollment_id?: string | null
          first_seen_at?: string | null
          for_account: string
          full_name?: string | null
          id?: string
          instagram_user_id?: string | null
          is_private?: boolean | null
          is_verified?: boolean | null
          lead_id?: string | null
          metadata?: Json | null
          qualification_reason?: string | null
          qualification_score?: number | null
          qualified?: boolean | null
          username: string
        }
        Update: {
          enrollment_id?: string | null
          first_seen_at?: string | null
          for_account?: string
          full_name?: string | null
          id?: string
          instagram_user_id?: string | null
          is_private?: boolean | null
          is_verified?: boolean | null
          lead_id?: string | null
          metadata?: Json | null
          qualification_reason?: string | null
          qualification_score?: number | null
          qualified?: boolean | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_selling_known_followers_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "social_selling_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_selling_known_followers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_selling_known_followers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_presentations: {
        Row: {
          created_at: string | null
          event_date: string
          id: string
          notes: string | null
          presentation_type: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          event_date: string
          id?: string
          notes?: string | null
          presentation_type?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string | null
          event_date?: string
          id?: string
          notes?: string | null
          presentation_type?: string | null
          profile_id?: string
        }
        Relationships: []
      }
      system_cron_log: {
        Row: {
          created_at: string | null
          id: string
          job_name: string
          result: Json | null
          success: boolean
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_name: string
          result?: Json | null
          success: boolean
        }
        Update: {
          created_at?: string | null
          id?: string
          job_name?: string
          result?: Json | null
          success?: boolean
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          status: string | null
          title: string
          type: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          title: string
          type?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          role: string | null
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      team_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          team_user_id: string
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          team_user_id: string
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          team_user_id?: string
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_sessions_team_user_id_fkey"
            columns: ["team_user_id"]
            isOneToOne: false
            referencedRelation: "team_users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          name: string
          password_hash: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name: string
          password_hash: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name?: string
          password_hash?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_categories: {
        Row: {
          ativo: boolean
          created_at: string
          grupo: string | null
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          grupo?: string | null
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          grupo?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      training_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          profile_id: string
          progress: number | null
          training_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          profile_id: string
          progress?: number | null
          training_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string
          progress?: number | null
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          duration: string | null
          faixa_minima: Database["public"]["Enums"]["faixa"]
          id: string
          is_active: boolean | null
          thumbnail_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          duration?: string | null
          faixa_minima?: Database["public"]["Enums"]["faixa"]
          id?: string
          is_active?: boolean | null
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          duration?: string | null
          faixa_minima?: Database["public"]["Enums"]["faixa"]
          id?: string
          is_active?: boolean | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      treinadores: {
        Row: {
          ativo: boolean
          bio: string | null
          created_at: string
          foto_url: string | null
          id: string
          nome: string
          ordem: number
          profile_id: string | null
          team_member_id: string | null
        }
        Insert: {
          ativo?: boolean
          bio?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome: string
          ordem?: number
          profile_id?: string | null
          team_member_id?: string | null
        }
        Update: {
          ativo?: boolean
          bio?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome?: string
          ordem?: number
          profile_id?: string | null
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinadores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinadores_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          gemini_api_key: string | null
          id: string
          instagram_full_name: string | null
          instagram_profile_pic_url: string | null
          instagram_username: string | null
          openai_api_key: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          gemini_api_key?: string | null
          id?: string
          instagram_full_name?: string | null
          instagram_profile_pic_url?: string | null
          instagram_username?: string | null
          openai_api_key?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          gemini_api_key?: string | null
          id?: string
          instagram_full_name?: string | null
          instagram_profile_pic_url?: string | null
          instagram_username?: string | null
          openai_api_key?: string | null
          user_id?: string
        }
        Relationships: []
      }
      utm_links: {
        Row: {
          base_url: string
          clicks: number | null
          created_at: string | null
          full_url: string | null
          id: string
          is_active: boolean | null
          leads_generated: number | null
          name: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          base_url?: string
          clicks?: number | null
          created_at?: string | null
          full_url?: string | null
          id?: string
          is_active?: boolean | null
          leads_generated?: number | null
          name: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          base_url?: string
          clicks?: number | null
          created_at?: string | null
          full_url?: string | null
          id?: string
          is_active?: boolean | null
          leads_generated?: number | null
          name?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      vhs_onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          participant_id: string | null
          started_at: string | null
          step_data: Json | null
          step_name: string
          step_number: number
          time_spent_seconds: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          participant_id?: string | null
          started_at?: string | null
          step_data?: Json | null
          step_name: string
          step_number: number
          time_spent_seconds?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          participant_id?: string | null
          started_at?: string | null
          step_data?: Json | null
          step_name?: string
          step_number?: number
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vhs_onboarding_progress_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vhs_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      vhs_participants: {
        Row: {
          age_range: string | null
          ai_experience_level: string | null
          already_knows_ai: boolean | null
          biggest_dream: string | null
          children_count: number | null
          commitment_level: number | null
          created_at: string | null
          current_situation: string | null
          dream_deadline: string | null
          dream_income: string | null
          email: string | null
          expects_from_event: string | null
          family_dependents: number | null
          feels_undervalued: boolean | null
          goals_2026: string[] | null
          has_children: boolean | null
          has_financial_freedom: boolean | null
          id: string
          landing_accessed_at: string | null
          lead_id: string | null
          main_doubts: string | null
          main_frustration: string | null
          main_pain_points: string[] | null
          marital_status: string | null
          monthly_income: string | null
          name: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_started_at: string | null
          onboarding_step: number | null
          onboarding_token: string
          payment_confirmed_at: string | null
          popup_filled_at: string | null
          priority_goal: string | null
          salary_covers_bills: boolean | null
          updated_at: string | null
          what_would_change: string | null
          whatsapp: string
          why_this_event: string | null
          work_hours_weekly: string | null
        }
        Insert: {
          age_range?: string | null
          ai_experience_level?: string | null
          already_knows_ai?: boolean | null
          biggest_dream?: string | null
          children_count?: number | null
          commitment_level?: number | null
          created_at?: string | null
          current_situation?: string | null
          dream_deadline?: string | null
          dream_income?: string | null
          email?: string | null
          expects_from_event?: string | null
          family_dependents?: number | null
          feels_undervalued?: boolean | null
          goals_2026?: string[] | null
          has_children?: boolean | null
          has_financial_freedom?: boolean | null
          id?: string
          landing_accessed_at?: string | null
          lead_id?: string | null
          main_doubts?: string | null
          main_frustration?: string | null
          main_pain_points?: string[] | null
          marital_status?: string | null
          monthly_income?: string | null
          name: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          onboarding_token: string
          payment_confirmed_at?: string | null
          popup_filled_at?: string | null
          priority_goal?: string | null
          salary_covers_bills?: boolean | null
          updated_at?: string | null
          what_would_change?: string | null
          whatsapp: string
          why_this_event?: string | null
          work_hours_weekly?: string | null
        }
        Update: {
          age_range?: string | null
          ai_experience_level?: string | null
          already_knows_ai?: boolean | null
          biggest_dream?: string | null
          children_count?: number | null
          commitment_level?: number | null
          created_at?: string | null
          current_situation?: string | null
          dream_deadline?: string | null
          dream_income?: string | null
          email?: string | null
          expects_from_event?: string | null
          family_dependents?: number | null
          feels_undervalued?: boolean | null
          goals_2026?: string[] | null
          has_children?: boolean | null
          has_financial_freedom?: boolean | null
          id?: string
          landing_accessed_at?: string | null
          lead_id?: string | null
          main_doubts?: string | null
          main_frustration?: string | null
          main_pain_points?: string[] | null
          marital_status?: string | null
          monthly_income?: string | null
          name?: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          onboarding_token?: string
          payment_confirmed_at?: string | null
          popup_filled_at?: string | null
          priority_goal?: string | null
          salary_covers_bills?: boolean | null
          updated_at?: string | null
          what_would_change?: string | null
          whatsapp?: string
          why_this_event?: string | null
          work_hours_weekly?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vhs_participants_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      viral_carousels: {
        Row: {
          briefing: string
          caption: string | null
          created_at: string | null
          error_message: string | null
          hooks: Json | null
          id: string
          selected_hook_index: number | null
          slides: Json | null
          status: string
          template_id: string | null
          topic: string | null
          total_slides: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          briefing: string
          caption?: string | null
          created_at?: string | null
          error_message?: string | null
          hooks?: Json | null
          id?: string
          selected_hook_index?: number | null
          slides?: Json | null
          status?: string
          template_id?: string | null
          topic?: string | null
          total_slides?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          briefing?: string
          caption?: string | null
          created_at?: string | null
          error_message?: string | null
          hooks?: Json | null
          id?: string
          selected_hook_index?: number | null
          slides?: Json | null
          status?: string
          template_id?: string | null
          topic?: string | null
          total_slides?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wa_campaign_instance_stats: {
        Row: {
          blocks_detected_day: number | null
          cooldown_until: string | null
          instance_id: string
          last_block_at: string | null
          last_day_window_at: string | null
          last_error: string | null
          last_error_at: string | null
          last_hour_window_at: string | null
          last_sent_at: string | null
          sent_this_hour: number | null
          sent_today: number | null
          updated_at: string | null
          warmup_messages_today: number | null
        }
        Insert: {
          blocks_detected_day?: number | null
          cooldown_until?: string | null
          instance_id: string
          last_block_at?: string | null
          last_day_window_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_hour_window_at?: string | null
          last_sent_at?: string | null
          sent_this_hour?: number | null
          sent_today?: number | null
          updated_at?: string | null
          warmup_messages_today?: number | null
        }
        Update: {
          blocks_detected_day?: number | null
          cooldown_until?: string | null
          instance_id?: string
          last_block_at?: string | null
          last_day_window_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_hour_window_at?: string | null
          last_sent_at?: string | null
          sent_this_hour?: number | null
          sent_today?: number | null
          updated_at?: string | null
          warmup_messages_today?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_campaign_instance_stats_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_campaign_leads: {
        Row: {
          assigned_to: string | null
          campaign_id: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          instance_id: string | null
          lead_id: string | null
          read_at: string | null
          resolved_message: string | null
          responded_at: string | null
          response_message_id: string | null
          retry_count: number | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
          whatsapp: string
          whatsapp_message_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          read_at?: string | null
          resolved_message?: string | null
          responded_at?: string | null
          response_message_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp: string
          whatsapp_message_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          read_at?: string | null
          resolved_message?: string | null
          responded_at?: string | null
          response_message_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "wa_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campaign_leads_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_campaigns: {
        Row: {
          assignment_distribution_config_id: string | null
          assignment_mode: string | null
          assignment_target_id: string | null
          audience_count: number | null
          audience_filters: Json | null
          batch_pause_max_seconds: number | null
          batch_pause_min_seconds: number | null
          batch_size: number | null
          blocked_count: number | null
          business_hours_end: string | null
          business_hours_start: string | null
          cloud_template_id: string | null
          cloud_template_params: Json | null
          completed_at: string | null
          confirmed_opt_in_only: boolean
          cooldown_max_seconds: number
          cooldown_min_seconds: number
          created_at: string | null
          created_by: string | null
          daily_limit_per_instance: number | null
          dedicated_instance_id: string
          delay_max_seconds: number | null
          delay_min_seconds: number | null
          delivered_count: number | null
          description: string | null
          failed_count: number | null
          hourly_limit_per_instance: number | null
          id: string
          instance_ids: Json | null
          max_per_day: number
          max_per_hour: number
          media_type: string | null
          media_url: string | null
          message_content: string | null
          message_contents: Json | null
          message_text: string | null
          name: string
          pause_reason: string | null
          paused_at: string | null
          provider: string
          read_count: number | null
          responded_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string
          total_leads: number | null
          updated_at: string | null
          warmup_required: boolean
        }
        Insert: {
          assignment_distribution_config_id?: string | null
          assignment_mode?: string | null
          assignment_target_id?: string | null
          audience_count?: number | null
          audience_filters?: Json | null
          batch_pause_max_seconds?: number | null
          batch_pause_min_seconds?: number | null
          batch_size?: number | null
          blocked_count?: number | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          cloud_template_id?: string | null
          cloud_template_params?: Json | null
          completed_at?: string | null
          confirmed_opt_in_only?: boolean
          cooldown_max_seconds?: number
          cooldown_min_seconds?: number
          created_at?: string | null
          created_by?: string | null
          daily_limit_per_instance?: number | null
          dedicated_instance_id: string
          delay_max_seconds?: number | null
          delay_min_seconds?: number | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          hourly_limit_per_instance?: number | null
          id?: string
          instance_ids?: Json | null
          max_per_day?: number
          max_per_hour?: number
          media_type?: string | null
          media_url?: string | null
          message_content?: string | null
          message_contents?: Json | null
          message_text?: string | null
          name: string
          pause_reason?: string | null
          paused_at?: string | null
          provider?: string
          read_count?: number | null
          responded_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_leads?: number | null
          updated_at?: string | null
          warmup_required?: boolean
        }
        Update: {
          assignment_distribution_config_id?: string | null
          assignment_mode?: string | null
          assignment_target_id?: string | null
          audience_count?: number | null
          audience_filters?: Json | null
          batch_pause_max_seconds?: number | null
          batch_pause_min_seconds?: number | null
          batch_size?: number | null
          blocked_count?: number | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          cloud_template_id?: string | null
          cloud_template_params?: Json | null
          completed_at?: string | null
          confirmed_opt_in_only?: boolean
          cooldown_max_seconds?: number
          cooldown_min_seconds?: number
          created_at?: string | null
          created_by?: string | null
          daily_limit_per_instance?: number | null
          dedicated_instance_id?: string
          delay_max_seconds?: number | null
          delay_min_seconds?: number | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          hourly_limit_per_instance?: number | null
          id?: string
          instance_ids?: Json | null
          max_per_day?: number
          max_per_hour?: number
          media_type?: string | null
          media_url?: string | null
          message_content?: string | null
          message_contents?: Json | null
          message_text?: string | null
          name?: string
          pause_reason?: string | null
          paused_at?: string | null
          provider?: string
          read_count?: number | null
          responded_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_leads?: number | null
          updated_at?: string | null
          warmup_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wa_campaigns_cloud_template_id_fkey"
            columns: ["cloud_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_cloud_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campaigns_dedicated_instance_id_fkey"
            columns: ["dedicated_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_group_redirects: {
        Row: {
          click_count: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          last_click_at: string | null
          slug: string
          target_url: string
          updated_at: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_click_at?: string | null
          slug: string
          target_url: string
          updated_at?: string
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_click_at?: string | null
          slug?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_groups: {
        Row: {
          instance_id: string | null
          is_announce: boolean | null
          jid: string
          name: string | null
          participant_count: number | null
          updated_at: string | null
        }
        Insert: {
          instance_id?: string | null
          is_announce?: boolean | null
          jid: string
          name?: string | null
          participant_count?: number | null
          updated_at?: string | null
        }
        Update: {
          instance_id?: string | null
          is_announce?: boolean | null
          jid?: string
          name?: string | null
          participant_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wa_template_variables: {
        Row: {
          created_at: string
          fallback_value: string | null
          id: string
          semantic_role: string
          template_id: string
          template_table: string
          variable_index: number
        }
        Insert: {
          created_at?: string
          fallback_value?: string | null
          id?: string
          semantic_role: string
          template_id: string
          template_table?: string
          variable_index: number
        }
        Update: {
          created_at?: string
          fallback_value?: string | null
          id?: string
          semantic_role?: string
          template_id?: string
          template_table?: string
          variable_index?: number
        }
        Relationships: []
      }
      wavoip_devices: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_shared: boolean
          metadata: Json | null
          name: string | null
          phone_number: string | null
          status: string | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean
          metadata?: Json | null
          name?: string | null
          phone_number?: string | null
          status?: string | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean
          metadata?: Json | null
          name?: string | null
          phone_number?: string | null
          status?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          page_name: string
          page_slug: string
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          page_name: string
          page_slug: string
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          page_name?: string
          page_slug?: string
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
      webhook_debug_log: {
        Row: {
          event_type: string | null
          id: string
          message_type_detected: string | null
          notes: string | null
          payload: Json | null
          received_at: string | null
        }
        Insert: {
          event_type?: string | null
          id?: string
          message_type_detected?: string | null
          notes?: string | null
          payload?: Json | null
          received_at?: string | null
        }
        Update: {
          event_type?: string | null
          id?: string
          message_type_detected?: string | null
          notes?: string | null
          payload?: Json | null
          received_at?: string | null
        }
        Relationships: []
      }
      webhook_event_log: {
        Row: {
          amount: number | null
          created_at: string | null
          crm_board_id: string | null
          crm_lead_id: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          dedupe_key: string | null
          event_type: string
          id: string
          product_name: string | null
          provider: string
          raw_payload: Json | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          crm_board_id?: string | null
          crm_lead_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dedupe_key?: string | null
          event_type: string
          id?: string
          product_name?: string | null
          provider: string
          raw_payload?: Json | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          crm_board_id?: string | null
          crm_lead_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dedupe_key?: string | null
          event_type?: string
          id?: string
          product_name?: string | null
          provider?: string
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_event_log_crm_board_id_fkey"
            columns: ["crm_board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_event_log_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_event_log_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_cloud_templates: {
        Row: {
          category: string
          components: Json
          created_at: string | null
          created_by: string | null
          example_values: Json | null
          id: string
          internal_tags: string[] | null
          language: string
          last_used_at: string | null
          meta_template_id: string | null
          meta_waba_id: string | null
          name: string
          rejection_reason: string | null
          status: string
          total_delivered: number | null
          total_failed: number | null
          total_read: number | null
          total_sent: number | null
          updated_at: string | null
          variables_count: number | null
        }
        Insert: {
          category: string
          components?: Json
          created_at?: string | null
          created_by?: string | null
          example_values?: Json | null
          id?: string
          internal_tags?: string[] | null
          language?: string
          last_used_at?: string | null
          meta_template_id?: string | null
          meta_waba_id?: string | null
          name: string
          rejection_reason?: string | null
          status?: string
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_sent?: number | null
          updated_at?: string | null
          variables_count?: number | null
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string | null
          created_by?: string | null
          example_values?: Json | null
          id?: string
          internal_tags?: string[] | null
          language?: string
          last_used_at?: string | null
          meta_template_id?: string | null
          meta_waba_id?: string | null
          name?: string
          rejection_reason?: string | null
          status?: string
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_sent?: number | null
          updated_at?: string | null
          variables_count?: number | null
        }
        Relationships: []
      }
      whatsapp_group_participants: {
        Row: {
          first_seen_at: string | null
          group_id: string | null
          group_jid: string
          id: string
          is_admin: boolean | null
          last_seen_at: string | null
          matched_member_id: string | null
          message_count: number | null
          metadata: Json | null
          name: string | null
          phone: string
          question_count: number | null
          tags: string[] | null
        }
        Insert: {
          first_seen_at?: string | null
          group_id?: string | null
          group_jid: string
          id?: string
          is_admin?: boolean | null
          last_seen_at?: string | null
          matched_member_id?: string | null
          message_count?: number | null
          metadata?: Json | null
          name?: string | null
          phone: string
          question_count?: number | null
          tags?: string[] | null
        }
        Update: {
          first_seen_at?: string | null
          group_id?: string | null
          group_jid?: string
          id?: string
          is_admin?: boolean | null
          last_seen_at?: string | null
          matched_member_id?: string | null
          message_count?: number | null
          metadata?: Json | null
          name?: string | null
          phone?: string
          question_count?: number | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_participants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_participants_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_questions: {
        Row: {
          ai_summary: string | null
          answer_snippet: string | null
          answered: boolean | null
          answered_at: string | null
          answered_by: string | null
          content: string
          created_at: string | null
          group_id: string | null
          id: string
          message_id: string | null
          participant_id: string | null
          participant_name: string | null
          participant_phone: string | null
          priority: string | null
          topic: string | null
        }
        Insert: {
          ai_summary?: string | null
          answer_snippet?: string | null
          answered?: boolean | null
          answered_at?: string | null
          answered_by?: string | null
          content: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          message_id?: string | null
          participant_id?: string | null
          participant_name?: string | null
          participant_phone?: string | null
          priority?: string | null
          topic?: string | null
        }
        Update: {
          ai_summary?: string | null
          answer_snippet?: string | null
          answered?: boolean | null
          answered_at?: string | null
          answered_by?: string | null
          content?: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          message_id?: string | null
          participant_id?: string | null
          participant_name?: string | null
          participant_phone?: string | null
          priority?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_questions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_group_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          auto_detect_questions: boolean | null
          auto_send_meeting_links: boolean | null
          created_at: string | null
          description: string | null
          group_jid: string
          id: string
          instance_id: string | null
          is_broadcast_enabled: boolean | null
          is_spy_active: boolean | null
          last_message_at: string | null
          linked_module_id: string | null
          linked_program: string | null
          metadata: Json | null
          name: string | null
          participants_count: number | null
          total_messages: number | null
          total_questions: number | null
          updated_at: string | null
          welcome_message: string | null
        }
        Insert: {
          auto_detect_questions?: boolean | null
          auto_send_meeting_links?: boolean | null
          created_at?: string | null
          description?: string | null
          group_jid: string
          id?: string
          instance_id?: string | null
          is_broadcast_enabled?: boolean | null
          is_spy_active?: boolean | null
          last_message_at?: string | null
          linked_module_id?: string | null
          linked_program?: string | null
          metadata?: Json | null
          name?: string | null
          participants_count?: number | null
          total_messages?: number | null
          total_questions?: number | null
          updated_at?: string | null
          welcome_message?: string | null
        }
        Update: {
          auto_detect_questions?: boolean | null
          auto_send_meeting_links?: boolean | null
          created_at?: string | null
          description?: string | null
          group_jid?: string
          id?: string
          instance_id?: string | null
          is_broadcast_enabled?: boolean | null
          is_spy_active?: boolean | null
          last_message_at?: string | null
          linked_module_id?: string | null
          linked_program?: string | null
          metadata?: Json | null
          name?: string | null
          participants_count?: number | null
          total_messages?: number | null
          total_questions?: number | null
          updated_at?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          admin_token: string | null
          agent_version: string | null
          ai_agent_id: string | null
          api_key: string | null
          api_url: string | null
          avatar_url: string | null
          business_account_id: string | null
          channel: string
          created_at: string
          id: string
          instance_name: string
          instance_token: string | null
          is_dedicated_blast: boolean | null
          notes: string | null
          phone_number: string | null
          phone_number_id: string | null
          provider: string
          purpose: string | null
          qr_code: string | null
          status: string
          subdomain: string
          updated_at: string
          verification_pin: string | null
          webhook_url: string | null
        }
        Insert: {
          admin_token?: string | null
          agent_version?: string | null
          ai_agent_id?: string | null
          api_key?: string | null
          api_url?: string | null
          avatar_url?: string | null
          business_account_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          instance_name: string
          instance_token?: string | null
          is_dedicated_blast?: boolean | null
          notes?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          purpose?: string | null
          qr_code?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
          verification_pin?: string | null
          webhook_url?: string | null
        }
        Update: {
          admin_token?: string | null
          agent_version?: string | null
          ai_agent_id?: string | null
          api_key?: string | null
          api_url?: string | null
          avatar_url?: string | null
          business_account_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          is_dedicated_blast?: boolean | null
          notes?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          purpose?: string | null
          qr_code?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
          verification_pin?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          board_id: string | null
          content: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          error_message: string | null
          failed_at: string | null
          id: string
          instance_id: string | null
          is_read: boolean
          lead_id: string | null
          media_url: string | null
          message_type: string
          metadata: Json | null
          read_at: string | null
          remote_phone: string
          status: string
          updated_at: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          board_id?: string | null
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          instance_id?: string | null
          is_read?: boolean
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          remote_phone: string
          status?: string
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          board_id?: string | null
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          instance_id?: string | null
          is_read?: boolean
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          remote_phone?: string
          status?: string
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "crm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads_engagement"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_limits: {
        Row: {
          auto_pause_failure_rate: number
          frozen: boolean
          frozen_at: string | null
          frozen_reason: string | null
          instance_id: string
          max_per_day: number
          max_per_hour: number
          updated_at: string
        }
        Insert: {
          auto_pause_failure_rate?: number
          frozen?: boolean
          frozen_at?: string | null
          frozen_reason?: string | null
          instance_id: string
          max_per_day?: number
          max_per_hour?: number
          updated_at?: string
        }
        Update: {
          auto_pause_failure_rate?: number
          frozen?: boolean
          frozen_at?: string | null
          frozen_reason?: string | null
          instance_id?: string
          max_per_day?: number
          max_per_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_template_tags: {
        Row: {
          id: string
          tag: string
          template_id: string
        }
        Insert: {
          id?: string
          tag: string
          template_id: string
        }
        Update: {
          id?: string
          tag?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_template_tags_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_cloud_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      calendar_events_all: {
        Row: {
          all_day: boolean | null
          attendees_user_ids: string[] | null
          color: string | null
          description: string | null
          end_at: string | null
          id: string | null
          lead_id: string | null
          lesson_id_ref: string | null
          location: string | null
          meeting_id_ref: string | null
          meeting_url: string | null
          metadata: Json | null
          owner_id: string | null
          recurrence_rule: string | null
          recurrence_until: string | null
          source: string | null
          start_at: string | null
          status: string | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
      crm_leads_engagement: {
        Row: {
          email_click_count: number | null
          email_open_count: number | null
          email_sent_count: number | null
          id: string | null
          last_email_clicked_at: string | null
          last_email_opened_at: string | null
        }
        Relationships: []
      }
      member_activity_feed: {
        Row: {
          event_at: string | null
          event_title: string | null
          event_type: string | null
          member_id: string | null
          payload: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      _wa_norm: { Args: { p: string }; Returns: string }
      adjust_event_checkin: {
        Args: { p_attendee_id: string; p_delta: number }
        Returns: Json
      }
      admin_create_team_user: {
        Args: {
          p_email: string
          p_name: string
          p_password: string
          p_role?: string
        }
        Returns: Json
      }
      admin_delete_member: { Args: { p_member: string }; Returns: Json }
      admin_set_team_password: {
        Args: { p_id: string; p_password: string }
        Returns: Json
      }
      admin_toggle_team_user: {
        Args: { p_active: boolean; p_id: string }
        Returns: Json
      }
      assert_collective_event_uses_cloud_api: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      assert_wa_campaign_safe: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      atribuir_indicacao: {
        Args: {
          p_codigo?: string
          p_email?: string
          p_janela_dias?: number
          p_origem: string
          p_origem_id?: string
          p_produto: string
          p_telefone?: string
          p_valor: number
        }
        Returns: string
      }
      broadcast_events_to_groups: { Args: never; Returns: Json }
      checkin_by_code: {
        Args: { p_code: string; p_event_id: string }
        Returns: Json
      }
      compute_first_contact_at: {
        Args: { p_email?: string; p_fallback?: string; p_whatsapp: string }
        Returns: string
      }
      confirm_collective_rsvp: {
        Args: { p_attendance_mode: string; p_token: string }
        Returns: Json
      }
      create_event_attendee_charge: {
        Args: {
          p_amount: number
          p_attendee_id: string
          p_billing_type?: string
          p_product: string
        }
        Returns: Json
      }
      credenciais_status: {
        Args: never
        Returns: {
          atualizado_em: string
          configurada: boolean
          slug: string
        }[]
      }
      cron_dispatch_all_collective_events: { Args: never; Returns: Json }
      current_faixa: {
        Args: never
        Returns: Database["public"]["Enums"]["faixa"]
      }
      current_member_id: { Args: never; Returns: string }
      current_team_user_id: { Args: never; Returns: string }
      decidir_faixa: {
        Args: {
          p_aprovar: boolean
          p_faixa?: Database["public"]["Enums"]["faixa"]
          p_profile: string
        }
        Returns: undefined
      }
      dispatch_collective_event_batch: {
        Args: { p_batch_size?: number; p_event_id: string }
        Returns: Json
      }
      dispatch_collective_event_now:
        | { Args: { p_event_id: string; p_limit?: number }; Returns: Json }
        | {
            Args: { p_channels?: string; p_event_id: string; p_limit?: number }
            Returns: Json
          }
      dispatch_collective_event_reminders: {
        Args: { p_batch_size?: number; p_event_id: string }
        Returns: Json
      }
      ensure_support_meetings: { Args: never; Returns: number }
      event_log_interaction: {
        Args: { p_content?: string; p_invite_token: string; p_type: string }
        Returns: undefined
      }
      event_mark_join: { Args: { p_invite_token: string }; Returns: undefined }
      event_mark_leave: { Args: { p_invite_token: string }; Returns: undefined }
      event_participation_ranking: {
        Args: { p_event_id: string }
        Returns: {
          interacoes: number
          lead_id: string
          minutos_assistidos: number
          nome: string
          perguntas: number
          score: number
          whatsapp: string
        }[]
      }
      event_public_identify: {
        Args: {
          p_email?: string
          p_event_token: string
          p_instagram?: string
          p_name: string
          p_phone: string
        }
        Returns: Json
      }
      find_lead_by_phone_crm: { Args: { p_phone: string }; Returns: string }
      get_active_billing_gateway: { Args: never; Returns: string }
      get_email_audience_count: { Args: { p_filters?: Json }; Returns: number }
      get_help_contact_labels: {
        Args: never
        Returns: {
          display_label: string
          is_active: boolean
          service: string
        }[]
      }
      get_integration_key_full: {
        Args: { p_service: string }
        Returns: {
          account_id: string
          api_key: string
          api_secret: string
          is_active: boolean
          service: string
        }[]
      }
      get_integration_keys_masked: {
        Args: never
        Returns: {
          account_id: string
          api_key_last4: string
          api_key_masked: string
          has_secret: boolean
          is_active: boolean
          metadata: Json
          service: string
          updated_at: string
        }[]
      }
      get_masterclass_lead_count: { Args: never; Returns: number }
      get_or_create_lesson_conversation: {
        Args: { p_lesson_id: string }
        Returns: string
      }
      get_wa_audience_count: {
        Args: { p_filters?: Json; p_require_opt_in?: boolean }
        Returns: number
      }
      import_event_buyers: {
        Args: { p_board_slug: string; p_event_id: string }
        Returns: number
      }
      import_event_confirmed_invites: {
        Args: { p_event_id: string }
        Returns: number
      }
      increment_campaign_responded: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      increment_group_total_messages: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      list_active_lead_tags: {
        Args: { p_min_count?: number }
        Returns: {
          lead_count: number
          tag: string
        }[]
      }
      member_activity_timeline: {
        Args: { p_limit?: number; p_member_id: string }
        Returns: {
          event_at: string
          event_title: string
          event_type: string
          payload: Json
        }[]
      }
      member_engagement_list: {
        Args: { p_status?: string }
        Returns: {
          classification: string
          days_since_last_access: number
          engagement_score: number
          last_active_at: string
          lessons_completed_7d: number
          member_avatar: string
          member_email: string
          member_id: string
          member_name: string
          member_phone: string
          sessions_7d: number
          tutor_questions_7d: number
        }[]
      }
      member_engagement_summary: {
        Args: { p_member_id: string }
        Returns: {
          classification: string
          current_streak: number
          days_since_last_access: number
          engagement_score: number
          last_active_at: string
          lessons_completed_7d: number
          live_meetings_30d: number
          member_email: string
          member_id: string
          member_name: string
          member_phone: string
          sessions_7d: number
          total_lessons_completed: number
          tutor_questions_7d: number
        }[]
      }
      member_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          id: string
          level: string
          name: string
          xp: number
        }[]
      }
      member_self: {
        Args: never
        Returns: {
          avatar_url: string
          badges: string[]
          bio: string
          birthdate: string
          contratante_member_id: string
          created_at: string
          email: string
          id: string
          job_title: string
          last_active_at: string
          level: string
          member_role: string
          name: string
          phone: string
          program: string
          status: string
          streak_current: number
          streak_last_date: string
          streak_longest: number
          total_lessons_completed: number
          total_quizzes_completed: number
          total_time_minutes: number
          welcome_message: string
          xp: number
        }[]
      }
      member_tick: { Args: { p_minutes?: number }; Returns: undefined }
      merge_lead_group: {
        Args: { p_ids: string[]; p_reason?: string }
        Returns: Json
      }
      merge_leads: {
        Args: { p_canonical: string; p_dupes: string[] }
        Returns: Json
      }
      minhas_indicacoes: {
        Args: never
        Returns: {
          aprovado_em: string
          entrou_em: string
          faixa: Database["public"]["Enums"]["faixa"]
          nome: string
          pontos: number
          status: string
        }[]
      }
      mural_de_membros: {
        Args: { p_limit?: number }
        Returns: {
          foto_url: string
          nome: string
        }[]
      }
      notify_meetings: { Args: never; Returns: Json }
      nw_annual_ranking: {
        Args: { p_limit?: number; p_year?: number }
        Returns: {
          company_name: string
          owner_name: string
          photo_url: string
          points: number
          profile_id: string
          rank_position: number
        }[]
      }
      nw_lifetime_points: { Args: { p_profile: string }; Returns: number }
      nw_reward_tier: { Args: { p_points: number }; Returns: string }
      nw_season_points: {
        Args: { p_profile: string; p_year?: number }
        Returns: number
      }
      onboarding_ensure_token: { Args: { p_lead_id: string }; Returns: string }
      onboarding_get_lead: { Args: { p_token: string }; Returns: Json }
      onboarding_save_step: {
        Args: { p_data: Json; p_token: string }
        Returns: Json
      }
      populate_collective_invites: {
        Args: { p_event_id: string }
        Returns: number
      }
      populate_email_campaign_leads: {
        Args: { p_campaign_id: string }
        Returns: number
      }
      populate_wa_campaign_leads: {
        Args: { p_campaign_id: string }
        Returns: number
      }
      process_contract_broadcast: { Args: never; Returns: undefined }
      prospeccao_ensure_member_quota: {
        Args: { p_member_id: string }
        Returns: {
          analises_used_this_month: number | null
          buscas_used_this_month: number | null
          created_at: string | null
          current_period_start: string | null
          is_paid: boolean | null
          last_used_at: string | null
          member_id: string
          monthly_limit: number | null
          paid_until: string | null
          plan_name: string | null
          total_analises_lifetime: number | null
          total_buscas_lifetime: number | null
          total_custo_lifetime: number | null
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "prospeccao_member_quotas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prospeccao_increment_member_usage: {
        Args: { p_custo?: number; p_member_id: string; p_tipo: string }
        Returns: {
          analises_used_this_month: number | null
          buscas_used_this_month: number | null
          created_at: string | null
          current_period_start: string | null
          is_paid: boolean | null
          last_used_at: string | null
          member_id: string
          monthly_limit: number | null
          paid_until: string | null
          plan_name: string | null
          total_analises_lifetime: number | null
          total_buscas_lifetime: number | null
          total_custo_lifetime: number | null
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "prospeccao_member_quotas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_event_attendee: {
        Args: {
          p_company?: string
          p_cpf?: string
          p_email?: string
          p_instagram?: string
          p_name: string
          p_role?: string
          p_token: string
          p_whatsapp?: string
        }
        Returns: Json
      }
      registrar_clique_indicacao: {
        Args: {
          p_codigo: string
          p_destino?: string
          p_referer?: string
          p_utm?: Json
        }
        Returns: undefined
      }
      resolve_collective_invite: { Args: { p_token: string }; Returns: Json }
      resolve_event_signup: { Args: { p_token: string }; Returns: Json }
      resolve_lead_avatar: {
        Args: { p_email?: string; p_whatsapp?: string }
        Returns: {
          instagram_handle: string
          photo_url: string
          source: string
        }[]
      }
      resolve_wa_group_redirect: { Args: { p_slug: string }; Returns: string }
      resolver_destino_indicacao: {
        Args: { p_codigo: string; p_slug?: string }
        Returns: Json
      }
      run_daily_engagement_alert: { Args: never; Returns: Json }
      salvar_credencial: {
        Args: { p_slug: string; p_valor: string }
        Returns: undefined
      }
      save_attendee_instagram: {
        Args: { p_attendee_id: string; p_data: Json; p_pic: string }
        Returns: Json
      }
      set_lesson_duration_if_empty: {
        Args: { p_lesson_id: string; p_minutes: number }
        Returns: undefined
      }
      solicitar_faixa: {
        Args: { p_faixa: Database["public"]["Enums"]["faixa"] }
        Returns: undefined
      }
      ss_actions_today: { Args: { p_action?: string }; Returns: number }
      sync_event_attendees_to_crm: {
        Args: { p_board_slug?: string; p_event_id: string }
        Returns: Json
      }
      team_login: {
        Args: { p_email: string; p_password: string }
        Returns: Json
      }
      team_logout: { Args: { p_token: string }; Returns: undefined }
      toggle_event_checkin: {
        Args: { p_attendee_id: string; p_checked: boolean }
        Returns: Json
      }
      total_de_membros: { Args: never; Returns: number }
      treinadores_publicos: {
        Args: never
        Returns: {
          foto_url: string
          nome: string
          ordem: number
          papel: string
        }[]
      }
      wa_can_send_now: { Args: { p_instance_id: string }; Returns: Json }
      wa_canon: { Args: { p: string }; Returns: string }
      wa_increment_instance_stat: {
        Args: { p_date?: string; p_instance_id: string; p_sent?: number }
        Returns: undefined
      }
    }
    Enums: {
      announcement_type: "info" | "warning" | "success" | "new_member"
      event_type: "presencial" | "online"
      faixa: "branco" | "vermelho" | "verde" | "roxo" | "marrom" | "preta"
      referral_status: "pending" | "approved" | "rejected" | "expired"
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
      announcement_type: ["info", "warning", "success", "new_member"],
      event_type: ["presencial", "online"],
      faixa: ["branco", "vermelho", "verde", "roxo", "marrom", "preta"],
      referral_status: ["pending", "approved", "rejected", "expired"],
    },
  },
} as const
