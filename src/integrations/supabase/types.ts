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
      customers: {
        Row: {
          created_at: string
          device_token: string | null
          id: string
          last_login_at: string | null
          login_count: number
          marketing_consent: boolean
          marketing_consent_at: string | null
          name: string
          phone: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_token?: string | null
          id?: string
          last_login_at?: string | null
          login_count?: number
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          name: string
          phone: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_token?: string | null
          id?: string
          last_login_at?: string | null
          login_count?: number
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          name?: string
          phone?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      menu_availability: {
        Row: {
          available: boolean
          category: string
          id: string
          item_id: string
          item_name: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          category?: string
          id?: string
          item_id: string
          item_name: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          category?: string
          id?: string
          item_id?: string
          item_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          deal_burgers: Json | null
          deal_drinks: Json | null
          id: string
          item_name: string
          meal_drink: string | null
          meal_side: string | null
          order_id: string
          price: number
          quantity: number
          removals: string[] | null
          toppings: string[] | null
          with_meal: boolean | null
        }
        Insert: {
          created_at?: string
          deal_burgers?: Json | null
          deal_drinks?: Json | null
          id?: string
          item_name: string
          meal_drink?: string | null
          meal_side?: string | null
          order_id: string
          price: number
          quantity?: number
          removals?: string[] | null
          toppings?: string[] | null
          with_meal?: boolean | null
        }
        Update: {
          created_at?: string
          deal_burgers?: Json | null
          deal_drinks?: Json | null
          id?: string
          item_name?: string
          meal_drink?: string | null
          meal_side?: string | null
          order_id?: string
          price?: number
          quantity?: number
          removals?: string[] | null
          toppings?: string[] | null
          with_meal?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          estimated_ready_at: string | null
          id: string
          notes: string | null
          order_number: number
          order_source: string
          payment_method: string | null
          status: string
          terms_accepted_at: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          estimated_ready_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          order_source?: string
          payment_method?: string | null
          status?: string
          terms_accepted_at?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          estimated_ready_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          order_source?: string
          payment_method?: string | null
          status?: string
          terms_accepted_at?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reopen_notifications: {
        Row: {
          created_at: string
          id: string
          name: string | null
          notified: boolean
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          notified?: boolean
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          notified?: boolean
          phone?: string
        }
        Relationships: []
      }
      restaurant_status: {
        Row: {
          cash_enabled: boolean
          credit_enabled: boolean
          id: string
          station_open: boolean
          updated_at: string
          website_open: boolean
        }
        Insert: {
          cash_enabled?: boolean
          credit_enabled?: boolean
          id?: string
          station_open?: boolean
          updated_at?: string
          website_open?: boolean
        }
        Update: {
          cash_enabled?: boolean
          credit_enabled?: boolean
          id?: string
          station_open?: boolean
          updated_at?: string
          website_open?: boolean
        }
        Relationships: []
      }
      saved_carts: {
        Row: {
          created_at: string
          customer_name: string | null
          dine_in: boolean | null
          guest_id: string | null
          id: string
          items: Json
          last_action: string
          phone: string | null
          resumed_count: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          dine_in?: boolean | null
          guest_id?: string | null
          id?: string
          items?: Json
          last_action?: string
          phone?: string | null
          resumed_count?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          dine_in?: boolean | null
          guest_id?: string | null
          id?: string
          items?: Json
          last_action?: string
          phone?: string | null
          resumed_count?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          background_color: string
          banner_enabled: boolean
          banner_text: string | null
          business_hours: Json
          created_at: string
          id: string
          kiosk_font_scale: number
          menu_item_overrides: Json
          menu_order: Json
          primary_color: string
          updated_at: string
          website_font_scale: number
        }
        Insert: {
          background_color?: string
          banner_enabled?: boolean
          banner_text?: string | null
          business_hours?: Json
          created_at?: string
          id?: string
          kiosk_font_scale?: number
          menu_item_overrides?: Json
          menu_order?: Json
          primary_color?: string
          updated_at?: string
          website_font_scale?: number
        }
        Update: {
          background_color?: string
          banner_enabled?: boolean
          banner_text?: string | null
          business_hours?: Json
          created_at?: string
          id?: string
          kiosk_font_scale?: number
          menu_item_overrides?: Json
          menu_order?: Json
          primary_color?: string
          updated_at?: string
          website_font_scale?: number
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
      verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_otp_rate_limit: { Args: { p_phone: string }; Returns: boolean }
      cleanup_expired_saved_carts: { Args: never; Returns: undefined }
      cleanup_old_verification_codes: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "kitchen"
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
      app_role: ["admin", "kitchen"],
    },
  },
} as const
