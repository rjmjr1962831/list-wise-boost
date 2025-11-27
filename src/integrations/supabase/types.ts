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
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_enrichment_queue_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
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
        ]
      }
      professionals: {
        Row: {
          active: boolean
          address: string | null
          agent_licenses: Json | null
          agent_sales_stats: Json | null
          badges: string[] | null
          business_address: Json | null
          business_name: string | null
          category_id: string
          city_id: string
          claim_notes: string | null
          claim_status: Database["public"]["Enums"]["claim_status"]
          claimed_at: string | null
          claimed_by: string | null
          company: string | null
          cpd_user_pronouns: string | null
          created_at: string
          current_listings: number | null
          description: string | null
          email: string | null
          email_verified_at: string | null
          encoded_zuid: string | null
          get_to_know_me: string | null
          id: string
          image_url: string | null
          in_canada: boolean | null
          is_premier_agent: boolean | null
          is_top_agent: boolean | null
          license_number: string | null
          license_verified_at: string | null
          name: string
          num_total_reviews: number | null
          og_image_url: string | null
          past_sales: Json | null
          phone: string | null
          phone_numbers: Json | null
          professional_data: Json | null
          professional_information: Json | null
          profile_image_id: string | null
          profile_type_ids: Json | null
          profile_types: Json | null
          rank: number
          ratings: Json | null
          raw_scraper_data: Json | null
          review_link: string | null
          review_stars_rating: number | null
          reviews_data: Json | null
          reviews_text: string | null
          screen_name: string | null
          sidebar_video_url: string | null
          specialty: string[] | null
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
          zip_code: string | null
          zuid: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          badges?: string[] | null
          business_address?: Json | null
          business_name?: string | null
          category_id: string
          city_id: string
          claim_notes?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_at?: string | null
          claimed_by?: string | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string
          current_listings?: number | null
          description?: string | null
          email?: string | null
          email_verified_at?: string | null
          encoded_zuid?: string | null
          get_to_know_me?: string | null
          id?: string
          image_url?: string | null
          in_canada?: boolean | null
          is_premier_agent?: boolean | null
          is_top_agent?: boolean | null
          license_number?: string | null
          license_verified_at?: string | null
          name: string
          num_total_reviews?: number | null
          og_image_url?: string | null
          past_sales?: Json | null
          phone?: string | null
          phone_numbers?: Json | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_image_id?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          rank: number
          ratings?: Json | null
          raw_scraper_data?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          screen_name?: string | null
          sidebar_video_url?: string | null
          specialty?: string[] | null
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
          zip_code?: string | null
          zuid?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          agent_licenses?: Json | null
          agent_sales_stats?: Json | null
          badges?: string[] | null
          business_address?: Json | null
          business_name?: string | null
          category_id?: string
          city_id?: string
          claim_notes?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_at?: string | null
          claimed_by?: string | null
          company?: string | null
          cpd_user_pronouns?: string | null
          created_at?: string
          current_listings?: number | null
          description?: string | null
          email?: string | null
          email_verified_at?: string | null
          encoded_zuid?: string | null
          get_to_know_me?: string | null
          id?: string
          image_url?: string | null
          in_canada?: boolean | null
          is_premier_agent?: boolean | null
          is_top_agent?: boolean | null
          license_number?: string | null
          license_verified_at?: string | null
          name?: string
          num_total_reviews?: number | null
          og_image_url?: string | null
          past_sales?: Json | null
          phone?: string | null
          phone_numbers?: Json | null
          professional_data?: Json | null
          professional_information?: Json | null
          profile_image_id?: string | null
          profile_type_ids?: Json | null
          profile_types?: Json | null
          rank?: number
          ratings?: Json | null
          raw_scraper_data?: Json | null
          review_link?: string | null
          review_stars_rating?: number | null
          reviews_data?: Json | null
          reviews_text?: string | null
          screen_name?: string | null
          sidebar_video_url?: string | null
          specialty?: string[] | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      claim_status: "unclaimed" | "pending" | "approved" | "rejected"
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
    },
  },
} as const
