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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_configs: {
        Row: {
          created_at: string
          description: string | null
          id: string
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
            foreignKeyName: "call_history_wavoip_device_id_fkey"
            columns: ["wavoip_device_id"]
            isOneToOne: false
            referencedRelation: "wavoip_devices"
            referencedColumns: ["id"]
          },
        ]
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
          assigned_to: string | null
          board_id: string | null
          call_reminder_sent: boolean | null
          chatbot_paused_until: string | null
          closed_at: string | null
          column_id: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          instagram: string | null
          instagram_profile_pic_url: string | null
          lead_score: number | null
          lost_reason: string | null
          name: string
          notes: string | null
          potential_value: number | null
          priority: string | null
          post_sale_stage: string | null
          deal_value: number | null
          scheduled_call_at: string | null
          sort_order: number | null
          source: string | null
          source_lead_id: string | null
          tags: string[] | null
          updated_at: string | null
          whatsapp: string
          whatsapp_profile_pic_url: string | null
        }
        Insert: {
          assigned_to?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          potential_value?: number | null
          priority?: string | null
          post_sale_stage?: string | null
          deal_value?: number | null
          scheduled_call_at?: string | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp: string
          whatsapp_profile_pic_url?: string | null
        }
        Update: {
          assigned_to?: string | null
          board_id?: string | null
          call_reminder_sent?: boolean | null
          chatbot_paused_until?: string | null
          closed_at?: string | null
          column_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          instagram_profile_pic_url?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          potential_value?: number | null
          priority?: string | null
          post_sale_stage?: string | null
          deal_value?: number | null
          scheduled_call_at?: string | null
          sort_order?: number | null
          source?: string | null
          source_lead_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp?: string
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
      meetings: {
        Row: {
          ai_key_points: Json | null
          ai_processed_at: string | null
          ai_sentiment: string | null
          ai_suggested_tasks: Json | null
          ai_summary: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          meeting_url: string | null
          metadata: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string
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
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
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
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
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
        ]
      }
      prospects: {
        Row: {
          id: string
          empresa: string
          nicho: string
          cidade: string
          telefone: string | null
          site: string | null
          instagram: string | null
          google_rating: number | null
          google_reviews: number | null
          endereco: string | null
          horario_funcionamento: string | null
          status: string
          nota_site_seo: number | null
          nota_site_conversao: number | null
          nota_google_meu_negocio: number | null
          nota_instagram_posicionamento: number | null
          nota_instagram_engajamento: number | null
          nota_geral: number | null
          analise_site: Json
          analise_instagram: Json
          analise_gmb: Json
          plano_acao: Json
          impacto: Json
          dm_enviada: boolean
          dm_respondida: boolean
          dm_texto: string | null
          dm_data: string | null
          convertido_lead: boolean
          crm_lead_id: string | null
          pdf_path: string | null
          pdf_data: Json | null
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa: string
          nicho: string
          cidade: string
          telefone?: string | null
          site?: string | null
          instagram?: string | null
          google_rating?: number | null
          google_reviews?: number | null
          endereco?: string | null
          horario_funcionamento?: string | null
          status?: string
          nota_site_seo?: number | null
          nota_site_conversao?: number | null
          nota_google_meu_negocio?: number | null
          nota_instagram_posicionamento?: number | null
          nota_instagram_engajamento?: number | null
          nota_geral?: number | null
          analise_site?: Json
          analise_instagram?: Json
          analise_gmb?: Json
          plano_acao?: Json
          impacto?: Json
          dm_enviada?: boolean
          dm_respondida?: boolean
          dm_texto?: string | null
          dm_data?: string | null
          convertido_lead?: boolean
          crm_lead_id?: string | null
          pdf_path?: string | null
          pdf_data?: Json | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa?: string
          nicho?: string
          cidade?: string
          telefone?: string | null
          site?: string | null
          instagram?: string | null
          google_rating?: number | null
          google_reviews?: number | null
          endereco?: string | null
          horario_funcionamento?: string | null
          status?: string
          nota_site_seo?: number | null
          nota_site_conversao?: number | null
          nota_google_meu_negocio?: number | null
          nota_instagram_posicionamento?: number | null
          nota_instagram_engajamento?: number | null
          nota_geral?: number | null
          analise_site?: Json
          analise_instagram?: Json
          analise_gmb?: Json
          plano_acao?: Json
          impacto?: Json
          dm_enviada?: boolean
          dm_respondida?: boolean
          dm_texto?: string | null
          dm_data?: string | null
          convertido_lead?: boolean
          crm_lead_id?: string | null
          pdf_path?: string | null
          pdf_data?: Json | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
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
      sales_events: {
        Row: {
          amount: number
          celebrated_at: string | null
          created_at: string | null
          crm_board_id: string | null
          crm_lead_id: string | null
          currency: string | null
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
      wavoip_devices: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
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
      whatsapp_instances: {
        Row: {
          admin_token: string
          channel: string
          created_at: string
          id: string
          instance_name: string
          instance_token: string | null
          phone_number: string | null
          qr_code: string | null
          status: string
          subdomain: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          admin_token: string
          channel?: string
          created_at?: string
          id?: string
          instance_name: string
          instance_token?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          admin_token?: string
          channel?: string
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          board_id: string | null
          content: string | null
          created_at: string
          direction: string
          id: string
          instance_id: string | null
          is_read: boolean
          lead_id: string | null
          media_url: string | null
          message_type: string
          metadata: Json | null
          remote_phone: string
          status: string
          whatsapp_message_id: string | null
        }
        Insert: {
          board_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          instance_id?: string | null
          is_read?: boolean
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          remote_phone: string
          status?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          board_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          instance_id?: string | null
          is_read?: boolean
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          remote_phone?: string
          status?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_lead_by_phone_crm: { Args: { p_phone: string }; Returns: string }
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
    Enums: {},
  },
} as const
