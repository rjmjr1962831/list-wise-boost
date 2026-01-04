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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_applications: {
        Row: {
          ai_generated_bio: string | null
          bio: string
          brokerage_name: string
          cities: string[]
          created_at: string
          current_step: number | null
          email: string
          email_verified: boolean | null
          full_name: string
          home_url: string | null
          id: string
          is_team_member: boolean
          license_number: string
          license_verified: boolean
          monthly_cost: number | null
          phone: string
          profile_accepted: boolean | null
          publish_email: boolean
          redfin_url: string | null
          selected_specialties: string[] | null
          specialties: string[]
          state: string
          status: string
          team_name: string | null
          updated_at: string
          user_id: string | null
          website: string
          zillow_url: string | null
          zip_codes: Json
        }
        Insert: {
          ai_generated_bio?: string | null
          bio: string
          brokerage_name: string
          cities?: string[]
          created_at?: string
          current_step?: number | null
          email: string
          email_verified?: boolean | null
          full_name: string
          home_url?: string | null
          id?: string
          is_team_member?: boolean
          license_number: string
          license_verified?: boolean
          monthly_cost?: number | null
          phone: string
          profile_accepted?: boolean | null
          publish_email?: boolean
          redfin_url?: string | null
          selected_specialties?: string[] | null
          specialties?: string[]
          state: string
          status?: string
          team_name?: string | null
          updated_at?: string
          user_id?: string | null
          website: string
          zillow_url?: string | null
          zip_codes?: Json
        }
        Update: {
          ai_generated_bio?: string | null
          bio?: string
          brokerage_name?: string
          cities?: string[]
          created_at?: string
          current_step?: number | null
          email?: string
          email_verified?: boolean | null
          full_name?: string
          home_url?: string | null
          id?: string
          is_team_member?: boolean
          license_number?: string
          license_verified?: boolean
          monthly_cost?: number | null
          phone?: string
          profile_accepted?: boolean | null
          publish_email?: boolean
          redfin_url?: string | null
          selected_specialties?: string[] | null
          specialties?: string[]
          state?: string
          status?: string
          team_name?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string
          zillow_url?: string | null
          zip_codes?: Json
        }
        Relationships: []
      }
      agent_city_subscriptions: {
        Row: {
          city_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          price_paid: number | null
          professional_id: string
          started_at: string | null
          stripe_subscription_id: string | null
          subscription_type: string
          updated_at: string | null
        }
        Insert: {
          city_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          price_paid?: number | null
          professional_id: string
          started_at?: string | null
          stripe_subscription_id?: string | null
          subscription_type: string
          updated_at?: string | null
        }
        Update: {
          city_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          price_paid?: number | null
          professional_id?: string
          started_at?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_city_subscriptions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "arizona_city_pricing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_city_subscriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_city_subscriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_subscriptions: {
        Row: {
          consent: boolean
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          consent?: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          consent?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointment_types: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          duration_minutes: number
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_minutes?: number
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_minutes?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_type_id: string | null
          created_at: string
          email: string
          end_time: string
          id: string
          location: string | null
          meeting_link: string | null
          name: string
          phone: string
          reason: string
          start_time: string
          status: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_type_id?: string | null
          created_at?: string
          email: string
          end_time: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          name: string
          phone: string
          reason: string
          start_time: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_type_id?: string | null
          created_at?: string
          email?: string
          end_time?: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          name?: string
          phone?: string
          reason?: string
          start_time?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      arizona_city_pricing: {
        Row: {
          city_name: string
          city_slug: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          price_annual: number
          price_monthly: number
          state: string | null
          state_abbr: string | null
          tier_name: string
          updated_at: string | null
          value_tier: number
          zip_codes: string[]
        }
        Insert: {
          city_name: string
          city_slug: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          price_annual: number
          price_monthly: number
          state?: string | null
          state_abbr?: string | null
          tier_name: string
          updated_at?: string | null
          value_tier: number
          zip_codes: string[]
        }
        Update: {
          city_name?: string
          city_slug?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          price_annual?: number
          price_monthly?: number
          state?: string | null
          state_abbr?: string | null
          tier_name?: string
          updated_at?: string | null
          value_tier?: number
          zip_codes?: string[]
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
      availability_slots: {
        Row: {
          active: boolean | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: []
      }
      bulk_capture_progress: {
        Row: {
          completed_at: string | null
          current_city: string | null
          current_index: number | null
          error_message: string | null
          id: string
          results: Json | null
          session_id: string
          started_at: string | null
          status: string
          total_cities: number
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          current_city?: string | null
          current_index?: number | null
          error_message?: string | null
          id?: string
          results?: Json | null
          session_id: string
          started_at?: string | null
          status?: string
          total_cities: number
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          current_city?: string | null
          current_index?: number | null
          error_message?: string | null
          id?: string
          results?: Json | null
          session_id?: string
          started_at?: string | null
          status?: string
          total_cities?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      cache_invalidation_queue: {
        Row: {
          attempts: number
          category_id: string
          city_id: string
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          processed_at: string | null
          reason: string
          status: string
        }
        Insert: {
          attempts?: number
          category_id: string
          city_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          processed_at?: string | null
          reason: string
          status?: string
        }
        Update: {
          attempts?: number
          category_id?: string
          city_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          processed_at?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cache_invalidation_queue_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cache_invalidation_queue_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_city_rankings: {
        Row: {
          category_id: string
          city_id: string
          created_at: string
          id: string
          last_calculated_at: string
          professional_id: string
          rank: number
          score: number
          updated_at: string
        }
        Insert: {
          category_id: string
          city_id: string
          created_at?: string
          id?: string
          last_calculated_at?: string
          professional_id: string
          rank: number
          score?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          city_id?: string
          created_at?: string
          id?: string
          last_calculated_at?: string
          professional_id?: string
          rank?: number
          score?: number
          updated_at?: string
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
          {
            foreignKeyName: "canonical_city_rankings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          plural_name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          plural_name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          plural_name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          state: string
          state_slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          state: string
          state_slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          state?: string
          state_slug?: string
          updated_at?: string
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
      contact_enrichment_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          professional_id: string
          reason: string
          stage: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          professional_id: string
          reason: string
          stage?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          professional_id?: string
          reason?: string
          stage?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_enrichment_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_enrichment_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          phone: string | null
          website: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          phone?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string | null
          website?: string | null
        }
        Relationships: []
      }
      email_verification_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          delay_seconds: number | null
          email: string
          error_message: string | null
          id: string
          max_attempts: number | null
          name: string
          priority: number | null
          professional_id: string
          started_at: string | null
          status: string
          verification_result: Json | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          delay_seconds?: number | null
          email: string
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          name: string
          priority?: number | null
          professional_id: string
          started_at?: string | null
          status?: string
          verification_result?: Json | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          delay_seconds?: number | null
          email?: string
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          name?: string
          priority?: number | null
          professional_id?: string
          started_at?: string | null
          status?: string
          verification_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_verification_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_verification_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_queue: {
        Row: {
          category_id: string | null
          category_name: string | null
          city_id: string | null
          city_name: string
          completed_at: string | null
          created_at: string
          current_index: number
          error_message: string | null
          failed_items: number
          id: string
          job_type: string
          paused_at: string | null
          processed_items: number
          started_at: string | null
          status: string
          successful_items: number
          total_items: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          city_id?: string | null
          city_name: string
          completed_at?: string | null
          created_at?: string
          current_index?: number
          error_message?: string | null
          failed_items?: number
          id?: string
          job_type: string
          paused_at?: string | null
          processed_items?: number
          started_at?: string | null
          status?: string
          successful_items?: number
          total_items?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          city_id?: string | null
          city_name?: string
          completed_at?: string | null
          created_at?: string
          current_index?: number
          error_message?: string | null
          failed_items?: number
          id?: string
          job_type?: string
          paused_at?: string | null
          processed_items?: number
          started_at?: string | null
          status?: string
          successful_items?: number
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_queue_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      field_change_requests: {
        Row: {
          change_request: string
          created_at: string
          current_value: string | null
          field_name: string
          id: string
          pipedrive_activity_id: number | null
          professional_id: string
          proposed_value: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          change_request: string
          created_at?: string
          current_value?: string | null
          field_name: string
          id?: string
          pipedrive_activity_id?: number | null
          professional_id: string
          proposed_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          change_request?: string
          created_at?: string
          current_value?: string | null
          field_name?: string
          id?: string
          pipedrive_activity_id?: number | null
          professional_id?: string
          proposed_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_change_requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_change_requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "funnel_events_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_content: {
        Row: {
          created_at: string
          id: string
          key: string
          page: string
          section: string
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          page: string
          section: string
          type?: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          page?: string
          section?: string
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount_cents: number
          cities_purchased: string[] | null
          created_at: string | null
          currency: string | null
          discount_amount_cents: number | null
          event_type: string
          failure_reason: string | null
          id: string
          package_name: string | null
          professional_id: string | null
          promo_code: string | null
          status: string
          stripe_charge_id: string | null
          stripe_event_id: string
          stripe_invoice_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          amount_cents: number
          cities_purchased?: string[] | null
          created_at?: string | null
          currency?: string | null
          discount_amount_cents?: number | null
          event_type: string
          failure_reason?: string | null
          id?: string
          package_name?: string | null
          professional_id?: string | null
          promo_code?: string | null
          status: string
          stripe_charge_id?: string | null
          stripe_event_id: string
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          cities_purchased?: string[] | null
          created_at?: string | null
          currency?: string | null
          discount_amount_cents?: number | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          package_name?: string | null
          professional_id?: string | null
          promo_code?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_event_id?: string
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pipedrive_field_mapping: {
        Row: {
          created_at: string | null
          field_name: string
          id: string
          pipedrive_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          field_name: string
          id?: string
          pipedrive_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          field_name?: string
          id?: string
          pipedrive_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pipedrive_org_cache: {
        Row: {
          created_at: string | null
          id: string
          org_name: string
          pipedrive_org_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_name: string
          pipedrive_org_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_name?: string
          pipedrive_org_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      pipedrive_sync_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          professional_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          professional_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          professional_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_sync_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipedrive_sync_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
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
          professional_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_sync_hash?: string | null
          last_synced_at?: string | null
          last_synced_data?: Json | null
          pipedrive_person_id?: number | null
          professional_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_hash?: string | null
          last_synced_at?: string | null
          last_synced_data?: Json | null
          pipedrive_person_id?: number | null
          professional_id?: string
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
          {
            foreignKeyName: "pipedrive_sync_state_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_state: {
        Row: {
          batch_size: number
          completed_at: string | null
          concurrency: number
          created_at: string
          current_index: number
          error_message: string | null
          id: string
          is_paused: boolean
          is_running: boolean
          last_run_at: string | null
          pipeline_name: string
          started_at: string | null
          state: string
          state_abbr: string
          total_duplicates: number
          total_errors: number
          total_no_results: number
          total_not_qualified: number
          total_processed: number
          total_qualified: number
          updated_at: string
        }
        Insert: {
          batch_size?: number
          completed_at?: string | null
          concurrency?: number
          created_at?: string
          current_index?: number
          error_message?: string | null
          id?: string
          is_paused?: boolean
          is_running?: boolean
          last_run_at?: string | null
          pipeline_name: string
          started_at?: string | null
          state: string
          state_abbr: string
          total_duplicates?: number
          total_errors?: number
          total_no_results?: number
          total_not_qualified?: number
          total_processed?: number
          total_qualified?: number
          updated_at?: string
        }
        Update: {
          batch_size?: number
          completed_at?: string | null
          concurrency?: number
          created_at?: string
          current_index?: number
          error_message?: string | null
          id?: string
          is_paused?: boolean
          is_running?: boolean
          last_run_at?: string | null
          pipeline_name?: string
          started_at?: string | null
          state?: string
          state_abbr?: string
          total_duplicates?: number
          total_errors?: number
          total_no_results?: number
          total_not_qualified?: number
          total_processed?: number
          total_qualified?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          cities_included: number | null
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price_annual: number | null
          price_monthly: number | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          cities_included?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price_annual?: number | null
          price_monthly?: number | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          cities_included?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price_annual?: number | null
          price_monthly?: number | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      professional_cities: {
        Row: {
          active: boolean
          city_id: string
          created_at: string | null
          id: string
          professional_id: string
          rank: number
        }
        Insert: {
          active?: boolean
          city_id: string
          created_at?: string | null
          id?: string
          professional_id: string
          rank?: number
        }
        Update: {
          active?: boolean
          city_id?: string
          created_at?: string | null
          id?: string
          professional_id?: string
          rank?: number
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
          {
            foreignKeyName: "professional_cities_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_claims: {
        Row: {
          admin_notes: string | null
          claim_message: string | null
          claim_status: Database["public"]["Enums"]["claim_status"]
          claimed_by: string
          created_at: string
          id: string
          professional_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          claim_message?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_by: string
          created_at?: string
          id?: string
          professional_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          claim_message?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_by?: string
          created_at?: string
          id?: string
          professional_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_claims_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_claims_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_reviews: {
        Row: {
          created_at: string
          id: string
          professional_id: string
          rating: number
          review_date: string
          review_text: string
          reviewer_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          professional_id: string
          rating: number
          review_date?: string
          review_text: string
          reviewer_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          professional_id?: string
          rating?: number
          review_date?: string
          review_text?: string
          reviewer_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_public"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          address: string | null
          agent_licenses: Json | null
          agent_sales_stats: Json | null
          awards_verified: Json | null
          badges: string[] | null
          business_address: Json | null
          business_name: string | null
          canonical_slug: string | null
          card_created_at: string | null
          category_id: string
          certifications: Json | null
          certifications_verified: Json | null
          checkout_started_at: string | null
          cities_subscribed: string[] | null
          city_id: string
          claim_notes: string | null
          claim_status: Database["public"]["Enums"]["claim_status"]
          claimed_at: string | null
          claimed_by: string | null
          community_roles: Json | null
          company: string | null
          cpd_user_pronouns: string | null
          created_at: string
          current_listings: number | null
          data_sources_log: Json | null
          description: string | null
          email: string | null
          email_verified_at: string | null
          encoded_zuid: string | null
          free_pool_position: number | null
          funnel_completed_at: string | null
          funnel_started_at: string | null
          funnel_status: string | null
          get_to_know_me: string | null
          has_recent_review: boolean | null
          headline: string | null
          id: string
          image_url: string | null
          in_canada: boolean | null
          is_brand_builder: boolean | null
          is_premier_agent: boolean | null
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
          name: string
          notable_achievements: Json | null
          num_total_reviews: number | null
          og_image_url: string | null
          paid_cities: string[] | null
          past_sales: Json | null
          phone: string | null
          phone_numbers: Json | null
          platform_reviews: Json | null
          press_mentions: Json | null
          professional_data: Json | null
          professional_information: Json | null
          profile_image_id: string | null
          profile_last_synthesized_at: string | null
          profile_link: string | null
          profile_type_ids: Json | null
          profile_types: Json | null
          promo_code_used: string | null
          publications: Json | null
          rank: number
          ratings: Json | null
          raw_scraper_data: Json | null
          review_link: string | null
          review_stars_rating: number | null
          reviews_data: Json | null
          reviews_text: string | null
          screen_name: string | null
          selection_rationale: string | null
          selection_rationale_generated_at: string | null
          served_cities: string[] | null
          service_areas: Json | null
          short_code: string | null
          sidebar_video_url: string | null
          skip_pipedrive_sync: boolean | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_twitter: string | null
          specialty: string[] | null
          state_slug: string | null
          subscription_status: string | null
          synthesized_bio: string | null
          team_display_information: Json | null
          title: string | null
          total_sales: number | null
          type: string
          updated_at: string
          verification_started_at: string | null
          verification_token: string | null
          verification_token_expires_at: string | null
          website: string | null
          years_experience: number | null
          zillow_data_fetched_at: string | null
          zillow_profile_url: string | null
          zillow_rank_captured_at: string | null
          zillow_search_city: string | null
          zillow_search_page: number | null
          zillow_search_position: number | null
          zillow_search_total: number | null
          zip_code: string | null
          zuid: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          awards_verified?: Json | null
          badges?: string[] | null
          business_address?: Json | null
          business_name?: string | null
          canonical_slug?: string | null
          card_created_at?: string | null
          category_id: string
          certifications?: Json | null
          certifications_verified?: Json | null
          checkout_started_at?: string | null
          cities_subscribed?: string[] | null
          city_id: string
          claim_notes?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_at?: string | null
          claimed_by?: string | null
          community_roles?: Json | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string
          current_listings?: number | null
          data_sources_log?: Json | null
          description?: string | null
          email?: string | null
          email_verified_at?: string | null
          encoded_zuid?: string | null
          free_pool_position?: number | null
          funnel_completed_at?: string | null
          funnel_started_at?: string | null
          funnel_status?: string | null
          get_to_know_me?: string | null
          has_recent_review?: boolean | null
          headline?: string | null
          id?: string
          image_url?: string | null
          in_canada?: boolean | null
          is_brand_builder?: boolean | null
          is_premier_agent?: boolean | null
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
          name: string
          notable_achievements?: Json | null
          num_total_reviews?: number | null
          og_image_url?: string | null
          paid_cities?: string[] | null
          past_sales?: Json | null
          phone?: string | null
          phone_numbers?: Json | null
          platform_reviews?: Json | null
          press_mentions?: Json | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_image_id?: string | null
          profile_last_synthesized_at?: string | null
          profile_link?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          promo_code_used?: string | null
          publications?: Json | null
          rank: number
          ratings?: Json | null
          raw_scraper_data?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          screen_name?: string | null
          selection_rationale?: string | null
          selection_rationale_generated_at?: string | null
          served_cities?: string[] | null
          service_areas?: Json | null
          short_code?: string | null
          sidebar_video_url?: string | null
          skip_pipedrive_sync?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          specialty?: string[] | null
          state_slug?: string | null
          subscription_status?: string | null
          synthesized_bio?: string | null
          team_display_information?: Json | null
          title?: string | null
          total_sales?: number | null
          type: string
          updated_at?: string
          verification_started_at?: string | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_data_fetched_at?: string | null
          zillow_profile_url?: string | null
          zillow_rank_captured_at?: string | null
          zillow_search_city?: string | null
          zillow_search_page?: number | null
          zillow_search_position?: number | null
          zillow_search_total?: number | null
          zip_code?: string | null
          zuid?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          awards_verified?: Json | null
          badges?: string[] | null
          business_address?: Json | null
          business_name?: string | null
          canonical_slug?: string | null
          card_created_at?: string | null
          category_id?: string
          certifications?: Json | null
          certifications_verified?: Json | null
          checkout_started_at?: string | null
          cities_subscribed?: string[] | null
          city_id?: string
          claim_notes?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_at?: string | null
          claimed_by?: string | null
          community_roles?: Json | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string
          current_listings?: number | null
          data_sources_log?: Json | null
          description?: string | null
          email?: string | null
          email_verified_at?: string | null
          encoded_zuid?: string | null
          free_pool_position?: number | null
          funnel_completed_at?: string | null
          funnel_started_at?: string | null
          funnel_status?: string | null
          get_to_know_me?: string | null
          has_recent_review?: boolean | null
          headline?: string | null
          id?: string
          image_url?: string | null
          in_canada?: boolean | null
          is_brand_builder?: boolean | null
          is_premier_agent?: boolean | null
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
          name?: string
          notable_achievements?: Json | null
          num_total_reviews?: number | null
          og_image_url?: string | null
          paid_cities?: string[] | null
          past_sales?: Json | null
          phone?: string | null
          phone_numbers?: Json | null
          platform_reviews?: Json | null
          press_mentions?: Json | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_image_id?: string | null
          profile_last_synthesized_at?: string | null
          profile_link?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          promo_code_used?: string | null
          publications?: Json | null
          rank?: number
          ratings?: Json | null
          raw_scraper_data?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          screen_name?: string | null
          selection_rationale?: string | null
          selection_rationale_generated_at?: string | null
          served_cities?: string[] | null
          service_areas?: Json | null
          short_code?: string | null
          sidebar_video_url?: string | null
          skip_pipedrive_sync?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          specialty?: string[] | null
          state_slug?: string | null
          subscription_status?: string | null
          synthesized_bio?: string | null
          team_display_information?: Json | null
          title?: string | null
          total_sales?: number | null
          type?: string
          updated_at?: string
          verification_started_at?: string | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_data_fetched_at?: string | null
          zillow_profile_url?: string | null
          zillow_rank_captured_at?: string | null
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
      prospects: {
        Row: {
          agents_ahead: number | null
          city: string | null
          company: string | null
          created_at: string
          email: string
          email_snippet: string | null
          hubspot_contact_id: string | null
          hubspot_last_error: string | null
          hubspot_synced: boolean | null
          hubspot_synced_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          pipedrive_last_error: string | null
          pipedrive_person_id: number | null
          pipedrive_synced: boolean | null
          pipedrive_synced_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["prospect_status"] | null
          updated_at: string
          zillow_page: number | null
          zillow_photo_url: string | null
          zillow_position: number | null
          zillow_profile_id: string | null
          zillow_profile_url: string | null
          zillow_rating: number | null
          zillow_reviews: number | null
          zillow_sales_count: number | null
          zillow_sales_volume: string | null
          zillow_scraped_at: string | null
          zillow_total_agents: number | null
        }
        Insert: {
          agents_ahead?: number | null
          city?: string | null
          company?: string | null
          created_at?: string
          email: string
          email_snippet?: string | null
          hubspot_contact_id?: string | null
          hubspot_last_error?: string | null
          hubspot_synced?: boolean | null
          hubspot_synced_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          pipedrive_last_error?: string | null
          pipedrive_person_id?: number | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["prospect_status"] | null
          updated_at?: string
          zillow_page?: number | null
          zillow_photo_url?: string | null
          zillow_position?: number | null
          zillow_profile_id?: string | null
          zillow_profile_url?: string | null
          zillow_rating?: number | null
          zillow_reviews?: number | null
          zillow_sales_count?: number | null
          zillow_sales_volume?: string | null
          zillow_scraped_at?: string | null
          zillow_total_agents?: number | null
        }
        Update: {
          agents_ahead?: number | null
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string
          email_snippet?: string | null
          hubspot_contact_id?: string | null
          hubspot_last_error?: string | null
          hubspot_synced?: boolean | null
          hubspot_synced_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pipedrive_last_error?: string | null
          pipedrive_person_id?: number | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["prospect_status"] | null
          updated_at?: string
          zillow_page?: number | null
          zillow_photo_url?: string | null
          zillow_position?: number | null
          zillow_profile_id?: string | null
          zillow_profile_url?: string | null
          zillow_rating?: number | null
          zillow_reviews?: number | null
          zillow_sales_count?: number | null
          zillow_sales_volume?: string | null
          zillow_scraped_at?: string | null
          zillow_total_agents?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          brokerage: string
          created_at: string
          email: string
          estimated_transactions: string | null
          full_name: string
          id: string
          license_number: string
          message: string | null
          notes: string | null
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          years_licensed: number | null
        }
        Insert: {
          brokerage: string
          created_at?: string
          email: string
          estimated_transactions?: string | null
          full_name: string
          id?: string
          license_number: string
          message?: string | null
          notes?: string | null
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          years_licensed?: number | null
        }
        Update: {
          brokerage?: string
          created_at?: string
          email?: string
          estimated_transactions?: string | null
          full_name?: string
          id?: string
          license_number?: string
          message?: string | null
          notes?: string | null
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          years_licensed?: number | null
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          agents_found: number | null
          agents_saved: number | null
          apify_run_id: string | null
          city: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          started_at: string | null
          state: string
          status: string
        }
        Insert: {
          agents_found?: number | null
          agents_saved?: number | null
          apify_run_id?: string | null
          city: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          state: string
          status?: string
        }
        Update: {
          agents_found?: number | null
          agents_saved?: number | null
          apify_run_id?: string | null
          city?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          state?: string
          status?: string
        }
        Relationships: []
      }
      specialties: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      state_licenses: {
        Row: {
          avg_price: number | null
          bio: string | null
          brokerage_name: string | null
          city: string | null
          created_at: string | null
          email: string | null
          exa_search_notes: string | null
          exa_searched_at: string | null
          id: string
          license_number: string
          license_type: string | null
          name: string
          phone: string | null
          price_range_max: number | null
          price_range_min: number | null
          sales_last_12_months: number | null
          service_areas: string | null
          specialties: string | null
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
          exa_search_notes?: string | null
          exa_searched_at?: string | null
          id?: string
          license_number: string
          license_type?: string | null
          name: string
          phone?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          sales_last_12_months?: number | null
          service_areas?: string | null
          specialties?: string | null
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
          exa_search_notes?: string | null
          exa_searched_at?: string | null
          id?: string
          license_number?: string
          license_type?: string | null
          name?: string
          phone?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          sales_last_12_months?: number | null
          service_areas?: string | null
          specialties?: string | null
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
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zillow_search_results: {
        Row: {
          agent_name: string
          city: string
          created_at: string
          id: string
          state: string
          status: string
          updated_at: string
          zillow_rating: number | null
          zillow_reviews: number | null
          zillow_url: string | null
        }
        Insert: {
          agent_name: string
          city: string
          created_at?: string
          id?: string
          state: string
          status?: string
          updated_at?: string
          zillow_rating?: number | null
          zillow_reviews?: number | null
          zillow_url?: string | null
        }
        Update: {
          agent_name?: string
          city?: string
          created_at?: string
          id?: string
          state?: string
          status?: string
          updated_at?: string
          zillow_rating?: number | null
          zillow_reviews?: number | null
          zillow_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      professionals_public: {
        Row: {
          active: boolean | null
          address: string | null
          agent_licenses: Json | null
          agent_sales_stats: Json | null
          awards_verified: Json | null
          badges: string[] | null
          business_address: Json | null
          business_name: string | null
          card_created_at: string | null
          category_id: string | null
          certifications: Json | null
          certifications_verified: Json | null
          city_id: string | null
          community_roles: Json | null
          company: string | null
          cpd_user_pronouns: string | null
          created_at: string | null
          current_listings: number | null
          description: string | null
          email: string | null
          get_to_know_me: string | null
          has_recent_review: boolean | null
          headline: string | null
          id: string | null
          image_url: string | null
          is_brand_builder: boolean | null
          is_premier_agent: boolean | null
          is_top_agent: boolean | null
          languages: Json | null
          license_expires_at: string | null
          license_issued_at: string | null
          license_number: string | null
          license_status: string | null
          license_type: string | null
          most_recent_review_date: string | null
          name: string | null
          notable_achievements: Json | null
          num_total_reviews: number | null
          og_image_url: string | null
          past_sales: Json | null
          phone: string | null
          platform_reviews: Json | null
          press_mentions: Json | null
          professional_data: Json | null
          professional_information: Json | null
          profile_link: string | null
          profile_type_ids: Json | null
          profile_types: Json | null
          publications: Json | null
          rank: number | null
          ratings: Json | null
          review_link: string | null
          review_stars_rating: number | null
          reviews_data: Json | null
          reviews_text: string | null
          selection_rationale: string | null
          service_areas: Json | null
          sidebar_video_url: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_twitter: string | null
          specialty: string[] | null
          synthesized_bio: string | null
          team_display_information: Json | null
          title: string | null
          total_sales: number | null
          type: string | null
          updated_at: string | null
          website: string | null
          years_experience: number | null
          zillow_data_fetched_at: string | null
          zillow_profile_url: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          awards_verified?: Json | null
          badges?: string[] | null
          business_address?: Json | null
          business_name?: string | null
          card_created_at?: string | null
          category_id?: string | null
          certifications?: Json | null
          certifications_verified?: Json | null
          city_id?: string | null
          community_roles?: Json | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string | null
          current_listings?: number | null
          description?: string | null
          email?: string | null
          get_to_know_me?: string | null
          has_recent_review?: boolean | null
          headline?: string | null
          id?: string | null
          image_url?: string | null
          is_brand_builder?: boolean | null
          is_premier_agent?: boolean | null
          is_top_agent?: boolean | null
          languages?: Json | null
          license_expires_at?: string | null
          license_issued_at?: string | null
          license_number?: string | null
          license_status?: string | null
          license_type?: string | null
          most_recent_review_date?: string | null
          name?: string | null
          notable_achievements?: Json | null
          num_total_reviews?: number | null
          og_image_url?: string | null
          past_sales?: Json | null
          phone?: string | null
          platform_reviews?: Json | null
          press_mentions?: Json | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_link?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          publications?: Json | null
          rank?: number | null
          ratings?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          selection_rationale?: string | null
          service_areas?: Json | null
          sidebar_video_url?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          specialty?: string[] | null
          synthesized_bio?: string | null
          team_display_information?: Json | null
          title?: string | null
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_data_fetched_at?: string | null
          zillow_profile_url?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          awards_verified?: Json | null
          badges?: string[] | null
          business_address?: Json | null
          business_name?: string | null
          card_created_at?: string | null
          category_id?: string | null
          certifications?: Json | null
          certifications_verified?: Json | null
          city_id?: string | null
          community_roles?: Json | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string | null
          current_listings?: number | null
          description?: string | null
          email?: string | null
          get_to_know_me?: string | null
          has_recent_review?: boolean | null
          headline?: string | null
          id?: string | null
          image_url?: string | null
          is_brand_builder?: boolean | null
          is_premier_agent?: boolean | null
          is_top_agent?: boolean | null
          languages?: Json | null
          license_expires_at?: string | null
          license_issued_at?: string | null
          license_number?: string | null
          license_status?: string | null
          license_type?: string | null
          most_recent_review_date?: string | null
          name?: string | null
          notable_achievements?: Json | null
          num_total_reviews?: number | null
          og_image_url?: string | null
          past_sales?: Json | null
          phone?: string | null
          platform_reviews?: Json | null
          press_mentions?: Json | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_link?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          publications?: Json | null
          rank?: number | null
          ratings?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          selection_rationale?: string | null
          service_areas?: Json | null
          sidebar_video_url?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          specialty?: string[] | null
          synthesized_bio?: string | null
          team_display_information?: Json | null
          title?: string | null
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
          years_experience?: number | null
          zillow_data_fetched_at?: string | null
          zillow_profile_url?: string | null
          zip_code?: string | null
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
    }
    Functions: {
      check_recent_reviews: { Args: { reviews_data: Json }; Returns: boolean }
      check_warm_cache_cron: { Args: never; Returns: Json }
      generate_canonical_slug: {
        Args: { full_name: string; phone: string }
        Returns: string
      }
      generate_short_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      start_warm_cache_cron: { Args: never; Returns: undefined }
      stop_warm_cache_cron: { Args: never; Returns: undefined }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      claim_status: "unclaimed" | "pending" | "approved" | "rejected"
      prospect_status:
        | "new"
        | "contacted"
        | "interested"
        | "customer"
        | "declined"
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
      app_role: ["admin", "editor", "viewer"],
      claim_status: ["unclaimed", "pending", "approved", "rejected"],
      prospect_status: [
        "new",
        "contacted",
        "interested",
        "customer",
        "declined",
      ],
    },
  },
} as const
