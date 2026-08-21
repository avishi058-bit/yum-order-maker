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
      blocked_ips: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          id: string
          ip_address: string
          is_pattern: boolean
          reason: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          ip_address: string
          is_pattern?: boolean
          reason: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          ip_address?: string
          is_pattern?: boolean
          reason?: string
        }
        Relationships: []
      }
      blocked_phones: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          id: string
          phone: string
          reason: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          phone: string
          reason: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          phone?: string
          reason?: string
        }
        Relationships: []
      }
      consent_events: {
        Row: {
          action: string
          consent_text: string | null
          consent_text_version: string | null
          consent_type: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          ip_address: string | null
          item_ref: string | null
          method: string | null
          order_id: string | null
          phone: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          consent_text?: string | null
          consent_text_version?: string | null
          consent_type: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          ip_address?: string | null
          item_ref?: string | null
          method?: string | null
          order_id?: string | null
          phone?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          consent_text?: string | null
          consent_text_version?: string | null
          consent_type?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          ip_address?: string | null
          item_ref?: string | null
          method?: string | null
          order_id?: string | null
          phone?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_locations: {
        Row: {
          courier_id: string
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          courier_id: string
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          courier_id?: string
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: true
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_push_subscriptions: {
        Row: {
          auth: string
          courier_id: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          courier_id: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          courier_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_push_subscriptions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          name: string
          phone: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          name: string
          phone: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_toppings: {
        Row: {
          created_at: string
          id: string
          item_id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          name: string
          price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          device_token: string | null
          favorite_items: Json | null
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
          favorite_items?: Json | null
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
          favorite_items?: Json | null
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
      delivery_requests: {
        Row: {
          address: string
          claimed_at: string | null
          client_token: string
          courier_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          lat: number | null
          lng: number | null
          order_id: string | null
          payout: number | null
          price: number
          status: string
          updated_at: string
          zone_id: string | null
          zone_name: string | null
        }
        Insert: {
          address: string
          claimed_at?: string | null
          client_token?: string
          courier_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          order_id?: string | null
          payout?: number | null
          price?: number
          status?: string
          updated_at?: string
          zone_id?: string | null
          zone_name?: string | null
        }
        Update: {
          address?: string
          claimed_at?: string | null
          client_token?: string
          courier_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          order_id?: string | null
          payout?: number | null
          price?: number
          status?: string
          updated_at?: string
          zone_id?: string | null
          zone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          active: boolean
          created_at: string
          id: string
          keywords: string[]
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          keywords?: string[]
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          keywords?: string[]
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      event_bookings: {
        Row: {
          addons: Json
          at_venue: boolean
          business_id: string | null
          business_signature: string | null
          chili_count: number | null
          client_ip: string | null
          contract_text: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          customer_signature: string | null
          dessert_count: number | null
          drink_selections: Json
          eggs_count: number | null
          end_time: string
          event_address: string
          event_date: string
          event_type: string
          fried_onion_count: number | null
          gf_count: number
          guests_count: number
          id: string
          invoice_name: string | null
          kids_count: number
          kitchen_notes: string | null
          min_applied: boolean
          no_bun_count: number
          onion_jam_count: number | null
          package_id: string
          package_name: string
          package_price_per_person: number
          pdf_url: string | null
          seating_preference: string | null
          signed_at: string | null
          start_time: string
          status: string
          subtotal: number
          total_price: number
          updated_at: string
          veg_count: number
          vegan_count: number
        }
        Insert: {
          addons?: Json
          at_venue?: boolean
          business_id?: string | null
          business_signature?: string | null
          chili_count?: number | null
          client_ip?: string | null
          contract_text?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          customer_signature?: string | null
          dessert_count?: number | null
          drink_selections?: Json
          eggs_count?: number | null
          end_time: string
          event_address: string
          event_date: string
          event_type: string
          fried_onion_count?: number | null
          gf_count?: number
          guests_count: number
          id?: string
          invoice_name?: string | null
          kids_count?: number
          kitchen_notes?: string | null
          min_applied?: boolean
          no_bun_count?: number
          onion_jam_count?: number | null
          package_id: string
          package_name: string
          package_price_per_person: number
          pdf_url?: string | null
          seating_preference?: string | null
          signed_at?: string | null
          start_time: string
          status?: string
          subtotal: number
          total_price: number
          updated_at?: string
          veg_count?: number
          vegan_count?: number
        }
        Update: {
          addons?: Json
          at_venue?: boolean
          business_id?: string | null
          business_signature?: string | null
          chili_count?: number | null
          client_ip?: string | null
          contract_text?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          customer_signature?: string | null
          dessert_count?: number | null
          drink_selections?: Json
          eggs_count?: number | null
          end_time?: string
          event_address?: string
          event_date?: string
          event_type?: string
          fried_onion_count?: number | null
          gf_count?: number
          guests_count?: number
          id?: string
          invoice_name?: string | null
          kids_count?: number
          kitchen_notes?: string | null
          min_applied?: boolean
          no_bun_count?: number
          onion_jam_count?: number | null
          package_id?: string
          package_name?: string
          package_price_per_person?: number
          pdf_url?: string | null
          seating_preference?: string | null
          signed_at?: string | null
          start_time?: string
          status?: string
          subtotal?: number
          total_price?: number
          updated_at?: string
          veg_count?: number
          vegan_count?: number
        }
        Relationships: []
      }
      event_settings: {
        Row: {
          business_signature: string | null
          contract_template: string
          id: number
          kitchen_prep: Json
          minimum_amount: number
          updated_at: string
        }
        Insert: {
          business_signature?: string | null
          contract_template?: string
          id?: number
          kitchen_prep?: Json
          minimum_amount?: number
          updated_at?: string
        }
        Update: {
          business_signature?: string | null
          contract_template?: string
          id?: number
          kitchen_prep?: Json
          minimum_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      internal_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      inventory_access_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          scope: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          scope?: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          scope?: string
          token?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          fridge_qty: number
          fridge_target: number
          id: string
          low_threshold: number
          menu_item_id: string | null
          name: string
          notes: string | null
          presets: Json
          quantity: number
          sort_order: number
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          fridge_qty?: number
          fridge_target?: number
          id?: string
          low_threshold?: number
          menu_item_id?: string | null
          name: string
          notes?: string | null
          presets?: Json
          quantity?: number
          sort_order?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          fridge_qty?: number
          fridge_target?: number
          id?: string
          low_threshold?: number
          menu_item_id?: string | null
          name?: string
          notes?: string | null
          presets?: Json
          quantity?: number
          sort_order?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          inventory_item_id: string
          note: string | null
          order_id: string | null
          reason: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          inventory_item_id: string
          note?: string | null
          order_id?: string | null
          reason: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          inventory_item_id?: string
          note?: string | null
          order_id?: string | null
          reason?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_recipes: {
        Row: {
          amount_per_unit: number
          created_at: string
          id: string
          inventory_item_id: string
          menu_item_id: string
          updated_at: string
        }
        Insert: {
          amount_per_unit?: number
          created_at?: string
          id?: string
          inventory_item_id: string
          menu_item_id: string
          updated_at?: string
        }
        Update: {
          amount_per_unit?: number
          created_at?: string
          id?: string
          inventory_item_id?: string
          menu_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_recipes_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_availability: {
        Row: {
          available: boolean
          category: string
          id: string
          item_id: string
          item_name: string
          manually_disabled: boolean
          updated_at: string
        }
        Insert: {
          available?: boolean
          category?: string
          id?: string
          item_id: string
          item_name: string
          manually_disabled?: boolean
          updated_at?: string
        }
        Update: {
          available?: boolean
          category?: string
          id?: string
          item_id?: string
          item_name?: string
          manually_disabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notification_prompts: {
        Row: {
          action: string
          created_at: string
          device_fingerprint: string | null
          id: string
          order_id: string | null
          phone: string | null
        }
        Insert: {
          action: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          order_id?: string | null
          phone?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          order_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_prompts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          deal_burgers: Json | null
          deal_drinks: Json | null
          id: string
          item_id: string | null
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
          item_id?: string | null
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
          item_id?: string | null
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
          almost_ready_notified_at: string | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_fee: number | null
          delivery_request_id: string | null
          dine_in: boolean | null
          estimated_ready_at: string | null
          id: string
          notes: string | null
          order_number: number
          order_source: string
          paid_at: string | null
          payment_method: string | null
          queue_number: number | null
          scheduled_for: string | null
          status: string
          ten_min_notified_at: string | null
          terms_accepted_at: string | null
          total: number
          updated_at: string
        }
        Insert: {
          almost_ready_notified_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_request_id?: string | null
          dine_in?: boolean | null
          estimated_ready_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          order_source?: string
          paid_at?: string | null
          payment_method?: string | null
          queue_number?: number | null
          scheduled_for?: string | null
          status?: string
          ten_min_notified_at?: string | null
          terms_accepted_at?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          almost_ready_notified_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_request_id?: string | null
          dine_in?: boolean | null
          estimated_ready_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          order_source?: string
          paid_at?: string | null
          payment_method?: string | null
          queue_number?: number | null
          scheduled_for?: string | null
          status?: string
          ten_min_notified_at?: string | null
          terms_accepted_at?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_request_id_fkey"
            columns: ["delivery_request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          customer_phone: string | null
          endpoint: string
          for_reopen: boolean
          id: string
          is_kitchen: boolean
          order_id: string | null
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          customer_phone?: string | null
          endpoint: string
          for_reopen?: boolean
          id?: string
          is_kitchen?: boolean
          order_id?: string | null
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          customer_phone?: string | null
          endpoint?: string
          for_reopen?: boolean
          id?: string
          is_kitchen?: boolean
          order_id?: string | null
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_attempts: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          key: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          key: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          key?: string
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
          delivery_enabled: boolean
          high_load: boolean
          id: string
          preorder_enabled: boolean
          preorder_end_time: string
          preorder_start_time: string
          station_open: boolean
          updated_at: string
          website_open: boolean
        }
        Insert: {
          cash_enabled?: boolean
          credit_enabled?: boolean
          delivery_enabled?: boolean
          high_load?: boolean
          id?: string
          preorder_enabled?: boolean
          preorder_end_time?: string
          preorder_start_time?: string
          station_open?: boolean
          updated_at?: string
          website_open?: boolean
        }
        Update: {
          cash_enabled?: boolean
          credit_enabled?: boolean
          delivery_enabled?: boolean
          high_load?: boolean
          id?: string
          preorder_enabled?: boolean
          preorder_end_time?: string
          preorder_start_time?: string
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
          google_review_url: string | null
          id: string
          kiosk_card_image_size_px: number
          kiosk_disable_zoom: boolean
          kiosk_font_scale: number
          kiosk_image_height_px: number
          kiosk_image_scale: number
          kiosk_lock_layout: boolean
          kiosk_modal_height_vh: number
          kiosk_spacing_scale: number
          kiosk_ui_scale: number
          menu_item_overrides: Json
          menu_order: Json
          primary_color: string
          updated_at: string
          website_font_scale: number
          website_modal_height_vh: number
        }
        Insert: {
          background_color?: string
          banner_enabled?: boolean
          banner_text?: string | null
          business_hours?: Json
          created_at?: string
          google_review_url?: string | null
          id?: string
          kiosk_card_image_size_px?: number
          kiosk_disable_zoom?: boolean
          kiosk_font_scale?: number
          kiosk_image_height_px?: number
          kiosk_image_scale?: number
          kiosk_lock_layout?: boolean
          kiosk_modal_height_vh?: number
          kiosk_spacing_scale?: number
          kiosk_ui_scale?: number
          menu_item_overrides?: Json
          menu_order?: Json
          primary_color?: string
          updated_at?: string
          website_font_scale?: number
          website_modal_height_vh?: number
        }
        Update: {
          background_color?: string
          banner_enabled?: boolean
          banner_text?: string | null
          business_hours?: Json
          created_at?: string
          google_review_url?: string | null
          id?: string
          kiosk_card_image_size_px?: number
          kiosk_disable_zoom?: boolean
          kiosk_font_scale?: number
          kiosk_image_height_px?: number
          kiosk_image_scale?: number
          kiosk_lock_layout?: boolean
          kiosk_modal_height_vh?: number
          kiosk_spacing_scale?: number
          kiosk_ui_scale?: number
          menu_item_overrides?: Json
          menu_order?: Json
          primary_color?: string
          updated_at?: string
          website_font_scale?: number
          website_modal_height_vh?: number
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
      check_and_activate_attack_mode: { Args: never; Returns: boolean }
      check_otp_rate_limit: { Args: { p_phone: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_action: string
          p_key: string
          p_max_attempts: number
          p_window: string
        }
        Returns: boolean
      }
      cleanup_expired_saved_carts: { Args: never; Returns: undefined }
      cleanup_old_rate_limit_attempts: { Args: never; Returns: undefined }
      cleanup_old_verification_codes: { Args: never; Returns: undefined }
      current_courier_id: { Args: never; Returns: string }
      generate_daily_order_number: { Args: never; Returns: number }
      get_webhook_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_admin: { Args: { _uid: string }; Returns: boolean }
      is_approved_courier: { Args: { _uid: string }; Returns: boolean }
      is_attack_mode_active: { Args: never; Returns: boolean }
      is_ip_blocked: { Args: { p_ip: string }; Returns: boolean }
      mark_order_paid: { Args: { p_order_id: string }; Returns: number }
      notify_orders_almost_ready: { Args: never; Returns: undefined }
      pull_fridge_for_menu_id: {
        Args: { p_menu_id: string; p_order_id: string; p_qty: number }
        Returns: undefined
      }
      record_rate_limit_attempt: {
        Args: { p_action: string; p_ip_address?: string; p_key: string }
        Returns: undefined
      }
      reping_kitchen_for_pending_orders: { Args: never; Returns: undefined }
      resolve_fridge_menu_ids: { Args: { p_value: string }; Returns: string[] }
      restore_fridge_for_menu_id: {
        Args: { p_menu_id: string; p_order_id: string; p_qty: number }
        Returns: undefined
      }
      restore_fridge_for_order_item: {
        Args: { p_order_id: string; p_row: Json }
        Returns: undefined
      }
      unmark_order_paid: { Args: { p_order_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "kitchen" | "courier"
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
      app_role: ["admin", "kitchen", "courier"],
    },
  },
} as const
