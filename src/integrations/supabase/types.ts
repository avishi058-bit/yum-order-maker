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
      blocked_customer_names: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          normalized: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          normalized: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          normalized?: string
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          expires_at: string | null
          id: string
          ip_address: string
          is_pattern: boolean
          reason: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          expires_at?: string | null
          id?: string
          ip_address: string
          is_pattern?: boolean
          reason: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          expires_at?: string | null
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
      business_private_settings: {
        Row: {
          business_signature: string | null
          id: number
          updated_at: string
        }
        Insert: {
          business_signature?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          business_signature?: string | null
          id?: number
          updated_at?: string
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
      event_leads: {
        Row: {
          created_at: string
          full_name: string
          group_type: string | null
          guests_count: number | null
          id: string
          notes: string | null
          phone: string
          preferred_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          full_name: string
          group_type?: string | null
          guests_count?: number | null
          id?: string
          notes?: string | null
          phone: string
          preferred_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          group_type?: string | null
          guests_count?: number | null
          id?: string
          notes?: string | null
          phone?: string
          preferred_date?: string | null
          status?: string
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
          archived: boolean
          available: boolean
          category: string
          id: string
          item_id: string
          item_name: string
          manually_disabled: boolean
          updated_at: string
        }
        Insert: {
          archived?: boolean
          available?: boolean
          category?: string
          id?: string
          item_id: string
          item_name: string
          manually_disabled?: boolean
          updated_at?: string
        }
        Update: {
          archived?: boolean
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
      order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_number: string | null
          note: string | null
          order_id: string
          reference: string | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_number?: string | null
          note?: string | null
          order_id: string
          reference?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_number?: string | null
          note?: string | null
          order_id?: string
          reference?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
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
          bon_queue_number: number | null
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_on_way_at: string | null
          customer_phone: string
          delivery_address: string | null
          delivery_fee: number | null
          delivery_request_id: string | null
          dine_in: boolean | null
          donation_only: boolean
          estimated_ready_at: string | null
          id: string
          invoice_issued_at: string | null
          invoice_number: string | null
          notes: string | null
          order_number: number
          order_source: string
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_request: boolean
          payment_session_id: string | null
          payment_transaction_id: string | null
          queue_number: number | null
          scheduled_for: string | null
          soldier_donation: number
          status: string
          ten_min_notified_at: string | null
          terms_accepted_at: string | null
          total: number
          updated_at: string
        }
        Insert: {
          almost_ready_notified_at?: string | null
          bon_queue_number?: number | null
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_on_way_at?: string | null
          customer_phone: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_request_id?: string | null
          dine_in?: boolean | null
          donation_only?: boolean
          estimated_ready_at?: string | null
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          notes?: string | null
          order_number?: number
          order_source?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_request?: boolean
          payment_session_id?: string | null
          payment_transaction_id?: string | null
          queue_number?: number | null
          scheduled_for?: string | null
          soldier_donation?: number
          status?: string
          ten_min_notified_at?: string | null
          terms_accepted_at?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          almost_ready_notified_at?: string | null
          bon_queue_number?: number | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_on_way_at?: string | null
          customer_phone?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_request_id?: string | null
          dine_in?: boolean | null
          donation_only?: boolean
          estimated_ready_at?: string | null
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          notes?: string | null
          order_number?: number
          order_source?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_request?: boolean
          payment_session_id?: string | null
          payment_transaction_id?: string | null
          queue_number?: number | null
          scheduled_for?: string | null
          soldier_donation?: number
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
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          description: string | null
          id: string
          notified_at: string | null
          order_id: string
          token: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_email?: string | null
          description?: string | null
          id?: string
          notified_at?: string | null
          order_id: string
          token: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          description?: string | null
          id?: string
          notified_at?: string | null
          order_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      produce_purchases: {
        Row: {
          created_at: string
          id: string
          item_key: string
          prev_finished: boolean
          purchased_at: string
          quantity: number | null
          raw_name: string | null
          supplier: string | null
          total: number
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          prev_finished?: boolean
          purchased_at?: string
          quantity?: number | null
          raw_name?: string | null
          supplier?: string | null
          total: number
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          prev_finished?: boolean
          purchased_at?: string
          quantity?: number | null
          raw_name?: string | null
          supplier?: string | null
          total?: number
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: []
      }
      product_aliases: {
        Row: {
          created_at: string
          id: string
          item_key: string
          label: string | null
          raw_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          label?: string | null
          raw_name: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          label?: string | null
          raw_name?: string
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
          receives_daily_summary: boolean
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
          receives_daily_summary?: boolean
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
          receives_daily_summary?: boolean
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
          kiosk_cash_enabled: boolean
          kiosk_credit_enabled: boolean
          kiosk_paybox_enabled: boolean
          last_opened_at: string | null
          patty_grams: number
          preorder_enabled: boolean
          preorder_end_time: string
          preorder_start_time: string
          soldier_fund_enabled: boolean
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
          kiosk_cash_enabled?: boolean
          kiosk_credit_enabled?: boolean
          kiosk_paybox_enabled?: boolean
          last_opened_at?: string | null
          patty_grams?: number
          preorder_enabled?: boolean
          preorder_end_time?: string
          preorder_start_time?: string
          soldier_fund_enabled?: boolean
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
          kiosk_cash_enabled?: boolean
          kiosk_credit_enabled?: boolean
          kiosk_paybox_enabled?: boolean
          last_opened_at?: string | null
          patty_grams?: number
          preorder_enabled?: boolean
          preorder_end_time?: string
          preorder_start_time?: string
          soldier_fund_enabled?: boolean
          station_open?: boolean
          updated_at?: string
          website_open?: boolean
        }
        Relationships: []
      }
      sauce_stock_events: {
        Row: {
          created_at: string
          event_date: string
          id: string
          kind: string
          quantity: number
          sauce: string
        }
        Insert: {
          created_at?: string
          event_date?: string
          id?: string
          kind: string
          quantity: number
          sauce: string
        }
        Update: {
          created_at?: string
          event_date?: string
          id?: string
          kind?: string
          quantity?: number
          sauce?: string
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
          fixed_expenses: Json
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
          monthly_fixed_costs: number
          monthly_wages: Json
          primary_color: string
          updated_at: string
          veg_cost_approved: number | null
          website_font_scale: number
          website_modal_height_vh: number
        }
        Insert: {
          background_color?: string
          banner_enabled?: boolean
          banner_text?: string | null
          business_hours?: Json
          created_at?: string
          fixed_expenses?: Json
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
          monthly_fixed_costs?: number
          monthly_wages?: Json
          primary_color?: string
          updated_at?: string
          veg_cost_approved?: number | null
          website_font_scale?: number
          website_modal_height_vh?: number
        }
        Update: {
          background_color?: string
          banner_enabled?: boolean
          banner_text?: string | null
          business_hours?: Json
          created_at?: string
          fixed_expenses?: Json
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
          monthly_fixed_costs?: number
          monthly_wages?: Json
          primary_color?: string
          updated_at?: string
          veg_cost_approved?: number | null
          website_font_scale?: number
          website_modal_height_vh?: number
        }
        Relationships: []
      }
      soldier_fund_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          order_id: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "soldier_fund_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_busy_events: {
        Row: {
          created_at: string
          dismissed_at: string | null
          help_asked_at: string | null
          id: string
          open_orders: number
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          help_asked_at?: string | null
          id?: string
          open_orders: number
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          help_asked_at?: string | null
          id?: string
          open_orders?: number
        }
        Relationships: []
      }
      staff_early_requests: {
        Row: {
          decided_at: string | null
          id: string
          requested_at: string
          shift_id: string | null
          staff_id: string
          status: string
        }
        Insert: {
          decided_at?: string | null
          id?: string
          requested_at?: string
          shift_id?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          decided_at?: string | null
          id?: string
          requested_at?: string
          shift_id?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_early_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "staff_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_early_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_entry_appeals: {
        Row: {
          claimed_in: string
          created_at: string
          decided_at: string | null
          entry_id: string
          id: string
          staff_id: string
          status: string
        }
        Insert: {
          claimed_in: string
          created_at?: string
          decided_at?: string | null
          entry_id: string
          id?: string
          staff_id: string
          status?: string
        }
        Update: {
          claimed_in?: string
          created_at?: string
          decided_at?: string | null
          entry_id?: string
          id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_entry_appeals_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "staff_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_entry_appeals_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_help_answers: {
        Row: {
          answered_at: string
          coming: boolean
          event_id: string
          staff_id: string
        }
        Insert: {
          answered_at?: string
          coming: boolean
          event_id: string
          staff_id: string
        }
        Update: {
          answered_at?: string
          coming?: boolean
          event_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_help_answers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "staff_busy_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_help_answers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_kitchen_signal: {
        Row: {
          id: number
          last_customer_at: string | null
          last_touch_at: string | null
          reminder_shown_at: string | null
          reminder_title: string | null
        }
        Insert: {
          id?: number
          last_customer_at?: string | null
          last_touch_at?: string | null
          reminder_shown_at?: string | null
          reminder_title?: string | null
        }
        Update: {
          id?: number
          last_customer_at?: string | null
          last_touch_at?: string | null
          reminder_shown_at?: string | null
          reminder_title?: string | null
        }
        Relationships: []
      }
      staff_meal_items: {
        Row: {
          active: boolean
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
          price: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      staff_meal_logs: {
        Row: {
          created_at: string
          id: string
          item_name: string
          price: number
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          price: number
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          price?: number
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_meal_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          display_name: string
          id: string
          is_owner: boolean
          sort_order: number
          token_hash: string | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_owner?: boolean
          sort_order?: number
          token_hash?: string | null
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_owner?: boolean
          sort_order?: number
          token_hash?: string | null
        }
        Relationships: []
      }
      staff_notification_log: {
        Row: {
          key: string
          kind: string
          sent_at: string
          staff_id: string
        }
        Insert: {
          key: string
          kind: string
          sent_at?: string
          staff_id: string
        }
        Update: {
          key?: string
          kind?: string
          sent_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notification_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          staff_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          staff_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_push_subscriptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedule_weeks: {
        Row: {
          notified_at: string | null
          published_at: string | null
          week_start: string
        }
        Insert: {
          notified_at?: string | null
          published_at?: string | null
          week_start: string
        }
        Update: {
          notified_at?: string | null
          published_at?: string | null
          week_start?: string
        }
        Relationships: []
      }
      staff_shift_assignments: {
        Row: {
          created_at: string
          shift_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          shift_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          shift_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "staff_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shift_requests: {
        Row: {
          created_at: string
          shift_date: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          shift_date: string
          staff_id: string
        }
        Update: {
          created_at?: string
          shift_date?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shift_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          shift_date: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          shift_date: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          shift_date?: string
          starts_at?: string
        }
        Relationships: []
      }
      staff_special_days: {
        Row: {
          closed: boolean
          day: string
          label: string | null
          opens_at: string | null
          shabbat_ends: string | null
        }
        Insert: {
          closed?: boolean
          day: string
          label?: string | null
          opens_at?: string | null
          shabbat_ends?: string | null
        }
        Update: {
          closed?: boolean
          day?: string
          label?: string | null
          opens_at?: string | null
          shabbat_ends?: string | null
        }
        Relationships: []
      }
      staff_stock_counts: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          staff_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          staff_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_stock_counts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "staff_stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_stock_counts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_stock_items: {
        Row: {
          active: boolean
          alert_below: number | null
          category: string
          id: string
          inventory_factor: number | null
          inventory_item_id: string | null
          low_only: boolean
          name: string
          order_below: number | null
          order_optional: boolean
          order_rule: string | null
          order_target: number | null
          pack_name: string | null
          pack_size: number | null
          shop_category: string | null
          sort_order: number
          step: number
          supplier: string | null
          unit: string
        }
        Insert: {
          active?: boolean
          alert_below?: number | null
          category: string
          id?: string
          inventory_factor?: number | null
          inventory_item_id?: string | null
          low_only?: boolean
          name: string
          order_below?: number | null
          order_optional?: boolean
          order_rule?: string | null
          order_target?: number | null
          pack_name?: string | null
          pack_size?: number | null
          shop_category?: string | null
          sort_order?: number
          step?: number
          supplier?: string | null
          unit?: string
        }
        Update: {
          active?: boolean
          alert_below?: number | null
          category?: string
          id?: string
          inventory_factor?: number | null
          inventory_item_id?: string | null
          low_only?: boolean
          name?: string
          order_below?: number | null
          order_optional?: boolean
          order_rule?: string | null
          order_target?: number | null
          pack_name?: string | null
          pack_size?: number | null
          shop_category?: string | null
          sort_order?: number
          step?: number
          supplier?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_stock_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_stock_items_supplier_fkey"
            columns: ["supplier"]
            isOneToOne: false
            referencedRelation: "staff_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_stock_purchases: {
        Row: {
          created_at: string
          id: string
          item_id: string
          price: number | null
          quantity: number
          report_id: string | null
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          price?: number | null
          quantity: number
          report_id?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          price?: number | null
          quantity?: number
          report_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_stock_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "staff_stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_stock_purchases_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "staff_stock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_stock_reports: {
        Row: {
          created_at: string
          id: string
          item_id: string
          level: string
          quantity: number | null
          resolved_at: string | null
          staff_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          level: string
          quantity?: number | null
          resolved_at?: string | null
          staff_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          level?: string
          quantity?: number | null
          resolved_at?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_stock_reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "staff_stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_stock_reports_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_suppliers: {
        Row: {
          count_required: boolean
          count_weekday: number | null
          count_when_needed: boolean
          delivery_weekday: number | null
          id: string
          name: string
          phone: string | null
          sort_order: number
        }
        Insert: {
          count_required?: boolean
          count_weekday?: number | null
          count_when_needed?: boolean
          delivery_weekday?: number | null
          id: string
          name: string
          phone?: string | null
          sort_order?: number
        }
        Update: {
          count_required?: boolean
          count_weekday?: number | null
          count_when_needed?: boolean
          delivery_weekday?: number | null
          id?: string
          name?: string
          phone?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      staff_task_runs: {
        Row: {
          action: string | null
          at_opening: boolean
          carried: boolean
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          kind: string
          section: string | null
          shift_date: string
          skipped_at: string | null
          sort_order: number | null
          source: string
          supplier: string | null
          task_id: string | null
          title: string
        }
        Insert: {
          action?: string | null
          at_opening?: boolean
          carried?: boolean
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          kind: string
          section?: string | null
          shift_date: string
          skipped_at?: string | null
          sort_order?: number | null
          source: string
          supplier?: string | null
          task_id?: string | null
          title: string
        }
        Update: {
          action?: string | null
          at_opening?: boolean
          carried?: boolean
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          kind?: string
          section?: string | null
          shift_date?: string
          skipped_at?: string | null
          sort_order?: number | null
          source?: string
          supplier?: string | null
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_task_runs_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_task_runs_supplier_fkey"
            columns: ["supplier"]
            isOneToOne: false
            referencedRelation: "staff_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_task_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "staff_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_tasks: {
        Row: {
          action: string | null
          active: boolean
          at_opening: boolean
          id: string
          idle_ok: boolean
          kind: string
          per_week: number | null
          rule: string | null
          section: string | null
          sort_order: number
          title: string
          weekday: number | null
        }
        Insert: {
          action?: string | null
          active?: boolean
          at_opening?: boolean
          id?: string
          idle_ok?: boolean
          kind: string
          per_week?: number | null
          rule?: string | null
          section?: string | null
          sort_order?: number
          title: string
          weekday?: number | null
        }
        Update: {
          action?: string | null
          active?: boolean
          at_opening?: boolean
          id?: string
          idle_ok?: boolean
          kind?: string
          per_week?: number | null
          rule?: string | null
          section?: string | null
          sort_order?: number
          title?: string
          weekday?: number | null
        }
        Relationships: []
      }
      staff_time_entries: {
        Row: {
          auto_closed: boolean
          clock_in: string
          clock_out: string | null
          id: string
          shift_id: string | null
          staff_id: string
        }
        Insert: {
          auto_closed?: boolean
          clock_in?: string
          clock_out?: string | null
          id?: string
          shift_id?: string | null
          staff_id: string
        }
        Update: {
          auto_closed?: boolean
          clock_in?: string
          clock_out?: string | null
          id?: string
          shift_id?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_entries_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "staff_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_waste_items: {
        Row: {
          active: boolean
          amount: number
          id: string
          inventory_item_id: string | null
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          amount?: number
          id?: string
          inventory_item_id?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          amount?: number
          id?: string
          inventory_item_id?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_waste_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_waste_logs: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          reason: string
          staff_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          quantity: number
          reason: string
          staff_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          reason?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_waste_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "staff_waste_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_waste_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_week_submissions: {
        Row: {
          staff_id: string
          submitted_at: string
          week_start: string
        }
        Insert: {
          staff_id: string
          submitted_at?: string
          week_start: string
        }
        Update: {
          staff_id?: string
          submitted_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_week_submissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          counted_at: string
          created_at: string
          id: string
          item_key: string
          kind: string
          note: string | null
          quantity: number
          unit: string | null
        }
        Insert: {
          counted_at?: string
          created_at?: string
          id?: string
          item_key: string
          kind?: string
          note?: string | null
          quantity?: number
          unit?: string | null
        }
        Update: {
          counted_at?: string
          created_at?: string
          id?: string
          item_key?: string
          kind?: string
          note?: string | null
          quantity?: number
          unit?: string | null
        }
        Relationships: []
      }
      supply_purchases: {
        Row: {
          amount: number
          created_at: string
          finished_at: string | null
          id: string
          includes_vat: boolean
          kind: string
          name: string
          notes: string | null
          purchased_at: string
          supplier: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          includes_vat?: boolean
          kind?: string
          name: string
          notes?: string | null
          purchased_at?: string
          supplier?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          includes_vat?: boolean
          kind?: string
          name?: string
          notes?: string | null
          purchased_at?: string
          supplier?: string | null
        }
        Relationships: []
      }
      test_customers: {
        Row: {
          created_at: string
          id: string
          kind: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          value?: string
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
      work_shifts: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_name: string
          id: string
          updated_at: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_name?: string
          id?: string
          updated_at?: string
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
      edit_order_apply: {
        Args: { p_items: Json; p_order_id: string; p_total: number }
        Returns: Json
      }
      generate_daily_order_number: { Args: never; Returns: number }
      get_public_event_settings: { Args: never; Returns: Json }
      get_webhook_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_admin: { Args: { _uid: string }; Returns: boolean }
      inventory_adjust: {
        Args: { p_delta: number; p_item: string }
        Returns: number
      }
      inventory_set_quantity: {
        Args: { p_item: string; p_qty: number }
        Returns: number
      }
      is_approved_courier: { Args: { _uid: string }; Returns: boolean }
      is_attack_mode_active: { Args: never; Returns: boolean }
      is_ip_blocked: { Args: { p_ip: string }; Returns: boolean }
      kitchen_busy_answer: {
        Args: { p_event_id: string; p_need_help: boolean }
        Returns: undefined
      }
      kitchen_busy_status: { Args: never; Returns: Json }
      kitchen_customers_active: { Args: never; Returns: undefined }
      kitchen_reminder_shown: { Args: { p_title: string }; Returns: undefined }
      kitchen_staff_today: { Args: never; Returns: Json }
      kitchen_staff_toggle: { Args: { p_staff_id: string }; Returns: Json }
      kitchen_stock_count: { Args: { p_counts: Json }; Returns: undefined }
      kitchen_task_count: {
        Args: { p_counts: Json; p_run_id: string }
        Returns: undefined
      }
      kitchen_task_set: {
        Args: { p_done: boolean; p_run_id: string }
        Returns: undefined
      }
      kitchen_task_skip: { Args: { p_run_id: string }; Returns: undefined }
      kitchen_tasks_today: { Args: never; Returns: Json }
      kitchen_touch: { Args: never; Returns: undefined }
      mark_order_paid: { Args: { p_order_id: string }; Returns: number }
      next_daily_queue_number: { Args: never; Returns: number }
      notify_orders_almost_ready: { Args: never; Returns: undefined }
      pay_order_from_soldier_fund: {
        Args: { p_order_id: string }
        Returns: number
      }
      payreq_get: { Args: { p_token: string }; Returns: Json }
      payreq_start: {
        Args: { p_email: string; p_name: string; p_token: string }
        Returns: Json
      }
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
      soldier_fund_balance: { Args: never; Returns: number }
      soldier_fund_public_stats: { Args: never; Returns: Json }
      staff_busy_check: { Args: never; Returns: undefined }
      staff_calendar_feed: { Args: { p_token: string }; Returns: Json }
      staff_caller_is_admin: { Args: never; Returns: boolean }
      staff_caller_is_kitchen: { Args: never; Returns: boolean }
      staff_clockout_reminders: { Args: never; Returns: undefined }
      staff_closing_nudge: { Args: never; Returns: undefined }
      staff_config: { Args: { p_key: string }; Returns: string }
      staff_current_shift: {
        Args: never
        Returns: {
          created_at: string
          ends_at: string
          id: string
          shift_date: string
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_day_brief: { Args: { p_date: string }; Returns: Json }
      staff_day_label: { Args: { p_day: string }; Returns: string }
      staff_day_sold: {
        Args: { p_date: string; p_pattern: string }
        Returns: number
      }
      staff_decide_appeal: {
        Args: { p_appeal_id: string; p_approve: boolean }
        Returns: undefined
      }
      staff_decide_early: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: undefined
      }
      staff_encouragements: { Args: never; Returns: undefined }
      staff_ensure_week: { Args: { p_week_start: string }; Returns: undefined }
      staff_ensure_week_impl: {
        Args: { p_week_start: string }
        Returns: undefined
      }
      staff_give_idle_task: { Args: never; Returns: undefined }
      staff_is_employee_day: { Args: { p_date: string }; Returns: boolean }
      staff_issue_link: { Args: { p_staff_id: string }; Returns: string }
      staff_meals_json: { Args: { p_staff_id: string }; Returns: Json }
      staff_member_by_token: {
        Args: { p_token: string }
        Returns: {
          active: boolean
          color: string | null
          created_at: string
          display_name: string
          id: string
          is_owner: boolean
          sort_order: number
          token_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_month_minutes: { Args: { p_staff_id: string }; Returns: number }
      staff_morning_brief: { Args: never; Returns: undefined }
      staff_notify_once: {
        Args: {
          p_body: string
          p_key: string
          p_kind: string
          p_staff: string[]
          p_title: string
          p_url?: string
        }
        Returns: undefined
      }
      staff_notify_tick: { Args: never; Returns: undefined }
      staff_owner_assign: {
        Args: {
          p_on: boolean
          p_shift_id: string
          p_staff_id: string
          p_token: string
        }
        Returns: undefined
      }
      staff_owner_brief: { Args: { p_token: string }; Returns: Json }
      staff_owner_by_token: {
        Args: { p_token: string }
        Returns: {
          active: boolean
          color: string | null
          created_at: string
          display_name: string
          id: string
          is_owner: boolean
          sort_order: number
          token_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_owner_order_reminders: { Args: never; Returns: undefined }
      staff_owner_payreq_create: {
        Args: { p_amount: number; p_description?: string; p_token: string }
        Returns: Json
      }
      staff_owner_payreqs: { Args: { p_token: string }; Returns: Json }
      staff_owner_publish: {
        Args: { p_token: string; p_week_start: string }
        Returns: undefined
      }
      staff_owner_task_move: {
        Args: { p_id: string; p_token: string; p_up: boolean }
        Returns: undefined
      }
      staff_owner_task_remove: {
        Args: { p_id: string; p_token: string }
        Returns: undefined
      }
      staff_owner_task_save: {
        Args: {
          p_id: string
          p_kind: string
          p_per_week?: number
          p_section?: string
          p_title: string
          p_token: string
          p_weekday?: number
        }
        Returns: string
      }
      staff_owner_tasks: { Args: { p_token: string }; Returns: Json }
      staff_owner_week: {
        Args: { p_token: string; p_week_start: string }
        Returns: Json
      }
      staff_patty_text: { Args: { p_date: string }; Returns: string }
      staff_portal_appeal: {
        Args: { p_entry_id: string; p_time: string; p_token: string }
        Returns: undefined
      }
      staff_portal_help: { Args: { p_token: string }; Returns: Json }
      staff_portal_help_answer: {
        Args: { p_coming: boolean; p_event_id: string; p_token: string }
        Returns: undefined
      }
      staff_portal_me: { Args: { p_token: string }; Returns: Json }
      staff_portal_meal_add: {
        Args: { p_item_id: string; p_token: string }
        Returns: string
      }
      staff_portal_meal_remove: {
        Args: { p_log_id: string; p_token: string }
        Returns: undefined
      }
      staff_portal_on_shift: {
        Args: {
          me: Database["public"]["Tables"]["staff_members"]["Row"]
          v_shift: Database["public"]["Tables"]["staff_shifts"]["Row"]
        }
        Returns: boolean
      }
      staff_portal_push: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_token: string
        }
        Returns: undefined
      }
      staff_portal_stock_set: {
        Args: {
          p_item_id: string
          p_level: string
          p_qty?: number
          p_token: string
        }
        Returns: undefined
      }
      staff_portal_submit: {
        Args: { p_dates: string[]; p_token: string; p_week_start: string }
        Returns: undefined
      }
      staff_portal_task_set: {
        Args: {
          p_counts?: Json
          p_done: boolean
          p_run_id: string
          p_token: string
        }
        Returns: undefined
      }
      staff_portal_tasks: { Args: { p_token: string }; Returns: Json }
      staff_portal_waste_add: {
        Args: {
          p_item_id: string
          p_qty: number
          p_reason: string
          p_token: string
          p_what?: string
        }
        Returns: undefined
      }
      staff_portal_waste_list: { Args: { p_token: string }; Returns: Json }
      staff_portal_waste_remove: {
        Args: { p_log_id: string; p_token: string }
        Returns: undefined
      }
      staff_push_expired: {
        Args: { p_endpoints: string[]; p_secret: string }
        Returns: undefined
      }
      staff_really_quiet: { Args: never; Returns: boolean }
      staff_record_count: {
        Args: { p_counts: Json; p_run_id: string; p_staff: string }
        Returns: undefined
      }
      staff_send_messages: { Args: { p_msgs: Json }; Returns: undefined }
      staff_set_day_closed: {
        Args: { p_closed: boolean; p_day: string }
        Returns: undefined
      }
      staff_shift_summaries: { Args: never; Returns: undefined }
      staff_stock_amount_text: {
        Args: {
          p_item: Database["public"]["Tables"]["staff_stock_items"]["Row"]
          p_qty: number
        }
        Returns: string
      }
      staff_stock_json: { Args: never; Returns: Json }
      staff_stock_purchase: {
        Args: {
          p_price?: number
          p_qty: number
          p_report_id: string
          p_source?: string
        }
        Returns: undefined
      }
      staff_stock_to_inventory: {
        Args: {
          p_item: Database["public"]["Tables"]["staff_stock_items"]["Row"]
          p_qty: number
        }
        Returns: undefined
      }
      staff_submission_reminders: { Args: never; Returns: undefined }
      staff_supplier_needs_count: {
        Args: { p_supplier: string }
        Returns: boolean
      }
      staff_supplier_reminders: { Args: never; Returns: undefined }
      staff_tasks_ensure: { Args: { p_date: string }; Returns: undefined }
      staff_tasks_json: { Args: { p_date: string }; Returns: Json }
      staff_thaw_text: {
        Args: { p_date: string; p_what: string }
        Returns: string
      }
      staff_untouched_alert: { Args: never; Returns: undefined }
      staff_weekday_name: { Args: { p_dow: number }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
