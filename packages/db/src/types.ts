export type HouseholdRole = 'owner' | 'admin' | 'member';
export type PersonType = 'adult' | 'child' | 'other';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          country: string | null;
          currency: string | null;
          timezone: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country?: string | null;
          currency?: string | null;
          timezone?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          country?: string | null;
          currency?: string | null;
          timezone?: string | null;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          joined_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Update: {
          role?: HouseholdRole;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      household_people: {
        Row: {
          id: string;
          household_id: string;
          user_id: string | null;
          name: string;
          person_type: PersonType;
          birthday: string | null;
          dietary: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id?: string | null;
          name: string;
          person_type?: PersonType;
          birthday?: string | null;
          dietary?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          person_type?: PersonType;
          birthday?: string | null;
          dietary?: string[];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'household_people_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      household_invites: {
        Row: {
          id: string;
          household_id: string;
          token_hash: string;
          email: string | null;
          role: HouseholdRole;
          expires_at: string;
          created_by: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          token_hash: string;
          email?: string | null;
          role?: HouseholdRole;
          expires_at: string;
          created_by: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'household_invites_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      nutrition_goals: {
        Row: {
          id: string;
          household_id: string;
          person_id: string | null;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          preset: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          person_id?: string | null;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          preset?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          calories?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          preset?: string | null;
          person_id?: string | null;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          household_id: string | null;
          catalog_key: string | null;
          name: string;
          emoji: string | null;
          cuisine: string | null;
          cook_time: number | null;
          servings: number | null;
          protein: number | null;
          calories: number | null;
          carbs: number | null;
          fat: number | null;
          vegetarian: boolean | null;
          ingredients: Json;
          method: Json;
          chef_tip: string | null;
          notes: string | null;
          meal_slots: string[];
          is_component: boolean;
          excluded_from_auto: boolean;
          is_public: boolean;
          source_url: string | null;
          image_url: string | null;
          image_flagged: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string | null;
          catalog_key?: string | null;
          name: string;
          emoji?: string | null;
          cuisine?: string | null;
          cook_time?: number | null;
          servings?: number | null;
          protein?: number | null;
          calories?: number | null;
          carbs?: number | null;
          fat?: number | null;
          vegetarian?: boolean | null;
          ingredients?: Json;
          method?: Json;
          chef_tip?: string | null;
          notes?: string | null;
          meal_slots?: string[];
          is_component?: boolean;
          excluded_from_auto?: boolean;
          is_public?: boolean;
          source_url?: string | null;
          image_url?: string | null;
          image_flagged?: boolean;
        };
        Update: {
          name?: string;
          emoji?: string | null;
          cuisine?: string | null;
          cook_time?: number | null;
          servings?: number | null;
          protein?: number | null;
          calories?: number | null;
          carbs?: number | null;
          fat?: number | null;
          vegetarian?: boolean | null;
          ingredients?: Json;
          method?: Json;
          chef_tip?: string | null;
          notes?: string | null;
          meal_slots?: string[];
          is_component?: boolean;
          excluded_from_auto?: boolean;
          source_url?: string | null;
          image_url?: string | null;
          image_flagged?: boolean;
        };
        Relationships: [];
      };
      catalog_editors: {
        Row: {
          user_id: string;
          claimed_at: string;
        };
        Insert: {
          user_id: string;
          claimed_at?: string;
        };
        Update: {
          claimed_at?: string;
        };
        Relationships: [];
      };
      recipe_favourites: {
        Row: {
          user_id: string;
          recipe_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          recipe_id: string;
          created_at?: string;
        };
        Update: {
          recipe_id?: string;
        };
        Relationships: [];
      };
      meal_plans: {
        Row: {
          id: string;
          household_id: string;
          week_start: string;
          active_slots: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          week_start: string;
          active_slots?: string[];
        };
        Update: {
          active_slots?: string[];
        };
        Relationships: [];
      };
      meal_slots: {
        Row: {
          id: string;
          meal_plan_id: string;
          household_id: string;
          day: string;
          slot_key: string;
          recipe_id: string | null;
          recipe_name: string | null;
          emoji: string | null;
          protein: number | null;
          calories: number | null;
          carbs: number | null;
          fat: number | null;
          cook_time: number | null;
          hidden: boolean;
          eaten_by: Json;
          client_updated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          household_id: string;
          day: string;
          slot_key: string;
          recipe_id?: string | null;
          recipe_name?: string | null;
          emoji?: string | null;
          protein?: number | null;
          calories?: number | null;
          carbs?: number | null;
          fat?: number | null;
          cook_time?: number | null;
          hidden?: boolean;
          eaten_by?: Json;
          client_updated_at?: string;
        };
        Update: {
          recipe_id?: string | null;
          recipe_name?: string | null;
          emoji?: string | null;
          protein?: number | null;
          calories?: number | null;
          carbs?: number | null;
          fat?: number | null;
          cook_time?: number | null;
          hidden?: boolean;
          eaten_by?: Json;
          client_updated_at?: string;
        };
        Relationships: [];
      };
      shopping_items: {
        Row: {
          id: string;
          household_id: string;
          week_start: string;
          name: string;
          amount: string | null;
          category: string | null;
          checked: boolean;
          metadata: Json;
          client_updated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          week_start: string;
          name: string;
          amount?: string | null;
          category?: string | null;
          checked?: boolean;
          metadata?: Json;
          client_updated_at?: string;
        };
        Update: {
          name?: string;
          amount?: string | null;
          category?: string | null;
          checked?: boolean;
          metadata?: Json;
          client_updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_household: {
        Args: {
          p_name: string;
          p_country?: string | null;
          p_currency?: string | null;
          p_timezone?: string | null;
        };
        Returns: string;
      };
      create_household_invite: {
        Args: {
          p_household_id: string;
          p_role?: HouseholdRole;
          p_email?: string | null;
          p_ttl_hours?: number;
        };
        Returns: { invite_id: string; token: string; expires_at: string }[];
      };
      peek_household_invite: {
        Args: { p_token: string };
        Returns: { household_name: string; role: HouseholdRole; expires_at: string }[];
      };
      accept_household_invite: {
        Args: { p_token: string };
        Returns: string;
      };
      revoke_household_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      leave_household: {
        Args: { p_household_id: string };
        Returns: undefined;
      };
      get_or_create_meal_plan: {
        Args: { p_household_id: string; p_week_start: string };
        Returns: string;
      };
      ensure_household_nutrition_goals: {
        Args: { p_household_id: string };
        Returns: string;
      };
      is_catalog_editor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      claim_catalog_editor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      review_catalog_image: {
        Args: { p_recipe_id: string; p_action: string; p_image_url?: string | null };
        Returns: undefined;
      };
    };
    Enums: {
      household_role: HouseholdRole;
      person_type: PersonType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
