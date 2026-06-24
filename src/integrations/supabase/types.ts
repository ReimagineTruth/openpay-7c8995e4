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
      admin_self_send_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          reason: string
          reviewed_by_email: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          reason?: string
          reviewed_by_email: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          reason?: string
          reviewed_by_email?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_self_send_reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_socials: {
        Row: {
          created_at: string
          handle: string
          id: string
          platform: string
          url: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          platform: string
          url?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          platform?: string
          url?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      affiliate_task_submissions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          proof_url: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reward_amount: number
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          proof_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_amount?: number
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          proof_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_amount?: number
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "affiliate_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_tasks: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          proof_required: boolean
          recurrence: string
          reward_amount: number
          task_type: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          id?: string
          proof_required?: boolean
          recurrence?: string
          reward_amount?: number
          task_type: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          proof_required?: boolean
          recurrence?: string
          reward_amount?: number
          task_type?: string
          title?: string
        }
        Relationships: []
      }
      api_access_logs: {
        Row: {
          app_id: string
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          response_time_ms: number | null
          status_code: number
          user_id: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          method?: string
          response_time_ms?: number | null
          status_code?: number
          user_id?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          response_time_ms?: number | null
          status_code?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_access_logs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_analytics: {
        Row: {
          active_subscriptions: number
          app_id: string
          canceled_subscriptions: number
          created_at: string
          date: string
          id: string
          new_subscriptions: number
          refund_count: number
          refunds: number
          total_revenue: number
          total_transactions: number
          unique_payers: number
          updated_at: string
        }
        Insert: {
          active_subscriptions?: number
          app_id: string
          canceled_subscriptions?: number
          created_at?: string
          date: string
          id?: string
          new_subscriptions?: number
          refund_count?: number
          refunds?: number
          total_revenue?: number
          total_transactions?: number
          unique_payers?: number
          updated_at?: string
        }
        Update: {
          active_subscriptions?: number
          app_id?: string
          canceled_subscriptions?: number
          created_at?: string
          date?: string
          id?: string
          new_subscriptions?: number
          refund_count?: number
          refunds?: number
          total_revenue?: number
          total_transactions?: number
          unique_payers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_analytics_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "app_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      app_payment_links: {
        Row: {
          app_id: string
          created_at: string
          custom_data: Json | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          link_description: string | null
          link_name: string
          link_token: string
          max_usage: number | null
          plan_id: string | null
          redirect_url: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          app_id: string
          created_at?: string
          custom_data?: Json | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          link_description?: string | null
          link_name: string
          link_token?: string
          max_usage?: number | null
          plan_id?: string | null
          redirect_url?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          app_id?: string
          created_at?: string
          custom_data?: Json | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          link_description?: string | null
          link_name?: string
          link_token?: string
          max_usage?: number | null
          plan_id?: string | null
          redirect_url?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_payment_links_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "app_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_payment_links_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "app_payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      app_payment_plans: {
        Row: {
          amount: number
          app_id: string
          created_at: string
          currency: string
          id: string
          is_active: boolean | null
          plan_description: string | null
          plan_name: string
          plan_type: string
          setup_fee: number | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          app_id: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          plan_description?: string | null
          plan_name: string
          plan_type: string
          setup_fee?: number | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          app_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          plan_description?: string | null
          plan_name?: string
          plan_type?: string
          setup_fee?: number | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_payment_plans_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "app_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      app_payment_scan_requests: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          error_message: string | null
          expires_at: string
          id: string
          link_token: string
          payer_user_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          link_token: string
          payer_user_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          link_token?: string
          payer_user_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_payment_transactions: {
        Row: {
          amount: number
          app_id: string
          created_at: string
          currency: string
          external_transaction_id: string | null
          fee_amount: number
          id: string
          metadata: Json | null
          net_amount: number
          payer_user_id: string
          payment_method: string
          plan_id: string | null
          status: string
          subscription_id: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          app_id: string
          created_at?: string
          currency?: string
          external_transaction_id?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json | null
          net_amount: number
          payer_user_id: string
          payment_method?: string
          plan_id?: string | null
          status?: string
          subscription_id?: string | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          app_id?: string
          created_at?: string
          currency?: string
          external_transaction_id?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json | null
          net_amount?: number
          payer_user_id?: string
          payment_method?: string
          plan_id?: string | null
          status?: string
          subscription_id?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_payment_transactions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "app_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_payment_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "app_payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "app_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_registry: {
        Row: {
          app_description: string | null
          app_logo_url: string | null
          app_name: string
          app_public_key: string
          app_secret_key: string
          app_url: string | null
          created_at: string
          developer_user_id: string
          id: string
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          app_description?: string | null
          app_logo_url?: string | null
          app_name: string
          app_public_key?: string
          app_secret_key?: string
          app_url?: string | null
          created_at?: string
          developer_user_id: string
          id?: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          app_description?: string | null
          app_logo_url?: string | null
          app_name?: string
          app_public_key?: string
          app_secret_key?: string
          app_url?: string | null
          created_at?: string
          developer_user_id?: string
          id?: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      app_subscriptions: {
        Row: {
          app_id: string
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: string
          subscriber_user_id: string
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          app_id: string
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          plan_id: string
          status?: string
          subscriber_user_id: string
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          app_id?: string
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: string
          subscriber_user_id?: string
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_subscriptions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "app_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "app_payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string
          category: string
          content: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string
          id: string
          likes: number
          published: boolean
          published_at: string
          slug: string
          tags: string[]
          title: string
          updated_at: string
          video_url: string | null
          views: number
          youtube_id: string | null
        }
        Insert: {
          author_name?: string
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string
          id?: string
          likes?: number
          published?: boolean
          published_at?: string
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
          video_url?: string | null
          views?: number
          youtube_id?: string | null
        }
        Update: {
          author_name?: string
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string
          id?: string
          likes?: number
          published?: boolean
          published_at?: string
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
          video_url?: string | null
          views?: number
          youtube_id?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      developer_apps: {
        Row: {
          app_description: string
          app_name: string
          app_url: string
          client_id: string
          client_secret_hash: string
          client_secret_last4: string
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          rate_limit_per_minute: number
          redirect_uris: string[]
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          app_description?: string
          app_name: string
          app_url?: string
          client_id?: string
          client_secret_hash?: string
          client_secret_last4?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          rate_limit_per_minute?: number
          redirect_uris?: string[]
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          app_description?: string
          app_name?: string
          app_url?: string
          client_id?: string
          client_secret_hash?: string
          client_secret_last4?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          rate_limit_per_minute?: number
          redirect_uris?: string[]
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      developer_webhooks: {
        Row: {
          app_id: string
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          secret_hash: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          app_id: string
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          secret_hash?: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          app_id?: string
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          secret_hash?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_webhooks_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_response: string | null
          created_at: string
          description: string
          id: string
          reason: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          description?: string
          id?: string
          reason?: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          description?: string
          id?: string
          reason?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_notifications_outbox: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_outbox_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      help_articles: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          demo_label: string | null
          demo_path: string | null
          faqs: Json
          icon_name: string
          id: string
          overview: string
          published: boolean
          short: string
          slug: string
          sort_order: number
          steps: string[]
          title: string
          updated_at: string
          youtube_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          demo_label?: string | null
          demo_path?: string | null
          faqs?: Json
          icon_name?: string
          id?: string
          overview?: string
          published?: boolean
          short?: string
          slug: string
          sort_order?: number
          steps?: string[]
          title: string
          updated_at?: string
          youtube_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          demo_label?: string | null
          demo_path?: string | null
          faqs?: Json
          icon_name?: string
          id?: string
          overview?: string
          published?: boolean
          short?: string
          slug?: string
          sort_order?: number
          steps?: string[]
          title?: string
          updated_at?: string
          youtube_id?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          recipient_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          recipient_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      kyc_applications: {
        Row: {
          admin_notes: string | null
          annual_income_range: string
          date_of_birth: string
          email: string
          employer_name: string | null
          face_verification_metadata: Json
          full_name: string
          id: string
          id_document_back_url: string | null
          id_document_expiry_date: string
          id_document_front_url: string | null
          id_document_issue_date: string
          id_document_number: string
          id_document_type: string
          liveness_passed: boolean
          liveness_score: number | null
          nationality: string
          occupation: string
          phone_number: string
          political_exposure: boolean
          proof_of_address_url: string | null
          rejection_reason: string | null
          residential_address: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_captured_at: string | null
          selfie_url: string | null
          source_of_funds: string
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          annual_income_range: string
          date_of_birth: string
          email: string
          employer_name?: string | null
          face_verification_metadata?: Json
          full_name: string
          id?: string
          id_document_back_url?: string | null
          id_document_expiry_date: string
          id_document_front_url?: string | null
          id_document_issue_date: string
          id_document_number: string
          id_document_type: string
          liveness_passed?: boolean
          liveness_score?: number | null
          nationality: string
          occupation: string
          phone_number: string
          political_exposure?: boolean
          proof_of_address_url?: string | null
          rejection_reason?: string | null
          residential_address: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_captured_at?: string | null
          selfie_url?: string | null
          source_of_funds: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          annual_income_range?: string
          date_of_birth?: string
          email?: string
          employer_name?: string | null
          face_verification_metadata?: Json
          full_name?: string
          id?: string
          id_document_back_url?: string | null
          id_document_expiry_date?: string
          id_document_front_url?: string | null
          id_document_issue_date?: string
          id_document_number?: string
          id_document_type?: string
          liveness_passed?: boolean
          liveness_score?: number | null
          nationality?: string
          occupation?: string
          phone_number?: string
          political_exposure?: boolean
          proof_of_address_url?: string | null
          rejection_reason?: string | null
          residential_address?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_captured_at?: string | null
          selfie_url?: string | null
          source_of_funds?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_events: {
        Row: {
          actor_user_id: string | null
          amount: number | null
          event_type: string
          id: string
          note: string | null
          occurred_at: string
          payload: Json
          recorded_at: string
          related_user_id: string | null
          source_id: string
          source_table: string
          status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          amount?: number | null
          event_type: string
          id?: string
          note?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          related_user_id?: string | null
          source_id: string
          source_table: string
          status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          amount?: number | null
          event_type?: string
          id?: string
          note?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          related_user_id?: string | null
          source_id?: string
          source_table?: string
          status?: string | null
        }
        Relationships: []
      }
      merchant_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_mode: string
          key_name: string
          last_used_at: string | null
          merchant_user_id: string
          publishable_key: string
          revoked_at: string | null
          secret_key_hash: string
          secret_key_last4: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_mode: string
          key_name?: string
          last_used_at?: string | null
          merchant_user_id: string
          publishable_key: string
          revoked_at?: string | null
          secret_key_hash: string
          secret_key_last4: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_mode?: string
          key_name?: string
          last_used_at?: string | null
          merchant_user_id?: string
          publishable_key?: string
          revoked_at?: string | null
          secret_key_hash?: string
          secret_key_last4?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchant_balance_transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          destination: string
          id: string
          key_mode: string
          merchant_user_id: string
          note: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          destination: string
          id?: string
          key_mode: string
          merchant_user_id: string
          note?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          destination?: string
          id?: string
          key_mode?: string
          merchant_user_id?: string
          note?: string
        }
        Relationships: []
      }
      merchant_checkout_session_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total: number
          product_id: string | null
          quantity: number
          session_id: string
          unit_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total: number
          product_id?: string | null
          quantity: number
          session_id: string
          unit_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          session_id?: string
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_checkout_session_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_checkout_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "merchant_checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_checkout_sessions: {
        Row: {
          api_key_id: string | null
          cancel_url: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          expires_at: string
          fee_amount: number
          id: string
          key_mode: string
          merchant_user_id: string
          metadata: Json
          paid_at: string | null
          session_token: string
          status: string
          subtotal_amount: number
          success_url: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          api_key_id?: string | null
          cancel_url?: string | null
          created_at?: string
          currency: string
          customer_email?: string | null
          customer_name?: string | null
          expires_at: string
          fee_amount?: number
          id?: string
          key_mode: string
          merchant_user_id: string
          metadata?: Json
          paid_at?: string | null
          session_token: string
          status?: string
          subtotal_amount?: number
          success_url?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          api_key_id?: string | null
          cancel_url?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          expires_at?: string
          fee_amount?: number
          id?: string
          key_mode?: string
          merchant_user_id?: string
          metadata?: Json
          paid_at?: string | null
          session_token?: string
          status?: string
          subtotal_amount?: number
          success_url?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_checkout_sessions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payment_link_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total: number
          link_id: string
          product_id: string | null
          quantity: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total: number
          link_id: string
          product_id?: string | null
          quantity: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total?: number
          link_id?: string
          product_id?: string | null
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_link_items_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "merchant_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payment_link_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payment_link_share_settings: {
        Row: {
          button_label: string
          button_size: string
          button_style: string
          created_at: string
          direct_open_new_tab: boolean
          iframe_height: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled: boolean
          qr_logo_url: string
          qr_size: number
          updated_at: string
          widget_theme: string
        }
        Insert: {
          button_label?: string
          button_size?: string
          button_style?: string
          created_at?: string
          direct_open_new_tab?: boolean
          iframe_height?: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled?: boolean
          qr_logo_url?: string
          qr_size?: number
          updated_at?: string
          widget_theme?: string
        }
        Update: {
          button_label?: string
          button_size?: string
          button_style?: string
          created_at?: string
          direct_open_new_tab?: boolean
          iframe_height?: number
          link_id?: string
          merchant_user_id?: string
          qr_logo_enabled?: boolean
          qr_logo_url?: string
          qr_size?: number
          updated_at?: string
          widget_theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_link_share_settings_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: true
            referencedRelation: "merchant_payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payment_links: {
        Row: {
          after_payment_type: string
          api_key_id: string | null
          call_to_action: string
          collect_address: boolean
          collect_customer_email: boolean
          collect_customer_name: boolean
          collect_phone: boolean
          confirmation_message: string
          created_at: string
          currency: string
          custom_amount: number | null
          description: string
          expires_at: string | null
          fee_amount: number | null
          fee_payer: string | null
          id: string
          is_active: boolean
          key_mode: string
          link_token: string
          link_type: string
          merchant_settlement_amount: number | null
          merchant_user_id: string
          openpay_fee_account: string | null
          redirect_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          after_payment_type?: string
          api_key_id?: string | null
          call_to_action?: string
          collect_address?: boolean
          collect_customer_email?: boolean
          collect_customer_name?: boolean
          collect_phone?: boolean
          confirmation_message?: string
          created_at?: string
          currency?: string
          custom_amount?: number | null
          description?: string
          expires_at?: string | null
          fee_amount?: number | null
          fee_payer?: string | null
          id?: string
          is_active?: boolean
          key_mode: string
          link_token: string
          link_type: string
          merchant_settlement_amount?: number | null
          merchant_user_id: string
          openpay_fee_account?: string | null
          redirect_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          after_payment_type?: string
          api_key_id?: string | null
          call_to_action?: string
          collect_address?: boolean
          collect_customer_email?: boolean
          collect_customer_name?: boolean
          collect_phone?: boolean
          confirmation_message?: string
          created_at?: string
          currency?: string
          custom_amount?: number | null
          description?: string
          expires_at?: string | null
          fee_amount?: number | null
          fee_payer?: string | null
          id?: string
          is_active?: boolean
          key_mode?: string
          link_token?: string
          link_type?: string
          merchant_settlement_amount?: number | null
          merchant_user_id?: string
          openpay_fee_account?: string | null
          redirect_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_links_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payments: {
        Row: {
          amount: number
          api_key_id: string | null
          buyer_user_id: string
          created_at: string
          currency: string
          id: string
          key_mode: string
          merchant_user_id: string
          payment_link_id: string | null
          payment_link_token: string | null
          session_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          amount: number
          api_key_id?: string | null
          buyer_user_id: string
          created_at?: string
          currency: string
          id?: string
          key_mode: string
          merchant_user_id: string
          payment_link_id?: string | null
          payment_link_token?: string | null
          session_id: string
          status?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          api_key_id?: string | null
          buyer_user_id?: string
          created_at?: string
          currency?: string
          id?: string
          key_mode?: string
          merchant_user_id?: string
          payment_link_id?: string | null
          payment_link_token?: string | null
          session_id?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payments_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payments_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "merchant_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "merchant_checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_pos_api_settings: {
        Row: {
          live_api_key_id: string | null
          merchant_user_id: string
          sandbox_api_key_id: string | null
          updated_at: string
        }
        Insert: {
          live_api_key_id?: string | null
          merchant_user_id: string
          sandbox_api_key_id?: string | null
          updated_at?: string
        }
        Update: {
          live_api_key_id?: string | null
          merchant_user_id?: string
          sandbox_api_key_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_pos_api_settings_live_api_key_id_fkey"
            columns: ["live_api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_pos_api_settings_sandbox_api_key_id_fkey"
            columns: ["sandbox_api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_products: {
        Row: {
          checkout_info: string
          created_at: string
          currency: string
          id: string
          image_url: string | null
          is_active: boolean
          media_urls: string[]
          merchant_user_id: string
          metadata: Json
          pricing_type: string
          product_code: string
          product_description: string
          product_name: string
          product_tags: string[]
          published_at: string | null
          repeat_every: number | null
          repeat_unit: string | null
          tax_code: string | null
          unit_amount: number
          updated_at: string
        }
        Insert: {
          checkout_info?: string
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_urls?: string[]
          merchant_user_id: string
          metadata?: Json
          pricing_type?: string
          product_code: string
          product_description?: string
          product_name: string
          product_tags?: string[]
          published_at?: string | null
          repeat_every?: number | null
          repeat_unit?: string | null
          tax_code?: string | null
          unit_amount: number
          updated_at?: string
        }
        Update: {
          checkout_info?: string
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_urls?: string[]
          merchant_user_id?: string
          metadata?: Json
          pricing_type?: string
          product_code?: string
          product_description?: string
          product_name?: string
          product_tags?: string[]
          published_at?: string | null
          repeat_every?: number | null
          repeat_unit?: string | null
          tax_code?: string | null
          unit_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      merchant_profiles: {
        Row: {
          created_at: string
          default_currency: string
          is_active: boolean
          merchant_logo_url: string | null
          merchant_name: string
          merchant_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          is_active?: boolean
          merchant_logo_url?: string | null
          merchant_name?: string
          merchant_username?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          is_active?: boolean
          merchant_logo_url?: string | null
          merchant_name?: string
          merchant_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mining_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          referral_id: string | null
          reward_type: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          referral_id?: string | null
          reward_type: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          referral_id?: string | null
          reward_type?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_rewards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mining_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_sessions: {
        Row: {
          ad_verified: boolean | null
          created_at: string
          device_fingerprint: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_reward_at: string
          pi_browser_used: boolean | null
          started_at: string
          user_id: string
        }
        Insert: {
          ad_verified?: boolean | null
          created_at?: string
          device_fingerprint?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_reward_at?: string
          pi_browser_used?: boolean | null
          started_at?: string
          user_id: string
        }
        Update: {
          ad_verified?: boolean | null
          created_at?: string
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_reward_at?: string
          pi_browser_used?: boolean | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nft_auction_bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at: string
          id: string
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at?: string
          id?: string
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "nft_auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_auctions: {
        Row: {
          created_at: string
          currency: string
          current_bid: number | null
          current_bidder: string | null
          ends_at: string
          id: string
          item_id: string
          min_increment: number
          quantity: number
          seller_id: string
          start_price: number
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          current_bid?: number | null
          current_bidder?: string | null
          ends_at: string
          id?: string
          item_id: string
          min_increment?: number
          quantity?: number
          seller_id: string
          start_price: number
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          current_bid?: number | null
          current_bidder?: string | null
          ends_at?: string
          id?: string
          item_id?: string
          min_increment?: number
          quantity?: number
          seller_id?: string
          start_price?: number
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nft_auctions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_collections: {
        Row: {
          code: string
          cover_url: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          name: string
          royalty_pct: number
          updated_at: string
        }
        Insert: {
          code: string
          cover_url?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          name: string
          royalty_pct?: number
          updated_at?: string
        }
        Update: {
          code?: string
          cover_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          name?: string
          royalty_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      nft_earnings: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          item_id: string | null
          source: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          source: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          source?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_earnings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nft_earnings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "nft_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_gifts: {
        Row: {
          created_at: string
          id: string
          item_id: string
          message: string | null
          quantity: number
          recipient_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          message?: string | null
          quantity: number
          recipient_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          message?: string | null
          quantity?: number
          recipient_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_gifts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_items: {
        Row: {
          code: string
          collection_id: string | null
          created_at: string
          creator_id: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          media_type: string
          media_url: string | null
          name: string
          price: number
          properties: Json
          quantity_minted: number
          quantity_total: number
          updated_at: string
        }
        Insert: {
          code: string
          collection_id?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_type?: string
          media_url?: string | null
          name: string
          price?: number
          properties?: Json
          quantity_minted?: number
          quantity_total: number
          updated_at?: string
        }
        Update: {
          code?: string
          collection_id?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_type?: string
          media_url?: string | null
          name?: string
          price?: number
          properties?: Json
          quantity_minted?: number
          quantity_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "nft_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_listings: {
        Row: {
          created_at: string
          currency: string
          id: string
          item_id: string
          price: number
          quantity: number
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          item_id: string
          price: number
          quantity: number
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          item_id?: string
          price?: number
          quantity?: number
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_listings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_ownership: {
        Row: {
          acquired_at: string
          id: string
          item_id: string
          owner_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          item_id: string
          owner_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          acquired_at?: string
          id?: string
          item_id?: string
          owner_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_ownership_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_transactions: {
        Row: {
          buyer_id: string | null
          created_at: string
          currency: string
          id: string
          item_id: string
          listing_id: string | null
          metadata: Json | null
          payment_method: string
          price_each: number
          quantity: number
          royalty_amount: number
          seller_id: string | null
          status: string
          total: number
          tx_kind: string
          tx_ref: string | null
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          item_id: string
          listing_id?: string | null
          metadata?: Json | null
          payment_method?: string
          price_each: number
          quantity: number
          royalty_amount?: number
          seller_id?: string | null
          status?: string
          total: number
          tx_kind?: string
          tx_ref?: string | null
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          item_id?: string
          listing_id?: string | null
          metadata?: Json | null
          payment_method?: string
          price_each?: number
          quantity?: number
          royalty_amount?: number
          seller_id?: string | null
          status?: string
          total?: number
          tx_kind?: string
          tx_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nft_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nft_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "nft_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_authorizations: {
        Row: {
          access_token_hash: string
          app_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_token_hash: string | null
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_hash?: string
          app_id: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token_hash?: string | null
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_hash?: string
          app_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token_hash?: string | null
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorizations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      open_partner_leads: {
        Row: {
          admin_note: string | null
          business_type: string | null
          company_name: string
          contact_email: string
          contact_name: string
          country: string | null
          created_at: string
          estimated_monthly_volume: string | null
          id: string
          integration_type: string | null
          message: string | null
          requester_user_id: string
          status: string
          updated_at: string
          use_case_summary: string
          website_url: string | null
        }
        Insert: {
          admin_note?: string | null
          business_type?: string | null
          company_name: string
          contact_email: string
          contact_name: string
          country?: string | null
          created_at?: string
          estimated_monthly_volume?: string | null
          id?: string
          integration_type?: string | null
          message?: string | null
          requester_user_id: string
          status?: string
          updated_at?: string
          use_case_summary?: string
          website_url?: string | null
        }
        Update: {
          admin_note?: string | null
          business_type?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          estimated_monthly_volume?: string | null
          id?: string
          integration_type?: string | null
          message?: string | null
          requester_user_id?: string
          status?: string
          updated_at?: string
          use_case_summary?: string
          website_url?: string | null
        }
        Relationships: []
      }
      openpay_authorization_codes: {
        Row: {
          authorization_code: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          authorization_code: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          authorization_code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      openpay_runtime_settings: {
        Row: {
          setting_key: string
          updated_at: string
          value_json: Json
        }
        Insert: {
          setting_key: string
          updated_at?: string
          value_json?: Json
        }
        Update: {
          setting_key?: string
          updated_at?: string
          value_json?: Json
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payer_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payer_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payer_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pi_payment_credits: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          status: string
          txid: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          status?: string
          txid?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          status?: string
          txid?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          kyc_status: string
          kyc_verified_at: string | null
          referral_code: string
          referred_by_user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          kyc_status?: string
          kyc_verified_at?: string | null
          referral_code: string
          referred_by_user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          kyc_status?: string
          kyc_verified_at?: string | null
          referral_code?: string
          referred_by_user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      push_notifications_outbox: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          last_error: string | null
          notification_id: string | null
          payload: Json
          sent_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          last_error?: string | null
          notification_id?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          last_error?: string | null
          notification_id?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "app_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device: Json | null
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device?: Json | null
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device?: Json | null
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      qr_pay_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          last4: string
          name: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          last4: string
          name: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          last4?: string
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qr_pay_api_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          latency_ms: number | null
          meta: Json | null
          method: string
          qr_pay_token: string | null
          status_code: number
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          meta?: Json | null
          method: string
          qr_pay_token?: string | null
          status_code?: number
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          meta?: Json | null
          method?: string
          qr_pay_token?: string | null
          status_code?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_pay_api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "qr_pay_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_payment_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          line_total: number
          name: string
          position: number
          qr_payment_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          line_total: number
          name: string
          position?: number
          qr_payment_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          line_total?: number
          name?: string
          position?: number
          qr_payment_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_payment_items_qr_payment_id_fkey"
            columns: ["qr_payment_id"]
            isOneToOne: false
            referencedRelation: "qr_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          delivery_address: string | null
          delivery_notes: string | null
          id: string
          merchant_user_id: string
          method: string
          paid_at: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payer_user_id: string | null
          payer_username: string | null
          pi_payment_id: string | null
          pi_txid: string | null
          provider_payload: Json
          qr_payment_id: string
          status: string
          transaction_ref: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          delivery_address?: string | null
          delivery_notes?: string | null
          id?: string
          merchant_user_id: string
          method: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payer_user_id?: string | null
          payer_username?: string | null
          pi_payment_id?: string | null
          pi_txid?: string | null
          provider_payload?: Json
          qr_payment_id: string
          status?: string
          transaction_ref: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          delivery_address?: string | null
          delivery_notes?: string | null
          id?: string
          merchant_user_id?: string
          method?: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payer_user_id?: string | null
          payer_username?: string | null
          pi_payment_id?: string | null
          pi_txid?: string | null
          provider_payload?: Json
          qr_payment_id?: string
          status?: string
          transaction_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_payment_transactions_qr_payment_id_fkey"
            columns: ["qr_payment_id"]
            isOneToOne: false
            referencedRelation: "qr_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_payments: {
        Row: {
          after_payment_action: string
          allow_custom_amount: boolean
          allow_guest: boolean
          allow_pi: boolean
          allow_virtual_card: boolean
          allow_wallet: boolean
          collect_delivery: boolean
          cover_image_url: string | null
          created_at: string
          currency: string
          delivery_fields: Json
          description: string | null
          download_url: string | null
          expires_at: string | null
          id: string
          merchant_user_id: string
          metadata: Json
          min_amount: number | null
          payment_type: string
          redirect_url: string | null
          reusable: boolean
          status: string
          subtotal: number
          suggested_amount: number | null
          title: string
          token: string
          total: number
          updated_at: string
        }
        Insert: {
          after_payment_action?: string
          allow_custom_amount?: boolean
          allow_guest?: boolean
          allow_pi?: boolean
          allow_virtual_card?: boolean
          allow_wallet?: boolean
          collect_delivery?: boolean
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          delivery_fields?: Json
          description?: string | null
          download_url?: string | null
          expires_at?: string | null
          id?: string
          merchant_user_id: string
          metadata?: Json
          min_amount?: number | null
          payment_type?: string
          redirect_url?: string | null
          reusable?: boolean
          status?: string
          subtotal?: number
          suggested_amount?: number | null
          title?: string
          token: string
          total?: number
          updated_at?: string
        }
        Update: {
          after_payment_action?: string
          allow_custom_amount?: boolean
          allow_guest?: boolean
          allow_pi?: boolean
          allow_virtual_card?: boolean
          allow_wallet?: boolean
          collect_delivery?: boolean
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          delivery_fields?: Json
          description?: string | null
          download_url?: string | null
          expires_at?: string | null
          id?: string
          merchant_user_id?: string
          metadata?: Json
          min_amount?: number | null
          payment_type?: string
          redirect_url?: string | null
          reusable?: boolean
          status?: string
          subtotal?: number
          suggested_amount?: number | null
          title?: string
          token?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount: number
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount?: number
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_amount?: number
          status?: string
        }
        Relationships: []
      }
      remittance_merchants: {
        Row: {
          banner_subtitle: string
          banner_title: string
          business_note: string
          created_at: string
          deposit_fee_percent: number
          fee_notes: string
          fee_title: string
          flat_service_fee: number
          is_active: boolean
          merchant_city: string
          merchant_country: string
          merchant_logo_url: string
          merchant_name: string
          merchant_username: string
          min_operating_balance: number
          payout_fee_percent: number
          qr_accent: string
          qr_background: string
          qr_tagline: string
          updated_at: string
          user_id: string
        }
        Insert: {
          banner_subtitle?: string
          banner_title?: string
          business_note?: string
          created_at?: string
          deposit_fee_percent?: number
          fee_notes?: string
          fee_title?: string
          flat_service_fee?: number
          is_active?: boolean
          merchant_city?: string
          merchant_country?: string
          merchant_logo_url?: string
          merchant_name?: string
          merchant_username?: string
          min_operating_balance?: number
          payout_fee_percent?: number
          qr_accent?: string
          qr_background?: string
          qr_tagline?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          banner_subtitle?: string
          banner_title?: string
          business_note?: string
          created_at?: string
          deposit_fee_percent?: number
          fee_notes?: string
          fee_title?: string
          flat_service_fee?: number
          is_active?: boolean
          merchant_city?: string
          merchant_country?: string
          merchant_logo_url?: string
          merchant_name?: string
          merchant_username?: string
          min_operating_balance?: number
          payout_fee_percent?: number
          qr_accent?: string
          qr_background?: string
          qr_tagline?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staking_positions: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          ends_at: string
          id: string
          lock_days: number
          reward_amount: number
          reward_rate: number
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          lock_days: number
          reward_amount: number
          reward_rate: number
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          lock_days?: number
          reward_amount?: number
          reward_rate?: number
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_topups: {
        Row: {
          amount_usd: number
          created_at: string
          credited_at: string | null
          environment: string
          id: string
          status: string
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          credited_at?: string | null
          environment?: string
          id?: string
          status?: string
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          credited_at?: string | null
          environment?: string
          id?: string
          status?: string
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_agents: {
        Row: {
          created_at: string
          handle: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handle?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_faq_categories: {
        Row: {
          created_at: string
          description: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      support_faq_items: {
        Row: {
          answer: string
          category_id: string | null
          created_at: string
          id: string
          question: string
          tags: string[]
        }
        Insert: {
          answer: string
          category_id?: string | null
          created_at?: string
          id?: string
          question: string
          tags?: string[]
        }
        Update: {
          answer?: string
          category_id?: string | null
          created_at?: string
          id?: string
          question?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "support_faq_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "support_faq_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          sender_id: string
          sender_role?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      supported_currencies: {
        Row: {
          created_at: string
          display_code: string
          display_name: string
          flag: string
          is_active: boolean
          iso_code: string
          symbol: string
          updated_at: string
          usd_rate: number
        }
        Insert: {
          created_at?: string
          display_code: string
          display_name: string
          flag: string
          is_active?: boolean
          iso_code: string
          symbol: string
          updated_at?: string
          usd_rate: number
        }
        Update: {
          created_at?: string
          display_code?: string
          display_name?: string
          flag?: string
          is_active?: boolean
          iso_code?: string
          symbol?: string
          updated_at?: string
          usd_rate?: number
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_username: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string
          account_number: string
          account_username?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_username?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_loan_applications: {
        Row: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          agreement_accepted_at: string | null
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line?: string
          admin_note?: string
          agreement_accepted?: boolean
          agreement_accepted_at?: string | null
          city?: string
          contact_number?: string
          country?: string
          created_at?: string
          credit_score_snapshot?: number
          full_name?: string
          id?: string
          openpay_account_number?: string
          openpay_account_username?: string
          requested_amount: number
          requested_term_months: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          admin_note?: string
          agreement_accepted?: boolean
          agreement_accepted_at?: string | null
          city?: string
          contact_number?: string
          country?: string
          created_at?: string
          credit_score_snapshot?: number
          full_name?: string
          id?: string
          openpay_account_number?: string
          openpay_account_username?: string
          requested_amount?: number
          requested_term_months?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_loan_payments: {
        Row: {
          amount: number
          created_at: string
          fee_component: number
          id: string
          loan_id: string
          note: string
          payment_method: string
          payment_reference: string | null
          principal_component: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_component: number
          id?: string
          loan_id: string
          note?: string
          payment_method?: string
          payment_reference?: string | null
          principal_component: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_component?: number
          id?: string
          loan_id?: string
          note?: string
          payment_method?: string
          payment_reference?: string | null
          principal_component?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "user_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_loans: {
        Row: {
          created_at: string
          credit_score: number
          id: string
          monthly_fee_rate: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months: number
          principal_amount: number
          status: string
          term_months: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_score?: number
          id?: string
          monthly_fee_rate?: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months?: number
          principal_amount: number
          status?: string
          term_months: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_score?: number
          id?: string
          monthly_fee_rate?: number
          monthly_payment_amount?: number
          next_due_date?: string
          outstanding_amount?: number
          paid_months?: number
          principal_amount?: number
          status?: string
          term_months?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          hide_balance: boolean
          merchant_onboarding_data: Json
          onboarding_completed: boolean
          onboarding_step: number
          profile_full_name: string | null
          profile_username: string | null
          qr_print_settings: Json
          reference_code: string | null
          security_settings: Json
          updated_at: string
          usage_agreement_accepted: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          hide_balance?: boolean
          merchant_onboarding_data?: Json
          onboarding_completed?: boolean
          onboarding_step?: number
          profile_full_name?: string | null
          profile_username?: string | null
          qr_print_settings?: Json
          reference_code?: string | null
          security_settings?: Json
          updated_at?: string
          usage_agreement_accepted?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          hide_balance?: boolean
          merchant_onboarding_data?: Json
          onboarding_completed?: boolean
          onboarding_step?: number
          profile_full_name?: string | null
          profile_username?: string | null
          qr_print_settings?: Json
          reference_code?: string | null
          security_settings?: Json
          updated_at?: string
          usage_agreement_accepted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_savings_accounts: {
        Row: {
          apy: number
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apy?: number
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apy?: number
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_savings_transfers: {
        Row: {
          amount: number
          created_at: string
          direction: string
          fee_amount: number
          id: string
          note: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          direction: string
          fee_amount?: number
          id?: string
          note?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          fee_amount?: number
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      user_swap_withdrawals: {
        Row: {
          admin_note: string
          amount: number
          created_at: string
          fee_amount: number
          fee_rate: number
          id: string
          mrwn_wallet_address: string
          openpay_account_name: string
          openpay_account_number: string
          openpay_account_username: string
          ousd_sol_wallet_address: string
          ousd_wallet_address: string
          payout_amount: number
          pi_wallet_address: string
          refund_transaction_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_transaction_id: string | null
          updated_at: string
          user_id: string
          withdrawal_type: string
        }
        Insert: {
          admin_note?: string
          amount: number
          created_at?: string
          fee_amount?: number
          fee_rate?: number
          id?: string
          mrwn_wallet_address?: string
          openpay_account_name?: string
          openpay_account_number?: string
          openpay_account_username?: string
          ousd_sol_wallet_address?: string
          ousd_wallet_address?: string
          payout_amount?: number
          pi_wallet_address?: string
          refund_transaction_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_transaction_id?: string | null
          updated_at?: string
          user_id: string
          withdrawal_type?: string
        }
        Update: {
          admin_note?: string
          amount?: number
          created_at?: string
          fee_amount?: number
          fee_rate?: number
          id?: string
          mrwn_wallet_address?: string
          openpay_account_name?: string
          openpay_account_number?: string
          openpay_account_username?: string
          ousd_sol_wallet_address?: string
          ousd_wallet_address?: string
          payout_amount?: number
          pi_wallet_address?: string
          refund_transaction_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_transaction_id?: string | null
          updated_at?: string
          user_id?: string
          withdrawal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_swap_withdrawals_refund_transaction_id_fkey"
            columns: ["refund_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_swap_withdrawals_transfer_transaction_id_fkey"
            columns: ["transfer_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_topup_requests: {
        Row: {
          admin_note: string
          amount: number
          created_at: string
          id: string
          openpay_account_name: string
          openpay_account_number: string
          openpay_account_username: string
          proof_url: string
          provider: string
          reference_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string
          amount: number
          created_at?: string
          id?: string
          openpay_account_name?: string
          openpay_account_number?: string
          openpay_account_username?: string
          proof_url?: string
          provider?: string
          reference_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string
          amount?: number
          created_at?: string
          id?: string
          openpay_account_name?: string
          openpay_account_number?: string
          openpay_account_username?: string
          proof_url?: string
          provider?: string
          reference_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topup_requests_transfer_transaction_id_fkey"
            columns: ["transfer_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_cards: {
        Row: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_number: string
          card_settings?: Json
          card_username?: string
          cardholder_name?: string
          created_at?: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details?: boolean
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_number?: string
          card_settings?: Json
          card_username?: string
          cardholder_name?: string
          created_at?: string
          cvc?: string
          expiry_month?: number
          expiry_year?: number
          hide_details?: boolean
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          id: string
          updated_at: string
          user_id: string
          welcome_bonus_claimed_at: string | null
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
          user_id: string
          welcome_bonus_claimed_at?: string | null
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
          user_id?: string
          welcome_bonus_claimed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      merchant_product_stats: {
        Row: {
          merchant_user_id: string | null
          product_id: string | null
          total_purchases: number | null
          total_revenue: number | null
          total_sales: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_checkout_session_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _qr_pay_finish: { Args: { p_payment_id: string }; Returns: undefined }
      admin_dashboard_history:
        | { Args: never; Returns: Json }
        | { Args: { p_limit: number; p_offset: number }; Returns: Json }
      admin_list_loan_applications: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          applicant_display_name: string
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string
          status: string
          user_id: string
        }[]
      }
      admin_list_swap_withdrawals: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          admin_note: string
          amount: number
          applicant_display_name: string
          created_at: string
          id: string
          openpay_account_name: string
          openpay_account_number: string
          openpay_account_username: string
          pi_wallet_address: string
          reviewed_at: string
          status: string
          user_id: string
        }[]
      }
      admin_list_topup_requests: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          admin_note: string
          amount: number
          applicant_display_name: string
          created_at: string
          id: string
          openpay_account_name: string
          openpay_account_number: string
          openpay_account_username: string
          proof_url: string
          provider: string
          reference_code: string
          reviewed_at: string
          status: string
          user_id: string
        }[]
      }
      admin_openpay_metrics: { Args: never; Returns: Json }
      admin_refund_self_send: {
        Args: {
          p_admin_email?: string
          p_decision: string
          p_reason?: string
          p_transaction_id: string
        }
        Returns: Json
      }
      admin_review_loan_application: {
        Args: {
          p_admin_note?: string
          p_application_id: string
          p_decision: string
        }
        Returns: string
      }
      admin_review_swap_withdrawal: {
        Args: {
          p_admin_note?: string
          p_decision: string
          p_withdrawal_id: string
        }
        Returns: string
      }
      admin_review_topup_request: {
        Args: {
          p_admin_note?: string
          p_decision: string
          p_request_id: string
        }
        Returns: string
      }
      apply_usd_exchange_rates: { Args: { p_rates: Json }; Returns: number }
      approve_app_payment_scan: {
        Args: { p_payment_method?: string; p_scan_id: string }
        Returns: {
          message: string
          status: string
          transaction_id: string
        }[]
      }
      calculate_user_activity_credit_score: {
        Args: { p_user_id: string }
        Returns: number
      }
      can_user_unlock_loans: {
        Args: { p_user_id: string }
        Returns: {
          required_activity: number
          required_score: number
          score: number
          total_activity: number
          unlocked: boolean
        }[]
      }
      claim_mining_rewards: { Args: never; Returns: Json }
      claim_referral_rewards: { Args: never; Returns: Json }
      claim_stake: { Args: { p_position_id: string }; Returns: Json }
      claim_welcome_bonus: { Args: never; Returns: Json }
      complete_account_onboarding: {
        Args: {
          p_full_name: string
          p_profile_image_url?: string
          p_security_pin?: string
          p_username: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      complete_merchant_checkout_with_transaction:
        | {
            Args: {
              p_note?: string
              p_session_token: string
              p_transaction_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_customer_address?: string
              p_customer_email?: string
              p_customer_name?: string
              p_customer_phone?: string
              p_note?: string
              p_session_token: string
              p_transaction_id: string
            }
            Returns: string
          }
      create_app: {
        Args: {
          p_app_description: string
          p_app_logo_url: string
          p_app_name: string
          p_app_url: string
          p_webhook_url: string
        }
        Returns: {
          app_id: string
          app_public_key: string
          app_secret_key: string
        }[]
      }
      create_app_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_app_payment_plan: {
        Args: {
          p_amount: number
          p_app_id: string
          p_currency?: string
          p_plan_description: string
          p_plan_name: string
          p_plan_type: string
          p_setup_fee?: number
          p_trial_days?: number
        }
        Returns: string
      }
      create_app_payment_scan: {
        Args: {
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_link_token: string
        }
        Returns: string
      }
      create_checkout_session_from_payment_link: {
        Args: {
          p_customer_email?: string
          p_customer_name?: string
          p_link_token: string
        }
        Returns: {
          after_payment_type: string
          call_to_action: string
          confirmation_message: string
          currency: string
          expires_at: string
          redirect_url: string
          session_id: string
          session_token: string
          total_amount: number
        }[]
      }
      create_merchant_checkout_session: {
        Args: {
          p_cancel_url?: string
          p_currency: string
          p_customer_email?: string
          p_customer_name?: string
          p_expires_in_minutes?: number
          p_items: Json
          p_metadata?: Json
          p_mode: string
          p_secret_key: string
          p_success_url?: string
        }
        Returns: {
          currency: string
          expires_at: string
          session_id: string
          session_token: string
          total_amount: number
        }[]
      }
      create_merchant_payment_link: {
        Args: {
          p_after_payment_type?: string
          p_call_to_action?: string
          p_collect_address?: boolean
          p_collect_customer_email?: boolean
          p_collect_customer_name?: boolean
          p_collect_phone?: boolean
          p_confirmation_message?: string
          p_currency?: string
          p_custom_amount?: number
          p_description?: string
          p_expires_in_minutes?: number
          p_fee_amount?: number
          p_fee_payer?: string
          p_items?: Json
          p_link_type: string
          p_merchant_settlement_amount?: number
          p_mode: string
          p_openpay_fee_account?: string
          p_redirect_url?: string
          p_secret_key: string
          p_title?: string
        }
        Returns: {
          currency: string
          expires_at: string
          key_mode: string
          link_id: string
          link_token: string
          total_amount: number
        }[]
      }
      create_my_merchant_api_key: {
        Args: { p_key_name?: string; p_mode: string }
        Returns: {
          id: string
          key_mode: string
          key_name: string
          publishable_key: string
          secret_key: string
        }[]
      }
      create_my_pos_checkout_session: {
        Args: {
          p_amount: number
          p_currency?: string
          p_customer_email?: string
          p_customer_name?: string
          p_expires_in_minutes?: number
          p_mode?: string
          p_qr_style?: string
          p_reference?: string
          p_secret_key?: string
        }
        Returns: {
          currency: string
          expires_at: string
          qr_payload: string
          session_id: string
          session_token: string
          status: string
          total_amount: number
        }[]
      }
      create_stake: {
        Args: { p_amount: number; p_lock_days: number }
        Returns: Json
      }
      credit_stripe_topup: {
        Args: {
          p_amount: number
          p_environment: string
          p_session_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_my_merchant_api_key: {
        Args: { p_key_id: string }
        Returns: boolean
      }
      delete_my_merchant_checkout_link: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      delete_my_merchant_payment_link: {
        Args: { p_link_id: string }
        Returns: boolean
      }
      digest: { Args: { algorithm: string; data: string }; Returns: string }
      dispatch_outbox_to_pgmq: { Args: { p_limit?: number }; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_user_by_account_number: {
        Args: { p_account_number: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          username: string
        }[]
      }
      gen_random_bytes: { Args: { length: number }; Returns: string }
      generate_merchant_api_key: { Args: { p_prefix: string }; Returns: string }
      generate_openpay_account_number: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_openpay_authorization_code: { Args: never; Returns: string }
      generate_openpay_card_number: { Args: never; Returns: string }
      generate_openpay_cvc: { Args: never; Returns: string }
      get_app_payment_scan: {
        Args: { p_scan_id: string }
        Returns: {
          error_message: string
          expires_at: string
          id: string
          link_token: string
          status: string
          transaction_id: string
        }[]
      }
      get_my_credit_score: { Args: never; Returns: number }
      get_my_latest_loan: {
        Args: never
        Returns: {
          created_at: string
          credit_score: number
          id: string
          monthly_fee_rate: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months: number
          principal_amount: number
          status: string
          term_months: number
        }[]
      }
      get_my_latest_loan_application: {
        Args: never
        Returns: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          agreement_accepted_at: string | null
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_loan_payment_history: {
        Args: { p_limit?: number; p_loan_id?: string }
        Returns: {
          amount: number
          created_at: string
          fee_component: number
          id: string
          loan_id: string
          note: string
          payment_method: string
          payment_reference: string
          principal_component: number
        }[]
      }
      get_my_merchant_activity: {
        Args: { p_limit?: number; p_mode?: string; p_offset?: number }
        Returns: {
          activity_id: string
          activity_type: string
          amount: number
          counterparty_email: string
          counterparty_name: string
          counterparty_username: string
          created_at: string
          currency: string
          note: string
          source: string
          status: string
        }[]
      }
      get_my_merchant_analytics: {
        Args: { p_days?: number; p_mode?: string }
        Returns: Json
      }
      get_my_merchant_balance_overview: {
        Args: { p_mode?: string }
        Returns: {
          available_balance: number
          gross_volume: number
          refunded_total: number
          savings_balance: number
          transferred_total: number
          wallet_balance: number
        }[]
      }
      get_my_openpay_code: { Args: never; Returns: string }
      get_my_payment_link_share_settings: {
        Args: { p_link_id: string }
        Returns: {
          button_label: string
          button_size: string
          button_style: string
          created_at: string
          direct_open_new_tab: boolean
          iframe_height: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled: boolean
          qr_logo_url: string
          qr_size: number
          updated_at: string
          widget_theme: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_payment_link_share_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_pos_api_key_settings: {
        Args: never
        Returns: {
          live_api_key_id: string
          live_key_name: string
          live_publishable_key: string
          sandbox_api_key_id: string
          sandbox_key_name: string
          sandbox_publishable_key: string
        }[]
      }
      get_my_pos_dashboard: {
        Args: { p_mode?: string }
        Returns: {
          key_mode: string
          merchant_name: string
          merchant_username: string
          refunded_transactions: number
          today_total_received: number
          today_transactions: number
          wallet_balance: number
        }[]
      }
      get_my_pos_transactions: {
        Args: {
          p_limit?: number
          p_mode?: string
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          amount: number
          currency: string
          customer_email: string
          customer_name: string
          payer_name: string
          payer_user_id: string
          payer_username: string
          payment_created_at: string
          payment_id: string
          payment_status: string
          session_token: string
          transaction_id: string
          transaction_note: string
        }[]
      }
      get_my_savings_dashboard: {
        Args: never
        Returns: {
          apy: number
          savings_balance: number
          wallet_balance: number
        }[]
      }
      get_openpay_settlement_user_id: { Args: never; Returns: string }
      get_public_ledger: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          amount: number
          currency_code: string
          event_type: string
          note: string
          occurred_at: string
          payload: Json
          receiver_amount: number
          receiver_avatar: string
          receiver_currency_code: string
          receiver_name: string
          receiver_username: string
          sender_amount: number
          sender_avatar: string
          sender_currency_code: string
          sender_name: string
          sender_username: string
          status: string
        }[]
      }
      get_public_ledger_transaction: {
        Args: { p_transaction_id: string }
        Returns: {
          amount: number
          event_type: string
          note: string
          occurred_at: string
          status: string
        }[]
      }
      get_public_merchant_checkout_session: {
        Args: { p_session_token: string }
        Returns: {
          amount: number
          currency: string
          expires_at: string
          items: Json
          merchant_logo_url: string
          merchant_name: string
          merchant_user_id: string
          merchant_username: string
          mode: string
          session_id: string
          status: string
        }[]
      }
      get_public_merchant_payment_link: {
        Args: { p_link_token: string }
        Returns: {
          after_payment_type: string
          call_to_action: string
          collect_address: boolean
          collect_customer_email: boolean
          collect_customer_name: boolean
          collect_phone: boolean
          confirmation_message: string
          currency: string
          description: string
          expires_at: string
          items: Json
          link_id: string
          link_token: string
          link_type: string
          merchant_logo_url: string
          merchant_name: string
          merchant_user_id: string
          merchant_username: string
          mode: string
          redirect_url: string
          title: string
          total_amount: number
        }[]
      }
      get_user_kyc_status: {
        Args: { user_uuid: string }
        Returns: {
          id: string
          rejection_reason: string
          reviewed_at: string
          status: string
          submitted_at: string
        }[]
      }
      is_nft_admin: { Args: { _user_id: string }; Returns: boolean }
      is_openpay_core_admin: { Args: never; Returns: boolean }
      is_openpay_metrics_admin: { Args: never; Returns: boolean }
      is_support_agent: { Args: { p_user_id: string }; Returns: boolean }
      is_transaction_participant: {
        Args: { _transaction_id: string }
        Returns: boolean
      }
      issue_my_openpay_authorization_code: {
        Args: { p_force_new?: boolean }
        Returns: {
          authorization_code: string
          expires_at: string
        }[]
      }
      master_topup_internal: {
        Args: {
          p_amount: number
          p_target_account_number?: string
          p_target_username?: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      nft_admin_list_items: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          code: string
          created_at: string
          creator_email: string
          creator_id: string
          currency: string
          id: string
          image_url: string
          is_active: boolean
          name: string
          owners_count: number
          price: number
          quantity_total: number
          sales_volume: number
          sold_count: number
        }[]
      }
      nft_admin_metrics: { Args: never; Returns: Json }
      nft_admin_recent_activity: {
        Args: { p_limit?: number }
        Returns: {
          buyer_id: string
          created_at: string
          currency: string
          id: string
          item_id: string
          item_name: string
          payment_method: string
          platform_fee: number
          quantity: number
          royalty_amount: number
          seller_id: string
          status: string
          total: number
          tx_kind: string
        }[]
      }
      nft_admin_remove_item: {
        Args: { p_item_id: string; p_reason?: string }
        Returns: boolean
      }
      nft_admin_restore_item: { Args: { p_item_id: string }; Returns: boolean }
      nft_admin_set_platform_fee: {
        Args: { p_collector?: string; p_enabled: boolean; p_rate: number }
        Returns: Json
      }
      nft_buy_item: {
        Args: {
          p_card_cvc?: string
          p_card_exp_month?: number
          p_card_exp_year?: number
          p_card_number?: string
          p_item_id: string
          p_listing_id?: string
          p_payment_method: string
          p_pi_payment_id?: string
          p_pi_txid?: string
          p_quantity: number
        }
        Returns: string
      }
      nft_cancel_auction: { Args: { p_auction_id: string }; Returns: boolean }
      nft_cancel_listing: { Args: { p_listing_id: string }; Returns: boolean }
      nft_create_auction: {
        Args: {
          p_duration_hours: number
          p_item_id: string
          p_min_increment: number
          p_quantity: number
          p_start_price: number
        }
        Returns: string
      }
      nft_create_listing: {
        Args: { p_item_id: string; p_price: number; p_quantity: number }
        Returns: string
      }
      nft_finalize_auction: { Args: { p_auction_id: string }; Returns: string }
      nft_get_platform_fee: { Args: never; Returns: Json }
      nft_gift_item: {
        Args: {
          p_item_id: string
          p_message: string
          p_quantity: number
          p_recipient_id: string
        }
        Returns: string
      }
      nft_mint_item: {
        Args: {
          p_code: string
          p_collection_id: string
          p_currency: string
          p_description: string
          p_image_url: string
          p_media_type: string
          p_media_url: string
          p_name: string
          p_price: number
          p_properties: Json
          p_quantity: number
        }
        Returns: string
      }
      nft_place_bid: {
        Args: { p_amount: number; p_auction_id: string }
        Returns: string
      }
      nft_update_listing_price: {
        Args: { p_listing_id: string; p_new_price: number }
        Returns: boolean
      }
      normalize_openpay_authorization_code: {
        Args: { p_code: string }
        Returns: string
      }
      normalize_openpay_code: { Args: { p_code: string }; Returns: string }
      pay_merchant_checkout_with_virtual_card:
        | {
            Args: {
              p_card_number: string
              p_cvc: string
              p_expiry_month: number
              p_expiry_year: number
              p_note?: string
              p_session_token: string
            }
            Returns: string
          }
        | {
            Args: {
              p_card_number: string
              p_customer_address?: string
              p_customer_email?: string
              p_customer_name?: string
              p_customer_phone?: string
              p_cvc: string
              p_expiry_month: number
              p_expiry_year: number
              p_note?: string
              p_session_token: string
            }
            Returns: string
          }
      pay_merchant_checkout_with_wallet: {
        Args: {
          p_customer_address?: string
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_note?: string
          p_session_token: string
        }
        Returns: string
      }
      pay_my_loan_monthly: {
        Args: { p_amount?: number; p_loan_id: string; p_note?: string }
        Returns: {
          loan_id: string
          paid_months: number
          remaining_balance: number
          status: string
          wallet_balance: number
        }[]
      }
      pay_my_loan_monthly_with_method: {
        Args: {
          p_amount?: number
          p_loan_id: string
          p_note?: string
          p_payment_method?: string
          p_payment_reference?: string
        }
        Returns: {
          loan_id: string
          paid_months: number
          remaining_balance: number
          status: string
          wallet_balance: number
        }[]
      }
      pay_with_virtual_card_checkout: {
        Args: {
          p_amount: number
          p_card_number: string
          p_cvc: string
          p_expiry_month: number
          p_expiry_year: number
          p_note?: string
          p_receiver_id: string
        }
        Returns: string
      }
      process_app_payment: {
        Args: {
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_link_token: string
          p_payer_user_id: string
          p_payment_method?: string
        }
        Returns: {
          message: string
          status: string
          transaction_id: string
        }[]
      }
      process_app_payment_public: {
        Args: {
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_link_token: string
          p_payer_account: string
          p_payer_pin?: string
          p_payment_method?: string
        }
        Returns: {
          message: string
          status: string
          transaction_id: string
        }[]
      }
      qr_pay__notify_and_email:
        | {
            Args: {
              p_amount: number
              p_delivery_address: string
              p_delivery_notes: string
              p_method: string
              p_pay: Database["public"]["Tables"]["qr_payments"]["Row"]
              p_payer_email: string
              p_payer_name: string
              p_payer_phone: string
              p_ref: string
              p_tx_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_amount: number
              p_delivery_address: string
              p_delivery_notes: string
              p_method: string
              p_pay: Database["public"]["Tables"]["qr_payments"]["Row"]
              p_payer_email: string
              p_payer_name: string
              p_payer_phone: string
              p_payer_user_id?: string
              p_ref: string
              p_tx_id: string
            }
            Returns: undefined
          }
      qr_pay_analytics: { Args: { p_range?: string }; Returns: Json }
      qr_pay_api_create_key: {
        Args: { p_name: string; p_scopes?: string[] }
        Returns: {
          api_key: string
          id: string
          key_prefix: string
          last4: string
          name: string
          scopes: string[]
        }[]
      }
      qr_pay_api_revoke_key: { Args: { p_id: string }; Returns: boolean }
      qr_pay_api_stats: { Args: never; Returns: Json }
      qr_pay_calc_charge_amount: {
        Args: {
          p_amount: number
          p_payment: Database["public"]["Tables"]["qr_payments"]["Row"]
        }
        Returns: number
      }
      qr_pay_complete_pi: {
        Args: {
          p_amount?: number
          p_delivery_address?: string
          p_delivery_notes?: string
          p_payer_email?: string
          p_payer_name?: string
          p_payer_phone?: string
          p_payer_username?: string
          p_pi_payment_id: string
          p_pi_txid: string
          p_token: string
        }
        Returns: Json
      }
      qr_pay_complete_virtual_card: {
        Args: {
          p_amount?: number
          p_card_number: string
          p_cvc: string
          p_delivery_address?: string
          p_delivery_notes?: string
          p_payer_email?: string
          p_payer_name?: string
          p_payer_phone?: string
          p_token: string
        }
        Returns: Json
      }
      qr_pay_complete_wallet: {
        Args: {
          p_amount?: number
          p_delivery_address?: string
          p_delivery_notes?: string
          p_payer_email?: string
          p_payer_name?: string
          p_payer_phone?: string
          p_token: string
        }
        Returns: Json
      }
      qr_pay_create: {
        Args: {
          p_after_payment_action?: string
          p_allow_custom_amount?: boolean
          p_allow_guest: boolean
          p_allow_pi: boolean
          p_allow_virtual_card: boolean
          p_allow_wallet: boolean
          p_collect_delivery?: boolean
          p_cover_image_url?: string
          p_currency: string
          p_delivery_fields?: Json
          p_description: string
          p_download_url?: string
          p_expires_minutes: number
          p_items: Json
          p_min_amount?: number
          p_payment_type?: string
          p_redirect_url?: string
          p_reusable: boolean
          p_suggested_amount?: number
          p_title: string
        }
        Returns: Json
      }
      qr_pay_delete: { Args: { p_id: string }; Returns: Json }
      qr_pay_gen_token: { Args: never; Returns: string }
      qr_pay_get_by_token: { Args: { p_token: string }; Returns: Json }
      qr_pay_merchant_stats: { Args: never; Returns: Json }
      random_token_hex: { Args: { p_bytes?: number }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refund_my_pos_transaction: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: {
          new_status: string
          refund_transaction_id: string
          refunded_at: string
        }[]
      }
      reject_app_payment_scan: {
        Args: { p_scan_id: string }
        Returns: {
          message: string
          status: string
        }[]
      }
      request_my_openpay_loan: {
        Args: {
          p_credit_score?: number
          p_principal_amount: number
          p_term_months?: number
        }
        Returns: {
          created_at: string
          credit_score: number
          id: string
          monthly_fee_rate: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months: number
          principal_amount: number
          status: string
          term_months: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_loans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_affiliate_submission: {
        Args: { p_approve: boolean; p_note?: string; p_submission_id: string }
        Returns: Json
      }
      revoke_my_merchant_api_key: {
        Args: { p_key_id: string }
        Returns: boolean
      }
      save_my_virtual_card_signature: {
        Args: { p_signature: string }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "virtual_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      skip_account_onboarding: {
        Args: never
        Returns: {
          message: string
          success: boolean
        }[]
      }
      start_mining_session: {
        Args: {
          p_ad_verified?: boolean
          p_device_fingerprint?: string
          p_ip_address?: string
          p_pi_browser_used?: boolean
        }
        Returns: Json
      }
      submit_affiliate_task: {
        Args: { p_notes?: string; p_proof_url: string; p_task_id: string }
        Returns: Json
      }
      submit_my_loan_application: {
        Args: {
          p_address_line: string
          p_agreement_accepted?: boolean
          p_city: string
          p_contact_number: string
          p_country: string
          p_full_name: string
          p_openpay_account_number: string
          p_openpay_account_username: string
          p_requested_amount: number
          p_requested_term_months: number
        }
        Returns: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          agreement_accepted_at: string | null
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_open_partner_lead: {
        Args: {
          p_business_type?: string
          p_company_name: string
          p_contact_email: string
          p_contact_name: string
          p_country?: string
          p_estimated_monthly_volume?: string
          p_integration_type?: string
          p_message?: string
          p_use_case_summary?: string
          p_website_url?: string
        }
        Returns: {
          admin_note: string | null
          business_type: string | null
          company_name: string
          contact_email: string
          contact_name: string
          country: string | null
          created_at: string
          estimated_monthly_volume: string | null
          id: string
          integration_type: string | null
          message: string | null
          requester_user_id: string
          status: string
          updated_at: string
          use_case_summary: string
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "open_partner_leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_swap_withdrawal: {
        Args: {
          p_amount: number
          p_mrwn_wallet_address?: string
          p_openpay_account_name: string
          p_openpay_account_number: string
          p_openpay_account_username: string
          p_ousd_sol_wallet_address?: string
          p_ousd_wallet_address?: string
          p_pi_wallet_address?: string
          p_withdrawal_type?: string
        }
        Returns: {
          admin_note: string
          amount: number
          created_at: string
          fee_amount: number
          fee_rate: number
          id: string
          mrwn_wallet_address: string
          openpay_account_name: string
          openpay_account_number: string
          openpay_account_username: string
          ousd_sol_wallet_address: string
          ousd_wallet_address: string
          payout_amount: number
          pi_wallet_address: string
          refund_transaction_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_transaction_id: string | null
          updated_at: string
          user_id: string
          withdrawal_type: string
        }
        SetofOptions: {
          from: "*"
          to: "user_swap_withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_topup_request: {
        Args: {
          p_amount: number
          p_openpay_account_name: string
          p_openpay_account_number: string
          p_openpay_account_username: string
          p_proof_url: string
          p_provider: string
          p_reference_code: string
        }
        Returns: {
          admin_note: string
          amount: number
          created_at: string
          id: string
          openpay_account_name: string
          openpay_account_number: string
          openpay_account_username: string
          proof_url: string
          provider: string
          reference_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_transaction_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_topup_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_mining_state: { Args: never; Returns: undefined }
      transfer_funds: {
        Args: {
          p_amount: number
          p_note?: string
          p_receiver_id: string
          p_sender_id: string
        }
        Returns: string
      }
      transfer_funds_authenticated: {
        Args: { p_amount: number; p_note?: string; p_receiver_id: string }
        Returns: string
      }
      transfer_my_merchant_balance: {
        Args: {
          p_amount: number
          p_destination?: string
          p_mode?: string
          p_note?: string
        }
        Returns: {
          available_balance: number
          savings_balance: number
          transfer_id: string
          wallet_balance: number
        }[]
      }
      transfer_my_savings_to_wallet: {
        Args: { p_amount: number; p_note?: string }
        Returns: {
          savings_balance: number
          transfer_id: string
          wallet_balance: number
        }[]
      }
      transfer_my_wallet_to_savings: {
        Args: { p_amount: number; p_note?: string }
        Returns: {
          savings_balance: number
          transfer_id: string
          wallet_balance: number
        }[]
      }
      update_kyc_status: {
        Args: {
          admin_notes_text?: string
          application_id: string
          new_status: string
          rejection_reason_text?: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      update_my_virtual_card_controls: {
        Args: {
          p_card_settings?: Json
          p_hide_details?: boolean
          p_lock_card?: boolean
        }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "virtual_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upload_profile_image: {
        Args: { p_image_url: string }
        Returns: undefined
      }
      upsert_my_merchant_profile: {
        Args: {
          p_default_currency?: string
          p_merchant_logo_url?: string
          p_merchant_name?: string
          p_merchant_username?: string
        }
        Returns: {
          created_at: string
          default_currency: string
          is_active: boolean
          merchant_logo_url: string | null
          merchant_name: string
          merchant_username: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_payment_link_share_settings: {
        Args: {
          p_button_label?: string
          p_button_size?: string
          p_button_style?: string
          p_direct_open_new_tab?: boolean
          p_iframe_height?: number
          p_link_id: string
          p_qr_logo_enabled?: boolean
          p_qr_logo_url?: string
          p_qr_size?: number
          p_widget_theme?: string
        }
        Returns: {
          button_label: string
          button_size: string
          button_style: string
          created_at: string
          direct_open_new_tab: boolean
          iframe_height: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled: boolean
          qr_logo_url: string
          qr_size: number
          updated_at: string
          widget_theme: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_payment_link_share_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_pos_api_key: {
        Args: { p_mode: string; p_secret_key: string }
        Returns: {
          api_key_id: string
          key_name: string
          mode: string
          publishable_key: string
        }[]
      }
      upsert_my_savings_account: {
        Args: never
        Returns: {
          apy: number
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_savings_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_user_account: {
        Args: never
        Returns: {
          account_name: string
          account_number: string
          account_username: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_virtual_card: {
        Args: { p_card_username?: string; p_cardholder_name?: string }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "virtual_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_my_openpay_authorization_code: {
        Args: { p_code: string }
        Returns: boolean
      }
      verify_my_openpay_code: { Args: { p_code: string }; Returns: boolean }
      withdraw_mining_earnings: {
        Args: { p_min_payout?: number }
        Returns: Json
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
