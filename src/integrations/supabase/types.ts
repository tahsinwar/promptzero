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
      admin_settings: {
        Row: {
          id: number
          settings: Json | null
        }
        Insert: {
          id?: number
          settings?: Json | null
        }
        Update: {
          id?: number
          settings?: Json | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_name: string
          content: string
          created_at: string | null
          id: string
          ip_address: string | null
          is_approved: boolean | null
          is_pinned: boolean | null
          parent_id: string | null
          prompt_id: string | null
          upvotes: number | null
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_approved?: boolean | null
          is_pinned?: boolean | null
          parent_id?: string | null
          prompt_id?: string | null
          upvotes?: number | null
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_approved?: boolean | null
          is_pinned?: boolean | null
          parent_id?: string | null
          prompt_id?: string | null
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_links: {
        Row: {
          description: string | null
          display_order: number | null
          id: string
          link_clicks: number
          link_type: string | null
          prompt_id: string | null
          title: string
          url: string
        }
        Insert: {
          description?: string | null
          display_order?: number | null
          id?: string
          link_clicks?: number
          link_type?: string | null
          prompt_id?: string | null
          title: string
          url: string
        }
        Update: {
          description?: string | null
          display_order?: number | null
          id?: string
          link_clicks?: number
          link_type?: string | null
          prompt_id?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_links_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_qa: {
        Row: {
          answer: string
          display_order: number | null
          id: string
          prompt_id: string | null
          question: string
        }
        Insert: {
          answer: string
          display_order?: number | null
          id?: string
          prompt_id?: string | null
          question: string
        }
        Update: {
          answer?: string
          display_order?: number | null
          id?: string
          prompt_id?: string | null
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_qa_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_tags: {
        Row: {
          prompt_id: string
          tag_id: string
        }
        Insert: {
          prompt_id: string
          tag_id: string
        }
        Update: {
          prompt_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_tags_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          change_note: string | null
          changed_at: string | null
          content: string
          id: string
          prompt_id: string | null
        }
        Insert: {
          change_note?: string | null
          changed_at?: string | null
          content: string
          id?: string
          prompt_id?: string | null
        }
        Update: {
          change_note?: string | null
          changed_at?: string | null
          content?: string
          id?: string
          prompt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_videos: {
        Row: {
          display_order: number | null
          id: string
          prompt_id: string | null
          title: string | null
          youtube_url: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          prompt_id?: string | null
          title?: string | null
          youtube_url: string
        }
        Update: {
          display_order?: number | null
          id?: string
          prompt_id?: string | null
          title?: string | null
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_videos_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          ai_models: string[] | null
          auto_lock_minutes: number | null
          category_id: string | null
          content: string
          copy_count: number | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          expires_at: string | null
          id: string
          is_featured: boolean | null
          is_locked: boolean | null
          is_published: boolean | null
          notes: string | null
          pin_hash: string | null
          rating_avg: number | null
          short_code: string | null
          slug: string
          status: string
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          ai_models?: string[] | null
          auto_lock_minutes?: number | null
          category_id?: string | null
          content: string
          copy_count?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_locked?: boolean | null
          is_published?: boolean | null
          notes?: string | null
          pin_hash?: string | null
          rating_avg?: number | null
          short_code?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          ai_models?: string[] | null
          auto_lock_minutes?: number | null
          category_id?: string | null
          content?: string
          copy_count?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_locked?: boolean | null
          is_published?: boolean | null
          notes?: string | null
          pin_hash?: string | null
          rating_avg?: number | null
          short_code?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          created_at: string | null
          id: string
          prompt_id: string | null
          session_id: string
          value: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt_id?: string | null
          session_id: string
          value?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prompt_id?: string | null
          session_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
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
      visitor_questions: {
        Row: {
          answer: string | null
          author_name: string
          created_at: string | null
          id: string
          is_published: boolean | null
          prompt_id: string | null
          question: string
        }
        Insert: {
          answer?: string | null
          author_name: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          prompt_id?: string | null
          question: string
        }
        Update: {
          answer?: string | null
          author_name?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          prompt_id?: string | null
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_questions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
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
      increment_comment_upvote: { Args: { c_id: string }; Returns: undefined }
      increment_copy_count: { Args: { p_id: string }; Returns: undefined }
      increment_link_clicks: { Args: { l_id: string }; Returns: undefined }
      increment_view_count: { Args: { p_slug: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
