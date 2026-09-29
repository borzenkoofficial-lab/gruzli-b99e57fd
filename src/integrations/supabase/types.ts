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
      app_ratings: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          updated_at: string
          value: Json
        }
        Insert: {
          id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          failed_count: number
          finished_at: string | null
          id: string
          image_url: string | null
          link_label: string | null
          link_url: string | null
          sent_count: number
          status: string
          target_channels: boolean
          target_personal: boolean
          text: string
          total_targets: number
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          sent_count?: number
          status?: string
          target_channels?: boolean
          target_personal?: boolean
          text?: string
          total_targets?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          sent_count?: number
          status?: string
          target_channels?: boolean
          target_personal?: boolean
          text?: string
          total_targets?: number
        }
        Relationships: []
      }
      channel_post_comments: {
        Row: {
          created_at: string
          id: string
          post_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          text?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "channel_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "channel_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_posts: {
        Row: {
          author_id: string
          created_at: string
          id: string
          image_url: string | null
          text: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          text?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_signatures: {
        Row: {
          contract_id: string
          id: string
          ip_address: string | null
          signature_url: string
          signed_at: string
          signed_pdf_url: string | null
          user_agent: string | null
          worker_id: string
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: string | null
          signature_url: string
          signed_at?: string
          signed_pdf_url?: string | null
          user_agent?: string | null
          worker_id: string
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: string | null
          signature_url?: string
          signed_at?: string
          signed_pdf_url?: string | null
          user_agent?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_group: boolean | null
          job_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_group?: boolean | null
          job_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_group?: boolean | null
          job_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatcher_goals: {
        Row: {
          checklist: Json
          checklist_date: string
          created_at: string
          daily_profit_goal: number
          dispatcher_id: string
          id: string
          updated_at: string
          weekly_profit_goal: number
        }
        Insert: {
          checklist?: Json
          checklist_date?: string
          created_at?: string
          daily_profit_goal?: number
          dispatcher_id: string
          id?: string
          updated_at?: string
          weekly_profit_goal?: number
        }
        Update: {
          checklist?: Json
          checklist_date?: string
          created_at?: string
          daily_profit_goal?: number
          dispatcher_id?: string
          id?: string
          updated_at?: string
          weekly_profit_goal?: number
        }
        Relationships: []
      }
      dispatcher_reviews: {
        Row: {
          created_at: string
          dispatcher_id: string
          id: string
          rating: number
          reviewer_id: string
          text: string | null
        }
        Insert: {
          created_at?: string
          dispatcher_id: string
          id?: string
          rating: number
          reviewer_id: string
          text?: string | null
        }
        Update: {
          created_at?: string
          dispatcher_id?: string
          id?: string
          rating?: number
          reviewer_id?: string
          text?: string | null
        }
        Relationships: []
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
      fraud_reports: {
        Row: {
          created_at: string
          details: string
          dispatcher_id: string | null
          id: string
          job_id: string | null
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string
          dispatcher_id?: string | null
          id?: string
          job_id?: string | null
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string
          dispatcher_id?: string | null
          id?: string
          job_id?: string | null
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      job_contracts: {
        Row: {
          body: string
          created_at: string
          dispatcher_id: string
          dispatcher_signature_url: string | null
          dispatcher_signed_at: string | null
          id: string
          job_id: string
          status: string
          terms: Json
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          dispatcher_id: string
          dispatcher_signature_url?: string | null
          dispatcher_signed_at?: string | null
          id?: string
          job_id: string
          status?: string
          terms?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          dispatcher_id?: string
          dispatcher_signature_url?: string | null
          dispatcher_signed_at?: string | null
          id?: string
          job_id?: string
          status?: string
          terms?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_documents: {
        Row: {
          amount: number
          created_at: string
          dispatcher_id: string
          hours: number | null
          id: string
          job_id: string
          metadata: Json
          number: string | null
          pdf_path: string | null
          title: string
          type: string
          worker_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          dispatcher_id: string
          hours?: number | null
          id?: string
          job_id: string
          metadata?: Json
          number?: string | null
          pdf_path?: string | null
          title?: string
          type: string
          worker_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          dispatcher_id?: string
          hours?: number | null
          id?: string
          job_id?: string
          metadata?: Json
          number?: string | null
          pdf_path?: string | null
          title?: string
          type?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      job_responses: {
        Row: {
          created_at: string
          dispatcher_review_rating: number | null
          dispatcher_review_text: string | null
          earned: number | null
          hours_worked: number | null
          id: string
          job_id: string
          message: string | null
          status: string | null
          work_finished_at: string | null
          work_started_at: string | null
          worker_id: string
          worker_review_rating: number | null
          worker_review_text: string | null
          worker_status: string | null
        }
        Insert: {
          created_at?: string
          dispatcher_review_rating?: number | null
          dispatcher_review_text?: string | null
          earned?: number | null
          hours_worked?: number | null
          id?: string
          job_id: string
          message?: string | null
          status?: string | null
          work_finished_at?: string | null
          work_started_at?: string | null
          worker_id: string
          worker_review_rating?: number | null
          worker_review_text?: string | null
          worker_status?: string | null
        }
        Update: {
          created_at?: string
          dispatcher_review_rating?: number | null
          dispatcher_review_text?: string | null
          earned?: number | null
          hours_worked?: number | null
          id?: string
          job_id?: string
          message?: string | null
          status?: string | null
          work_finished_at?: string | null
          work_started_at?: string | null
          worker_id?: string
          worker_review_rating?: number | null
          worker_review_text?: string | null
          worker_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_responses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_templates: {
        Row: {
          address: string | null
          client_id: string | null
          created_at: string
          description: string | null
          dispatcher_id: string | null
          duration_hours: number | null
          hourly_rate: number
          id: string
          metro: string | null
          name: string
          quick_minimum: boolean | null
          title: string
          updated_at: string
          urgent: boolean | null
          use_count: number
          workers_needed: number | null
        }
        Insert: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          dispatcher_id?: string | null
          duration_hours?: number | null
          hourly_rate?: number
          id?: string
          metro?: string | null
          name: string
          quick_minimum?: boolean | null
          title: string
          updated_at?: string
          urgent?: boolean | null
          use_count?: number
          workers_needed?: number | null
        }
        Update: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          dispatcher_id?: string | null
          duration_hours?: number | null
          hourly_rate?: number
          id?: string
          metro?: string | null
          name?: string
          quick_minimum?: boolean | null
          title?: string
          updated_at?: string
          urgent?: boolean | null
          use_count?: number
          workers_needed?: number | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          client_id: string | null
          dispatcher_id: string | null
          dispatcher_income: number | null
          duration_hours: number | null
          expense_per_worker: number | null
          hourly_rate: number
          id: string
          is_bot: boolean
          is_official: boolean
          metro: string | null
          quick_minimum: boolean | null
          recurring_rule: string | null
          replacement_for_job_id: string | null
          replacement_for_worker_id: string | null
          requires_contract: boolean
          start_time: string | null
          status: string | null
          template_id: string | null
          title: string
          updated_at: string
          urgent: boolean | null
          workers_needed: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          client_id?: string | null
          dispatcher_id?: string | null
          dispatcher_income?: number | null
          duration_hours?: number | null
          expense_per_worker?: number | null
          hourly_rate?: number
          id?: string
          is_bot?: boolean
          is_official?: boolean
          metro?: string | null
          quick_minimum?: boolean | null
          recurring_rule?: string | null
          replacement_for_job_id?: string | null
          replacement_for_worker_id?: string | null
          requires_contract?: boolean
          start_time?: string | null
          status?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          urgent?: boolean | null
          workers_needed?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          dispatcher_id?: string
          dispatcher_income?: number | null
          duration_hours?: number | null
          expense_per_worker?: number | null
          hourly_rate?: number
          id?: string
          is_bot?: boolean
          is_official?: boolean
          metro?: string | null
          quick_minimum?: boolean | null
          recurring_rule?: string | null
          replacement_for_job_id?: string | null
          replacement_for_worker_id?: string | null
          requires_contract?: boolean
          start_time?: string | null
          status?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          urgent?: boolean | null
          workers_needed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_replacement_for_job_id_fkey"
            columns: ["replacement_for_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kartoteka: {
        Row: {
          author_id: string
          birth_year: number | null
          category: string
          created_at: string
          description: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          social_links: string[] | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          birth_year?: number | null
          category?: string
          created_at?: string
          description?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          social_links?: string[] | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          birth_year?: number | null
          category?: string
          created_at?: string
          description?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          social_links?: string[] | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          media_url: string | null
          message_type: string | null
          reply_to_id: string | null
          sender_id: string
          text: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string | null
          reply_to_id?: string | null
          sender_id: string
          text?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string | null
          reply_to_id?: string | null
          sender_id?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability: boolean[] | null
          avatar_url: string | null
          balance: number | null
          birth_date: string | null
          blocked: boolean
          company_name: string | null
          company_plan: string | null
          company_until: string | null
          completed_orders: number | null
          created_at: string
          display_id: string | null
          full_name: string
          id: string
          inn: string | null
          is_company: boolean
          is_premium: boolean
          is_self_employed: boolean
          last_seen_at: string | null
          phone: string | null
          premium_until: string | null
          rating: number | null
          recovery_code: string | null
          skills: string[] | null
          total_earned: number | null
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          availability?: boolean[] | null
          avatar_url?: string | null
          balance?: number | null
          birth_date?: string | null
          blocked?: boolean
          company_name?: string | null
          company_plan?: string | null
          company_until?: string | null
          completed_orders?: number | null
          created_at?: string
          display_id?: string | null
          full_name?: string
          id?: string
          inn?: string | null
          is_company?: boolean
          is_premium?: boolean
          is_self_employed?: boolean
          last_seen_at?: string | null
          phone?: string | null
          premium_until?: string | null
          rating?: number | null
          recovery_code?: string | null
          skills?: string[] | null
          total_earned?: number | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          availability?: boolean[] | null
          avatar_url?: string | null
          balance?: number | null
          birth_date?: string | null
          blocked?: boolean
          company_name?: string | null
          company_plan?: string | null
          company_until?: string | null
          completed_orders?: number | null
          created_at?: string
          display_id?: string | null
          full_name?: string
          id?: string
          inn?: string | null
          is_company?: boolean
          is_premium?: boolean
          is_self_employed?: boolean
          last_seen_at?: string | null
          phone?: string | null
          premium_until?: string | null
          rating?: number | null
          recovery_code?: string | null
          skills?: string[] | null
          total_earned?: number | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_fsm_state: {
        Row: {
          chat_id: number
          data: Json
          expires_at: string
          state: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          chat_id: number
          data?: Json
          expires_at?: string
          state: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          chat_id?: number
          data?: Json
          expires_at?: string
          state?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_subscribers: {
        Row: {
          chat_id: number
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      telegram_user_channels: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          is_active: boolean
          title: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_rooms: {
        Row: {
          conversation_id: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_rooms_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_public: {
        Row: {
          availability: boolean[] | null
          avatar_url: string | null
          blocked: boolean | null
          completed_orders: number | null
          created_at: string | null
          display_id: string | null
          full_name: string | null
          is_premium: boolean | null
          is_self_employed: boolean | null
          last_seen_at: string | null
          premium_until: string | null
          rating: number | null
          skills: string[] | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          availability?: boolean[] | null
          avatar_url?: string | null
          blocked?: boolean | null
          completed_orders?: number | null
          created_at?: string | null
          display_id?: string | null
          full_name?: string | null
          is_premium?: boolean | null
          is_self_employed?: boolean | null
          last_seen_at?: string | null
          premium_until?: string | null
          rating?: number | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          availability?: boolean[] | null
          avatar_url?: string | null
          blocked?: boolean | null
          completed_orders?: number | null
          created_at?: string | null
          display_id?: string | null
          full_name?: string | null
          is_premium?: boolean | null
          is_self_employed?: boolean | null
          last_seen_at?: string | null
          premium_until?: string | null
          rating?: number | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      _notify_telegram_personal: {
        Args: { _payload: Json }
        Returns: undefined
      }
      accept_job_response: { Args: { _response_id: string }; Returns: Json }
      admin_get_user_recovery_code: {
        Args: { _target_user_id: string }
        Returns: string
      }
      admin_list_users: {
        Args: never
        Returns: {
          avatar_url: string
          balance: number
          blocked: boolean
          completed_orders: number
          created_at: string
          email: string
          full_name: string
          phone: string
          rating: number
          recovery_code: string
          role: string
          user_id: string
          verified: boolean
        }[]
      }
      admin_set_blocked: {
        Args: { _blocked: boolean; _target_user_id: string }
        Returns: undefined
      }
      admin_set_verified: {
        Args: { _target_user_id: string; _verified: boolean }
        Returns: undefined
      }
      admin_update_balance: {
        Args: { _amount: number; _target_user_id: string }
        Returns: undefined
      },
      client_create_job: {
        Args: {
          _address: string
          _description: string
          _duration_hours: number
          _hourly_rate: number
          _metro: string
          _quick_minimum?: boolean
          _requires_contract?: boolean
          _start_time: string
          _title: string
          _urgent?: boolean
          _workers_needed: number
        }
        Returns: Database["public"]["Tables"]["jobs"]["Row"]
      },
      dispatcher_claim_job: {
        Args: { _job_id: string }
        Returns: Database["public"]["Tables"]["jobs"]["Row"]
      }
      dispatcher_update_job: {
        Args: {
          _address?: string | null
          _description?: string | null
          _duration_hours?: number | null
          _hourly_rate?: number | null
          _job_id: string
          _metro?: string | null
          _quick_minimum?: boolean | null
          _start_time?: string | null
          _status?: string | null
          _title?: string | null
          _urgent?: boolean | null
          _workers_needed?: number | null
        }
        Returns: Database["public"]["Tables"]["jobs"]["Row"]
      }
      dispatcher_complete_job: {
        Args: { _dispatcher_income: number; _expense_per_worker: number; _job_id: string }
        Returns: Json
      }
      dispatcher_finish_job: {
        Args: { _job_id: string }
        Returns: Json
      }
      dispatcher_reject_job_response: {
        Args: { _response_id: string }
        Returns: Json
      }
      dispatcher_review_worker: {
        Args: { _rating: number; _response_id: string; _text?: string | null }
        Returns: Json
      }
      dispatcher_cancel_job: {
        Args: { _job_id: string }
        Returns: Json
      }
      create_direct_conversation: {
        Args: { _other_user_id: string; _title?: string }
        Returns: string
      }
      deduct_balance: {
        Args: { _amount: number; _user_id: string }
        Returns: number
      }
      delete_conversation_fully: {
        Args: { _conversation_id: string }
        Returns: string[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_recovery_code: { Args: never; Returns: string }
      get_support_user_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_weekly_completed_jobs: { Args: { _user_id: string }; Returns: number }
      worker_update_response_status: {
        Args: { _next_status: string; _response_id: string }
        Returns: Json
      }
      worker_withdraw_response: {
        Args: { _response_id: string }
        Returns: Json
      }
      worker_submit_response: {
        Args: { _job_id: string; _message?: string | null }
        Returns: Database["public"]["Tables"]["job_responses"]["Row"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      join_dispatcher_community: { Args: never; Returns: string }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "client" | "worker" | "dispatcher" | "admin"
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
      app_role: ["client", "worker", "dispatcher", "admin"],
    },
  },
} as const
