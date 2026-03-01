// Supabase Database 타입 정의
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          nickname: string | null;
          role: 'user' | 'master';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nickname?: string | null;
          role?: 'user' | 'master';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          nickname?: string | null;
          role?: 'user' | 'master';
          created_at?: string;
          updated_at?: string;
        };
      };
      articles: {
        Row: {
          id: string;
          user_id: string;
          source_id: string;
          source_name: string;
          source_url: string;
          title: string;
          content_preview: string | null;
          summary: string | null;
          summary_tags: string[];
          author: string | null;
          published_at: string | null;
          crawled_at: string;
          priority: number;
          category: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_id: string;
          source_name: string;
          source_url: string;
          title: string;
          content_preview?: string | null;
          summary?: string | null;
          summary_tags?: string[];
          author?: string | null;
          published_at?: string | null;
          crawled_at?: string;
          priority?: number;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_id?: string;
          source_name?: string;
          source_url?: string;
          title?: string;
          content_preview?: string | null;
          summary?: string | null;
          summary_tags?: string[];
          author?: string | null;
          published_at?: string | null;
          crawled_at?: string;
          priority?: number;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          is_default: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          is_default?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          is_default?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      crawl_sources: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          base_url: string;
          priority: number;
          crawler_type: string;
          config: Record<string, unknown>;
          is_active: boolean;
          last_crawled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          base_url: string;
          priority?: number;
          crawler_type?: string;
          config?: Record<string, unknown>;
          is_active?: boolean;
          last_crawled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          base_url?: string;
          priority?: number;
          crawler_type?: string;
          config?: Record<string, unknown>;
          is_active?: boolean;
          last_crawled_at?: string | null;
          created_at?: string;
        };
      };
      crawl_logs: {
        Row: {
          id: number;
          source_id: number;
          started_at: string;
          finished_at: string | null;
          status: string;
          articles_found: number;
          articles_new: number;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          source_id: number;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          articles_found?: number;
          articles_new?: number;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          source_id?: number;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          articles_found?: number;
          articles_new?: number;
          error_message?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
