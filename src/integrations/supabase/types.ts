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
      admin_users: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_bot_notification_preferences: {
        Row: {
          agent_id: string
          created_at: string | null
          email_notifications_enabled: boolean | null
          id: string
          last_notification_sent_at: string | null
          notification_frequency: string | null
          notify_for_bots: string[] | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          email_notifications_enabled?: boolean | null
          id?: string
          last_notification_sent_at?: string | null
          notification_frequency?: string | null
          notify_for_bots?: string[] | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          email_notifications_enabled?: boolean | null
          id?: string
          last_notification_sent_at?: string | null
          notification_frequency?: string | null
          notify_for_bots?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_bot_notification_preferences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_bot_visit_summary: {
        Row: {
          agent_id: string
          artifact_visits: number | null
          cache_hits: number | null
          cache_misses: number | null
          created_at: string | null
          date: string
          id: string
          profile_visits: number | null
          total_bot_visits: number | null
          unique_bots: string[] | null
          updated_at: string | null
          visits_by_bot_type: Json | null
        }
        Insert: {
          agent_id: string
          artifact_visits?: number | null
          cache_hits?: number | null
          cache_misses?: number | null
          created_at?: string | null
          date: string
          id?: string
          profile_visits?: number | null
          total_bot_visits?: number | null
          unique_bots?: string[] | null
          updated_at?: string | null
          visits_by_bot_type?: Json | null
        }
        Update: {
          agent_id?: string
          artifact_visits?: number | null
          cache_hits?: number | null
          cache_misses?: number | null
          created_at?: string | null
          date?: string
          id?: string
          profile_visits?: number | null
          total_bot_visits?: number | null
          unique_bots?: string[] | null
          updated_at?: string | null
          visits_by_bot_type?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_bot_visit_summary_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_neighborhood_subscriptions: {
        Row: {
          config_version_used: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          neighborhood_id: string
          price_paid: number
          professional_id: string
          started_at: string | null
          stripe_subscription_id: string | null
          subscription_type: string
          tier_at_purchase: string
          updated_at: string | null
        }
        Insert: {
          config_version_used?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          neighborhood_id: string
          price_paid?: number
          professional_id: string
          started_at?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          tier_at_purchase: string
          updated_at?: string | null
        }
        Update: {
          config_version_used?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          neighborhood_id?: string
          price_paid?: number
          professional_id?: string
          started_at?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          tier_at_purchase?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_neighborhood_subscriptions_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhood_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_neighborhood_subscriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          professional_id: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          professional_id?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          professional_id?: string | null
          token?: string
        }
        Relationships: []
      }
      agent_verification_codes: {
        Row: {
          code: string
          created_at: string
          delivery_method: string
          expires_at: string
          id: string
          professional_id: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          delivery_method?: string
          expires_at: string
          id?: string
          professional_id: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          delivery_method?: string
          expires_at?: string
          id?: string
          professional_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_verification_codes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_zip_activity: {
        Row: {
          created_at: string | null
          id: string
          last_verified_at: string | null
          license_number: string
          state: string
          transaction_count: number
          updated_at: string | null
          zip_code: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_verified_at?: string | null
          license_number: string
          state: string
          transaction_count?: number
          updated_at?: string | null
          zip_code: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_verified_at?: string | null
          license_number?: string
          state?: string
          transaction_count?: number
          updated_at?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          model: string | null
          role: string
          session_id: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          role: string
          session_id: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          role?: string
          session_id?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_project_context: {
        Row: {
          active: boolean | null
          content: string
          context_type: string
          created_at: string | null
          id: string
          priority: number | null
          project_name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          content: string
          context_type: string
          created_at?: string | null
          id?: string
          priority?: number | null
          project_name?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          content?: string
          context_type?: string
          created_at?: string | null
          id?: string
          priority?: number | null
          project_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_sessions: {
        Row: {
          created_at: string | null
          id: string
          status: string | null
          task: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string | null
          task: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string | null
          task?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string | null
          appointment_type_id: string | null
          created_at: string | null
          email: string | null
          end_time: string | null
          id: string
          location: string | null
          meeting_link: string | null
          name: string | null
          phone: string | null
          reason: string | null
          start_time: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date?: string | null
          appointment_type_id?: string | null
          created_at?: string | null
          email?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string | null
          appointment_type_id?: string | null
          created_at?: string | null
          email?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      arizona_licenses: {
        Row: {
          created_at: string | null
          employer_legal_name: string | null
          employer_phone: string | null
          first_name: string | null
          id: string
          last_name: string | null
          license_number: string
          license_type: string | null
          mailing_address1: string | null
          mailing_address2: string | null
          mailing_city: string | null
          mailing_county: string | null
          mailing_state: string | null
          mailing_zip: string | null
          middle_name: string | null
          original_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employer_legal_name?: string | null
          employer_phone?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          license_number: string
          license_type?: string | null
          mailing_address1?: string | null
          mailing_address2?: string | null
          mailing_city?: string | null
          mailing_county?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          middle_name?: string | null
          original_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employer_legal_name?: string | null
          employer_phone?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          license_number?: string
          license_type?: string | null
          mailing_address1?: string | null
          mailing_address2?: string | null
          mailing_city?: string | null
          mailing_county?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          middle_name?: string | null
          original_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      canonical_city_rankings: {
        Row: {
          category_id: string | null
          city_id: string | null
          created_at: string | null
          id: string
          last_calculated_at: string | null
          professional_id: string | null
          rank: number | null
          score: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          city_id?: string | null
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          professional_id?: string | null
          rank?: number | null
          score?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          city_id?: string | null
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          professional_id?: string | null
          rank?: number | null
          score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canonical_city_rankings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_city_rankings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_city_rankings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          plural_name: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          plural_name?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          plural_name?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      certifications: {
        Row: {
          certification_status: string
          certification_tier: string
          created_at: string
          id: string
          issued_at: string
          justification_data: Json | null
          last_verified_at: string
          markets_covered: string[]
          methodology_version: string
          neighborhoods_covered: string[]
          next_verification_due: string
          payload_hash: string | null
          payload_signature: string | null
          professional_id: string
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          certification_status?: string
          certification_tier: string
          created_at?: string
          id?: string
          issued_at?: string
          justification_data?: Json | null
          last_verified_at?: string
          markets_covered?: string[]
          methodology_version?: string
          neighborhoods_covered?: string[]
          next_verification_due: string
          payload_hash?: string | null
          payload_signature?: string | null
          professional_id: string
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          certification_status?: string
          certification_tier?: string
          created_at?: string
          id?: string
          issued_at?: string
          justification_data?: Json | null
          last_verified_at?: string
          markets_covered?: string[]
          methodology_version?: string
          neighborhoods_covered?: string[]
          next_verification_due?: string
          payload_hash?: string | null
          payload_signature?: string | null
          professional_id?: string
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          lat: number | null
          lon: number | null
          name: string
          slug: string
          state: string
          state_slug: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name: string
          slug: string
          state: string
          state_slug: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string
          slug?: string
          state?: string
          state_slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      city_agent_counts: {
        Row: {
          agent_count: number
          city_name: string
          city_slug: string
          id: string
          last_updated: string | null
        }
        Insert: {
          agent_count?: number
          city_name: string
          city_slug: string
          id?: string
          last_updated?: string | null
        }
        Update: {
          agent_count?: number
          city_name?: string
          city_slug?: string
          id?: string
          last_updated?: string | null
        }
        Relationships: []
      }
      cloudflare_request_logs: {
        Row: {
          agent_id: string | null
          bot_type: string | null
          cache_response_status: number | null
          cache_status: string | null
          client_ip: string | null
          country: string | null
          created_at: string | null
          id: string
          is_bot: boolean | null
          method: string | null
          path: string | null
          raw_log: Json | null
          ray_id: string | null
          timestamp: string
          url: string
          user_agent: string | null
        }
        Insert: {
          agent_id?: string | null
          bot_type?: string | null
          cache_response_status?: number | null
          cache_status?: string | null
          client_ip?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_bot?: boolean | null
          method?: string | null
          path?: string | null
          raw_log?: Json | null
          ray_id?: string | null
          timestamp: string
          url: string
          user_agent?: string | null
        }
        Update: {
          agent_id?: string | null
          bot_type?: string | null
          cache_response_status?: number | null
          cache_status?: string | null
          client_ip?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_bot?: boolean | null
          method?: string | null
          path?: string | null
          raw_log?: Json | null
          ray_id?: string | null
          timestamp?: string
          url?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          message: string | null
          phone: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          website?: string | null
        }
        Relationships: []
      }
      enrichment_queue: {
        Row: {
          category_id: string | null
          category_name: string | null
          city_id: string | null
          city_name: string | null
          completed_at: string | null
          created_at: string | null
          current_index: number | null
          error_message: string | null
          failed_items: number | null
          id: string
          job_type: string | null
          paused_at: string | null
          processed_items: number | null
          started_at: string | null
          status: string | null
          successful_items: number | null
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          city_id?: string | null
          city_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_index?: number | null
          error_message?: string | null
          failed_items?: number | null
          id?: string
          job_type?: string | null
          paused_at?: string | null
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          successful_items?: number | null
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          city_id?: string | null
          city_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_index?: number | null
          error_message?: string | null
          failed_items?: number | null
          id?: string
          job_type?: string | null
          paused_at?: string | null
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          successful_items?: number | null
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_name: string
          id: string
          professional_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_name: string
          id?: string
          professional_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_name?: string
          id?: string
          professional_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          key: string
          metadata: Json | null
          page: string
          section: string | null
          type: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          key: string
          metadata?: Json | null
          page: string
          section?: string | null
          type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          key?: string
          metadata?: Json | null
          page?: string
          section?: string | null
          type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      neighborhood_catalog: {
        Row: {
          city_area: string
          city_area_slug: string
          county: string | null
          created_at: string | null
          id: string
          income_pct: number | null
          is_active: boolean | null
          is_verified: boolean | null
          lat: number | null
          lon: number | null
          median_home_value: number | null
          median_income: number | null
          nearby_neighborhoods: string | null
          neighborhood: string
          neighborhood_slug: string
          primary_zip: string | null
          score: number | null
          source: string | null
          state: string
          tier: string | null
          updated_at: string | null
          value_pct: number | null
          writeup_generated_at: string | null
          writeup_html: string | null
          writeup_research: string | null
          zillow_region_id: string | null
          zips: Json | null
        }
        Insert: {
          city_area: string
          city_area_slug: string
          county?: string | null
          created_at?: string | null
          id?: string
          income_pct?: number | null
          is_active?: boolean | null
          is_verified?: boolean | null
          lat?: number | null
          lon?: number | null
          median_home_value?: number | null
          median_income?: number | null
          nearby_neighborhoods?: string | null
          neighborhood: string
          neighborhood_slug: string
          primary_zip?: string | null
          score?: number | null
          source?: string | null
          state: string
          tier?: string | null
          updated_at?: string | null
          value_pct?: number | null
          writeup_generated_at?: string | null
          writeup_html?: string | null
          writeup_research?: string | null
          zillow_region_id?: string | null
          zips?: Json | null
        }
        Update: {
          city_area?: string
          city_area_slug?: string
          county?: string | null
          created_at?: string | null
          id?: string
          income_pct?: number | null
          is_active?: boolean | null
          is_verified?: boolean | null
          lat?: number | null
          lon?: number | null
          median_home_value?: number | null
          median_income?: number | null
          nearby_neighborhoods?: string | null
          neighborhood?: string
          neighborhood_slug?: string
          primary_zip?: string | null
          score?: number | null
          source?: string | null
          state?: string
          tier?: string | null
          updated_at?: string | null
          value_pct?: number | null
          writeup_generated_at?: string | null
          writeup_html?: string | null
          writeup_research?: string | null
          zillow_region_id?: string | null
          zips?: Json | null
        }
        Relationships: []
      }
      pipedrive_sync_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          id: string
          last_error: string | null
          max_attempts: number | null
          next_retry_at: string | null
          professional_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          professional_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          professional_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_sync_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      pipedrive_sync_state: {
        Row: {
          created_at: string | null
          id: string
          last_sync_hash: string | null
          last_synced_at: string | null
          last_synced_data: Json | null
          pipedrive_person_id: number | null
          professional_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_sync_hash?: string | null
          last_synced_at?: string | null
          last_synced_data?: Json | null
          pipedrive_person_id?: number | null
          professional_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_hash?: string | null
          last_synced_at?: string | null
          last_synced_data?: Json | null
          pipedrive_person_id?: number | null
          professional_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_sync_state_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_cities: {
        Row: {
          active: boolean | null
          city_id: string | null
          created_at: string | null
          id: string
          professional_id: string | null
          rank: number | null
        }
        Insert: {
          active?: boolean | null
          city_id?: string | null
          created_at?: string | null
          id?: string
          professional_id?: string | null
          rank?: number | null
        }
        Update: {
          active?: boolean | null
          city_id?: string | null
          created_at?: string | null
          id?: string
          professional_id?: string | null
          rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_cities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_cities_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean | null
          active_for_rent_count: number | null
          active_for_sale_count: number | null
          address: string | null
          agent_licenses: Json | null
          agent_sales_stats: Json | null
          average_value_3yr: number | null
          awards_verified: Json | null
          badge_status: string | null
          badge_tier: string | null
          badges: Json | null
          business_address: Json | null
          business_city: string | null
          business_name: string | null
          business_state: string | null
          business_zip: string | null
          canonical_slug: string | null
          card_created_at: string | null
          category_id: string | null
          cell_phone: string | null
          certifications: Json | null
          certifications_verified: Json | null
          checkout_started_at: string | null
          cities_subscribed: Json | null
          city_id: string | null
          claim_notes: string | null
          claim_status: string | null
          claimed_at: string | null
          claimed_by: string | null
          community_roles: Json | null
          company: string | null
          cpd_user_pronouns: string | null
          created_at: string | null
          current_listings: number | null
          data_sources_log: Json | null
          description: string | null
          email: string | null
          email_provider: string | null
          email_verified_at: string | null
          encoded_zuid: string | null
          free_pool_position: number | null
          funnel_completed_at: string | null
          funnel_started_at: string | null
          funnel_status: string | null
          get_to_know_me: string | null
          grace_period_ends_at: string | null
          has_recent_review: boolean | null
          headline: string | null
          id: string
          image_url: string | null
          in_canada: boolean | null
          is_brand_builder: boolean | null
          is_premier_agent: boolean | null
          is_team_lead: boolean | null
          is_top_agent: boolean | null
          languages: Json | null
          last_payment_at: string | null
          last_payment_status: string | null
          legacy_url_slug: string | null
          license_expires_at: string | null
          license_issued_at: string | null
          license_number: string | null
          license_status: string | null
          license_type: string | null
          license_verified_at: string | null
          monthly_revenue_cents: number | null
          most_recent_review_date: string | null
          name: string | null
          notable_achievements: Json | null
          num_total_reviews: number | null
          og_image_url: string | null
          paid_cities: Json | null
          past_sales: Json | null
          payment_failed_at: string | null
          phone: string | null
          phone_numbers: Json | null
          platform_reviews: Json | null
          press_mentions: Json | null
          previous_short_codes: Json | null
          price_range_3yr_max: number | null
          price_range_3yr_min: number | null
          professional_data: Json | null
          professional_information: Json | null
          profile_image_id: string | null
          profile_last_synthesized_at: string | null
          profile_link: string | null
          profile_type_ids: Json | null
          profile_types: Json | null
          promo_code_used: string | null
          publications: Json | null
          qualification_status: string | null
          rank: number | null
          ratings: Json | null
          raw_scraper_data: Json | null
          review_link: string | null
          review_stars_rating: number | null
          reviews_data: Json | null
          reviews_text: string | null
          sales_count_all_time: number | null
          sales_count_last_year: number | null
          screen_name: string | null
          selection_rationale: string | null
          selection_rationale_generated_at: string | null
          served_cities: Json | null
          service_areas: Json | null
          short_code: string | null
          sidebar_video_url: string | null
          skip_pipedrive_sync: boolean | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_twitter: string | null
          specialty: Json | null
          state_slug: string | null
          stats_include_team: boolean | null
          subscription_status: string | null
          synthesized_bio: string | null
          team_display_information: Json | null
          team_lead_zuid: string | null
          title: string | null
          total_sales: number | null
          type: string | null
          updated_at: string | null
          verification_started_at: string | null
          verification_token: string | null
          verification_token_expires_at: string | null
          website: string | null
          years_experience: number | null
          zillow_data_fetched_at: string | null
          zillow_data_source: string | null
          zillow_flag: string | null
          zillow_last_scraped_at: string | null
          zillow_member_since: string | null
          zillow_profile_url: string | null
          zillow_rank_captured_at: string | null
          zillow_scrape_error: string | null
          zillow_scrape_status: string | null
          zillow_search_city: string | null
          zillow_search_page: number | null
          zillow_search_position: number | null
          zillow_search_total: number | null
          zip_code: string | null
          zuid: string | null
        }
        Insert: {
          active?: boolean | null
          active_for_rent_count?: number | null
          active_for_sale_count?: number | null
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          average_value_3yr?: number | null
          awards_verified?: Json | null
          badge_status?: string | null
          badge_tier?: string | null
          badges?: Json | null
          business_address?: Json | null
          business_city?: string | null
          business_name?: string | null
          business_state?: string | null
          business_zip?: string | null
          canonical_slug?: string | null
          card_created_at?: string | null
          category_id?: string | null
          cell_phone?: string | null
          certifications?: Json | null
          certifications_verified?: Json | null
          checkout_started_at?: string | null
          cities_subscribed?: Json | null
          city_id?: string | null
          claim_notes?: string | null
          claim_status?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          community_roles?: Json | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string | null
          current_listings?: number | null
          data_sources_log?: Json | null
          description?: string | null
          email?: string | null
          email_provider?: string | null
          email_verified_at?: string | null
          encoded_zuid?: string | null
          free_pool_position?: number | null
          funnel_completed_at?: string | null
          funnel_started_at?: string | null
          funnel_status?: string | null
          get_to_know_me?: string | null
          grace_period_ends_at?: string | null
          has_recent_review?: boolean | null
          headline?: string | null
          id?: string
          image_url?: string | null
          in_canada?: boolean | null
          is_brand_builder?: boolean | null
          is_premier_agent?: boolean | null
          is_team_lead?: boolean | null
          is_top_agent?: boolean | null
          languages?: Json | null
          last_payment_at?: string | null
          last_payment_status?: string | null
          legacy_url_slug?: string | null
          license_expires_at?: string | null
          license_issued_at?: string | null
          license_number?: string | null
          license_status?: string | null
          license_type?: string | null
          license_verified_at?: string | null
          monthly_revenue_cents?: number | null
          most_recent_review_date?: string | null
          name?: string | null
          notable_achievements?: Json | null
          num_total_reviews?: number | null
          og_image_url?: string | null
          paid_cities?: Json | null
          past_sales?: Json | null
          payment_failed_at?: string | null
          phone?: string | null
          phone_numbers?: Json | null
          platform_reviews?: Json | null
          press_mentions?: Json | null
          previous_short_codes?: Json | null
          price_range_3yr_max?: number | null
          price_range_3yr_min?: number | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_image_id?: string | null
          profile_last_synthesized_at?: string | null
          profile_link?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          promo_code_used?: string | null
          publications?: Json | null
          qualification_status?: string | null
          rank?: number | null
          ratings?: Json | null
          raw_scraper_data?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          sales_count_all_time?: number | null
          sales_count_last_year?: number | null
          screen_name?: string | null
          selection_rationale?: string | null
          selection_rationale_generated_at?: string | null
          served_cities?: Json | null
          service_areas?: Json | null
          short_code?: string | null
          sidebar_video_url?: string | null
          skip_pipedrive_sync?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          specialty?: Json | null
          state_slug?: string | null
          stats_include_team?: boolean | null
          subscription_status?: string | null
          synthesized_bio?: string | null
          team_display_information?: Json | null
          team_lead_zuid?: string | null
          title?: string | null
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
          verification_started_at?: string | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_data_fetched_at?: string | null
          zillow_data_source?: string | null
          zillow_flag?: string | null
          zillow_last_scraped_at?: string | null
          zillow_member_since?: string | null
          zillow_profile_url?: string | null
          zillow_rank_captured_at?: string | null
          zillow_scrape_error?: string | null
          zillow_scrape_status?: string | null
          zillow_search_city?: string | null
          zillow_search_page?: number | null
          zillow_search_position?: number | null
          zillow_search_total?: number | null
          zip_code?: string | null
          zuid?: string | null
        }
        Update: {
          active?: boolean | null
          active_for_rent_count?: number | null
          active_for_sale_count?: number | null
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          average_value_3yr?: number | null
          awards_verified?: Json | null
          badge_status?: string | null
          badge_tier?: string | null
          badges?: Json | null
          business_address?: Json | null
          business_city?: string | null
          business_name?: string | null
          business_state?: string | null
          business_zip?: string | null
          canonical_slug?: string | null
          card_created_at?: string | null
          category_id?: string | null
          cell_phone?: string | null
          certifications?: Json | null
          certifications_verified?: Json | null
          checkout_started_at?: string | null
          cities_subscribed?: Json | null
          city_id?: string | null
          claim_notes?: string | null
          claim_status?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          community_roles?: Json | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string | null
          current_listings?: number | null
          data_sources_log?: Json | null
          description?: string | null
          email?: string | null
          email_provider?: string | null
          email_verified_at?: string | null
          encoded_zuid?: string | null
          free_pool_position?: number | null
          funnel_completed_at?: string | null
          funnel_started_at?: string | null
          funnel_status?: string | null
          get_to_know_me?: string | null
          grace_period_ends_at?: string | null
          has_recent_review?: boolean | null
          headline?: string | null
          id?: string
          image_url?: string | null
          in_canada?: boolean | null
          is_brand_builder?: boolean | null
          is_premier_agent?: boolean | null
          is_team_lead?: boolean | null
          is_top_agent?: boolean | null
          languages?: Json | null
          last_payment_at?: string | null
          last_payment_status?: string | null
          legacy_url_slug?: string | null
          license_expires_at?: string | null
          license_issued_at?: string | null
          license_number?: string | null
          license_status?: string | null
          license_type?: string | null
          license_verified_at?: string | null
          monthly_revenue_cents?: number | null
          most_recent_review_date?: string | null
          name?: string | null
          notable_achievements?: Json | null
          num_total_reviews?: number | null
          og_image_url?: string | null
          paid_cities?: Json | null
          past_sales?: Json | null
          payment_failed_at?: string | null
          phone?: string | null
          phone_numbers?: Json | null
          platform_reviews?: Json | null
          press_mentions?: Json | null
          previous_short_codes?: Json | null
          price_range_3yr_max?: number | null
          price_range_3yr_min?: number | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_image_id?: string | null
          profile_last_synthesized_at?: string | null
          profile_link?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          promo_code_used?: string | null
          publications?: Json | null
          qualification_status?: string | null
          rank?: number | null
          ratings?: Json | null
          raw_scraper_data?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          sales_count_all_time?: number | null
          sales_count_last_year?: number | null
          screen_name?: string | null
          selection_rationale?: string | null
          selection_rationale_generated_at?: string | null
          served_cities?: Json | null
          service_areas?: Json | null
          short_code?: string | null
          sidebar_video_url?: string | null
          skip_pipedrive_sync?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          specialty?: Json | null
          state_slug?: string | null
          stats_include_team?: boolean | null
          subscription_status?: string | null
          synthesized_bio?: string | null
          team_display_information?: Json | null
          team_lead_zuid?: string | null
          title?: string | null
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
          verification_started_at?: string | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_data_fetched_at?: string | null
          zillow_data_source?: string | null
          zillow_flag?: string | null
          zillow_last_scraped_at?: string | null
          zillow_member_since?: string | null
          zillow_profile_url?: string | null
          zillow_rank_captured_at?: string | null
          zillow_scrape_error?: string | null
          zillow_scrape_status?: string | null
          zillow_search_city?: string | null
          zillow_search_page?: number | null
          zillow_search_position?: number | null
          zillow_search_total?: number | null
          zip_code?: string | null
          zuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number | null
          created_at: string | null
          id: string
          key: string
          window_start: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          id?: string
          key: string
          window_start?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          id?: string
          key?: string
          window_start?: string | null
        }
        Relationships: []
      }
      state_licenses: {
        Row: {
          avg_price: number | null
          bio: string | null
          brokerage_name: string | null
          city: string | null
          created_at: string | null
          email: string | null
          exa_prequalified: boolean | null
          exa_rating: number | null
          exa_reviews: number | null
          exa_score: number | null
          exa_search_notes: string | null
          exa_searched_at: string | null
          id: string
          license_number: string
          license_type: string | null
          memo23_error: string | null
          memo23_rating: number | null
          memo23_reviews: number | null
          memo23_status: string | null
          name: string | null
          phone: string | null
          price_range_max: number | null
          price_range_min: number | null
          professional_id: string | null
          sales_last_12_months: number | null
          service_areas: Json | null
          specialties: Json | null
          state: string
          total_sales: number | null
          updated_at: string | null
          website: string | null
          years_experience: number | null
          zillow_error: string | null
          zillow_rating: number | null
          zillow_reviews: number | null
          zillow_reviews_json: Json | null
          zillow_scraped_at: string | null
          zillow_status: string | null
          zillow_url: string | null
        }
        Insert: {
          avg_price?: number | null
          bio?: string | null
          brokerage_name?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          exa_prequalified?: boolean | null
          exa_rating?: number | null
          exa_reviews?: number | null
          exa_score?: number | null
          exa_search_notes?: string | null
          exa_searched_at?: string | null
          id?: string
          license_number: string
          license_type?: string | null
          memo23_error?: string | null
          memo23_rating?: number | null
          memo23_reviews?: number | null
          memo23_status?: string | null
          name?: string | null
          phone?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          professional_id?: string | null
          sales_last_12_months?: number | null
          service_areas?: Json | null
          specialties?: Json | null
          state: string
          total_sales?: number | null
          updated_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_error?: string | null
          zillow_rating?: number | null
          zillow_reviews?: number | null
          zillow_reviews_json?: Json | null
          zillow_scraped_at?: string | null
          zillow_status?: string | null
          zillow_url?: string | null
        }
        Update: {
          avg_price?: number | null
          bio?: string | null
          brokerage_name?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          exa_prequalified?: boolean | null
          exa_rating?: number | null
          exa_reviews?: number | null
          exa_score?: number | null
          exa_search_notes?: string | null
          exa_searched_at?: string | null
          id?: string
          license_number?: string
          license_type?: string | null
          memo23_error?: string | null
          memo23_rating?: number | null
          memo23_reviews?: number | null
          memo23_status?: string | null
          name?: string | null
          phone?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          professional_id?: string | null
          sales_last_12_months?: number | null
          service_areas?: Json | null
          specialties?: Json | null
          state?: string
          total_sales?: number | null
          updated_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_error?: string | null
          zillow_rating?: number | null
          zillow_reviews?: number | null
          zillow_reviews_json?: Json | null
          zillow_scraped_at?: string | null
          zillow_status?: string | null
          zillow_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      zip_adjacency: {
        Row: {
          adjacent_zip: string
          created_at: string | null
          distance_miles: number
          id: string
          zip_code: string
        }
        Insert: {
          adjacent_zip: string
          created_at?: string | null
          distance_miles: number
          id?: string
          zip_code: string
        }
        Update: {
          adjacent_zip?: string
          created_at?: string | null
          distance_miles?: number
          id?: string
          zip_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_bot_stats: {
        Args: { start_date: string }
        Returns: {
          bot_type: string
          cache_hits: number
          cache_misses: number
          total_visits: number
        }[]
      }
      search_location: {
        Args: { search_term: string; state_filter?: string }
        Returns: {
          city_area: string
          city_area_slug: string
          city_id: string
          match_score: number
          median_home_value: number
          neighborhood: string
          neighborhood_slug: string
          primary_zip: string
          result_type: string
          state: string
          tier: string
        }[]
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
