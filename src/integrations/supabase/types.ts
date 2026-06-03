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
      achievements: {
        Row: {
          description: string
          icon: string
          id: string
          name: string
          tier: string
        }
        Insert: {
          description: string
          icon?: string
          id: string
          name: string
          tier?: string
        }
        Update: {
          description?: string
          icon?: string
          id?: string
          name?: string
          tier?: string
        }
        Relationships: []
      }
      api_cache: {
        Row: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at: string
        }
        Insert: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at?: string
        }
        Update: {
          cache_key?: string
          expires_at?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
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
      audit_logs: {
        Row: {
          action_type: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          article_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
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
          created_by: string | null
          id: string
          is_group: boolean
          last_message_at: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          title?: string | null
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          created_at: string
          event_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_members: {
        Row: {
          chat_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "event_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_messages: {
        Row: {
          body: string
          chat_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          chat_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          chat_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "event_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chats: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          last_message_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          last_message_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chats_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          image_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          image_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          image_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          away_score: number | null
          away_team: string | null
          away_team_flag: string | null
          city: string | null
          competition: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          external_id: string | null
          home_score: number | null
          home_team: string | null
          home_team_flag: string | null
          id: string
          is_featured: boolean
          kickoff: string
          minute: number | null
          stage: Database["public"]["Enums"]["event_stage"] | null
          status: string
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_team?: string | null
          away_team_flag?: string | null
          city?: string | null
          competition?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          external_id?: string | null
          home_score?: number | null
          home_team?: string | null
          home_team_flag?: string | null
          id?: string
          is_featured?: boolean
          kickoff: string
          minute?: number | null
          stage?: Database["public"]["Enums"]["event_stage"] | null
          status?: string
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_team?: string | null
          away_team_flag?: string | null
          city?: string | null
          competition?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          external_id?: string | null
          home_score?: number | null
          home_team?: string | null
          home_team_flag?: string | null
          id?: string
          is_featured?: boolean
          kickoff?: string
          minute?: number | null
          stage?: Database["public"]["Enums"]["event_stage"] | null
          status?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          status: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          status?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          status?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          is_private: boolean
          min_plan: Database["public"]["Enums"]["membership_plan"]
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["group_type"]
        }
        Insert: {
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_private?: boolean
          min_plan?: Database["public"]["Enums"]["membership_plan"]
          name: string
          owner_id: string
          type?: Database["public"]["Enums"]["group_type"]
        }
        Update: {
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_private?: boolean
          min_plan?: Database["public"]["Enums"]["membership_plan"]
          name?: string
          owner_id?: string
          type?: Database["public"]["Enums"]["group_type"]
        }
        Relationships: [
          {
            foreignKeyName: "groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      match_state: {
        Row: {
          away_score: number | null
          fixture_id: string
          home_score: number | null
          opponent: string | null
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          fixture_id: string
          home_score?: number | null
          opponent?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          fixture_id?: string
          home_score?: number | null
          opponent?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_score: number | null
          competition: string
          created_at: string
          highlights_url: string | null
          home_score: number | null
          id: string
          is_home: boolean
          kickoff: string
          opponent: string
          opponent_flag: string | null
          status: Database["public"]["Enums"]["match_status"]
          venue: string
        }
        Insert: {
          away_score?: number | null
          competition: string
          created_at?: string
          highlights_url?: string | null
          home_score?: number | null
          id?: string
          is_home?: boolean
          kickoff: string
          opponent: string
          opponent_flag?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          venue: string
        }
        Update: {
          away_score?: number | null
          competition?: string
          created_at?: string
          highlights_url?: string | null
          home_score?: number | null
          id?: string
          is_home?: boolean
          kickoff?: string
          opponent?: string
          opponent_flag?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          venue?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author_id: string | null
          body: string
          category: Database["public"]["Enums"]["news_category"]
          cover_url: string | null
          created_at: string
          excerpt: string
          id: string
          is_premium: boolean
          published_at: string
          slug: string
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          category?: Database["public"]["Enums"]["news_category"]
          cover_url?: string | null
          created_at?: string
          excerpt: string
          id?: string
          is_premium?: boolean
          published_at?: string
          slug: string
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["news_category"]
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          is_premium?: boolean
          published_at?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          dedup_key: string
          sent_at: string
        }
        Insert: {
          dedup_key: string
          sent_at?: string
        }
        Update: {
          dedup_key?: string
          sent_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          provider: string | null
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          currency: string
          id: string
          name: string
          perks: Json
          price_cents: number
          sort_order: number
          tagline: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          currency?: string
          id: string
          name: string
          perks?: Json
          price_cents?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          currency?: string
          id?: string
          name?: string
          perks?: Json
          price_cents?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      players: {
        Row: {
          assists: number
          bio: string | null
          caps: number
          club: string
          created_at: string
          date_of_birth: string | null
          goals: number
          id: string
          jersey_number: number | null
          name: string
          photo_url: string | null
          position: Database["public"]["Enums"]["player_position"]
        }
        Insert: {
          assists?: number
          bio?: string | null
          caps?: number
          club: string
          created_at?: string
          date_of_birth?: string | null
          goals?: number
          id?: string
          jersey_number?: number | null
          name: string
          photo_url?: string | null
          position: Database["public"]["Enums"]["player_position"]
        }
        Update: {
          assists?: number
          bio?: string | null
          caps?: number
          club?: string
          created_at?: string
          date_of_birth?: string | null
          goals?: number
          id?: string
          jersey_number?: number | null
          name?: string
          photo_url?: string | null
          position?: Database["public"]["Enums"]["player_position"]
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string | null
          created_at: string
          event_id: string | null
          group_id: string | null
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_visits: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string
          cover_url: string | null
          created_at: string
          deleted_at: string | null
          favourite_team: string | null
          full_name: string
          id: string
          interests: string[]
          is_deleted: boolean
          is_premium: boolean
          is_private: boolean
          last_seen: string | null
          phone: string | null
          plan: Database["public"]["Enums"]["membership_plan"]
          premium_until: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          favourite_team?: string | null
          full_name?: string
          id: string
          interests?: string[]
          is_deleted?: boolean
          is_premium?: boolean
          is_private?: boolean
          last_seen?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["membership_plan"]
          premium_until?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          favourite_team?: string | null
          full_name?: string
          id?: string
          interests?: string[]
          is_deleted?: boolean
          is_premium?: boolean
          is_private?: boolean
          last_seen?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["membership_plan"]
          premium_until?: string | null
          updated_at?: string
          username?: string | null
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
          prefs: Json
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          prefs?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          prefs?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      seen_articles: {
        Row: {
          seen_at: string
          title: string | null
          url: string
        }
        Insert: {
          seen_at?: string
          title?: string | null
          url: string
        }
        Update: {
          seen_at?: string
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
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
      is_conv_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_event_chat_member: {
        Args: { _chat: string; _user: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action_type: string
          _after?: Json
          _before?: Json
          _metadata?: Json
          _target_id?: string
          _target_type: string
        }
        Returns: string
      }
      monthly_event_joins: { Args: { _user: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
      attendance_status: "going" | "interested" | "maybe" | "not_going"
      event_stage:
        | "group"
        | "r32"
        | "r16"
        | "qf"
        | "sf"
        | "third"
        | "final"
        | "friendly"
        | "other"
      event_type:
        | "wc_match"
        | "match"
        | "tournament"
        | "fan_zone"
        | "meetup"
        | "festival"
        | "travel"
      group_type: "travel" | "meetup" | "community" | "private" | "gold"
      match_status: "upcoming" | "live" | "completed"
      membership_plan: "bronze" | "silver" | "gold"
      news_category: "team" | "match" | "player" | "supporter"
      player_position: "GK" | "DEF" | "MID" | "FWD"
      subscription_status: "active" | "cancelled" | "expired" | "pending"
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
      app_role: ["admin", "user"],
      attendance_status: ["going", "interested", "maybe", "not_going"],
      event_stage: [
        "group",
        "r32",
        "r16",
        "qf",
        "sf",
        "third",
        "final",
        "friendly",
        "other",
      ],
      event_type: [
        "wc_match",
        "match",
        "tournament",
        "fan_zone",
        "meetup",
        "festival",
        "travel",
      ],
      group_type: ["travel", "meetup", "community", "private", "gold"],
      match_status: ["upcoming", "live", "completed"],
      membership_plan: ["bronze", "silver", "gold"],
      news_category: ["team", "match", "player", "supporter"],
      player_position: ["GK", "DEF", "MID", "FWD"],
      subscription_status: ["active", "cancelled", "expired", "pending"],
    },
  },
} as const
