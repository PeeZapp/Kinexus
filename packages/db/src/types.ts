export type HouseholdRole = 'owner' | 'admin' | 'adult' | 'teen' | 'child';
export type PersonType = 'adult' | 'child' | 'other';
export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type CreatorContentKind = 'recipe';

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
          weight_unit: 'kg' | 'lb' | null;
          measurement_system: 'metric' | 'imperial' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          weight_unit?: 'kg' | 'lb' | null;
          measurement_system?: 'metric' | 'imperial' | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          weight_unit?: 'kg' | 'lb' | null;
          measurement_system?: 'metric' | 'imperial' | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_overview: {
        Row: {
          user_id: string;
          widgets: string[];
          weather_label: string | null;
          weather_latitude: number | null;
          weather_longitude: number | null;
          weather_timezone: string | null;
          news_interests: string[];
          sport_priorities: string[];
          news_topic_priorities: Record<string, string[]>;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          widgets?: string[];
          weather_label?: string | null;
          weather_latitude?: number | null;
          weather_longitude?: number | null;
          weather_timezone?: string | null;
          news_interests?: string[];
          sport_priorities?: string[];
          news_topic_priorities?: Record<string, string[]>;
          updated_at?: string;
        };
        Update: {
          widgets?: string[];
          weather_label?: string | null;
          weather_latitude?: number | null;
          weather_longitude?: number | null;
          weather_timezone?: string | null;
          news_interests?: string[];
          sport_priorities?: string[];
          news_topic_priorities?: Record<string, string[]>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_overview_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_watchlist_prefs: {
        Row: {
          user_id: string;
          provider_ids: number[];
          recommend_scope: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          provider_ids?: number[];
          recommend_scope?: string;
          updated_at?: string;
        };
        Update: {
          provider_ids?: number[];
          recommend_scope?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_watchlist_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_journal_entries: {
        Row: {
          id: string;
          user_id: string;
          day: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          body: string;
          created_at?: string;
        };
        Update: {
          day?: string;
          body?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_journal_entries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_journal_prefs: {
        Row: {
          user_id: string;
          pin_salt: string;
          pin_hash: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          pin_salt: string;
          pin_hash: string;
          updated_at?: string;
        };
        Update: {
          pin_salt?: string;
          pin_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_journal_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_google_calendar: {
        Row: {
          id: string;
          user_id: string;
          google_sub: string | null;
          google_email: string | null;
          refresh_token: string;
          access_token: string | null;
          access_expires_at: string | null;
          push_enabled: boolean;
          push_calendar_id: string | null;
          push_calendar_name: string | null;
          pull_calendar_ids: string[];
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_sub?: string | null;
          google_email?: string | null;
          refresh_token: string;
          access_token?: string | null;
          access_expires_at?: string | null;
          push_enabled?: boolean;
          push_calendar_id?: string | null;
          push_calendar_name?: string | null;
          pull_calendar_ids?: string[];
          connected_at?: string;
          updated_at?: string;
        };
        Update: {
          google_sub?: string | null;
          google_email?: string | null;
          refresh_token?: string;
          access_token?: string | null;
          access_expires_at?: string | null;
          push_enabled?: boolean;
          push_calendar_id?: string | null;
          push_calendar_name?: string | null;
          pull_calendar_ids?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_google_calendar_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_days: {
        Row: {
          user_id: string;
          day: string;
          tasks: Json;
          journal: string;
          workout_title: string;
          workout_notes: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          day: string;
          tasks?: Json;
          journal?: string;
          workout_title?: string;
          workout_notes?: string;
          updated_at?: string;
        };
        Update: {
          tasks?: Json;
          journal?: string;
          workout_title?: string;
          workout_notes?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_days_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_puzzle_days: {
        Row: {
          user_id: string;
          played_on: string;
          game: string;
          state: Json;
        };
        Insert: {
          user_id: string;
          played_on: string;
          game: string;
          state?: Json;
        };
        Update: {
          state?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'user_puzzle_days_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_wordle_days: {
        Row: {
          user_id: string;
          played_on: string;
          guesses: string[];
        };
        Insert: {
          user_id: string;
          played_on: string;
          guesses?: string[];
        };
        Update: {
          guesses?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'user_wordle_days_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: {
          id: string;
          name: string;
          country: string | null;
          currency: string | null;
          timezone: string | null;
          preferred_grocery_chain: string | null;
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
          preferred_grocery_chain?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          country?: string | null;
          currency?: string | null;
          timezone?: string | null;
          preferred_grocery_chain?: string | null;
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
      household_events: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          notes: string;
          location: string;
          all_day: boolean;
          starts_on: string;
          ends_on: string;
          start_time: string | null;
          end_time: string | null;
          color: string;
          remind_minutes: number | null;
          recurrence: string;
          until_on: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          notes?: string;
          location?: string;
          all_day?: boolean;
          starts_on: string;
          ends_on: string;
          start_time?: string | null;
          end_time?: string | null;
          color?: string;
          remind_minutes?: number | null;
          recurrence?: string;
          until_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          notes?: string;
          location?: string;
          all_day?: boolean;
          starts_on?: string;
          ends_on?: string;
          start_time?: string | null;
          end_time?: string | null;
          color?: string;
          remind_minutes?: number | null;
          recurrence?: string;
          until_on?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_events_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      household_event_people: {
        Row: {
          event_id: string;
          person_id: string;
          household_id: string;
        };
        Insert: {
          event_id: string;
          person_id: string;
          household_id: string;
        };
        Update: {
          event_id?: string;
          person_id?: string;
          household_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_event_people_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'household_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_event_people_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'household_people';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_event_people_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      household_event_google_maps: {
        Row: {
          household_event_id: string;
          user_id: string;
          connection_id: string;
          google_calendar_id: string;
          google_event_id: string;
          synced_at: string;
        };
        Insert: {
          household_event_id: string;
          user_id: string;
          connection_id: string;
          google_calendar_id: string;
          google_event_id: string;
          synced_at?: string;
        };
        Update: {
          connection_id?: string;
          google_calendar_id?: string;
          google_event_id?: string;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_event_google_maps_household_event_id_fkey';
            columns: ['household_event_id'];
            isOneToOne: false;
            referencedRelation: 'household_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_event_google_maps_user_id_fkey',
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_event_google_maps_connection_id_fkey',
            columns: ['connection_id'];
            isOneToOne: false;
            referencedRelation: 'user_google_calendar';
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
          recipe_class: string | null;
          excluded_from_auto: boolean;
          is_public: boolean;
          source_url: string | null;
          image_url: string | null;
          image_flagged: boolean;
          removed: boolean;
          sourced_from_recipe_id: string | null;
          replaces_source: boolean;
          created_by: string | null;
          creator_published_at: string | null;
          creator_source_recipe_id: string | null;
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
          recipe_class?: string | null;
          excluded_from_auto?: boolean;
          is_public?: boolean;
          source_url?: string | null;
          image_url?: string | null;
          image_flagged?: boolean;
          removed?: boolean;
          sourced_from_recipe_id?: string | null;
          replaces_source?: boolean;
          created_by?: string | null;
          creator_published_at?: string | null;
          creator_source_recipe_id?: string | null;
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
          recipe_class?: string | null;
          excluded_from_auto?: boolean;
          source_url?: string | null;
          image_url?: string | null;
          image_flagged?: boolean;
          removed?: boolean;
          sourced_from_recipe_id?: string | null;
          replaces_source?: boolean;
          created_by?: string | null;
          creator_published_at?: string | null;
          creator_source_recipe_id?: string | null;
        };
        Relationships: [];
      };
      recipe_cost_estimates: {
        Row: {
          id: string;
          recipe_id: string;
          country: string;
          currency: string;
          total_cost: number | null;
          cost_per_serve: number | null;
          servings_basis: number | null;
          stores: string[];
          breakdown: Json;
          priced_at: string | null;
          attempted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          country: string;
          currency: string;
          total_cost?: number | null;
          cost_per_serve?: number | null;
          servings_basis?: number | null;
          stores?: string[];
          breakdown?: Json;
          priced_at?: string | null;
          attempted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          total_cost?: number | null;
          cost_per_serve?: number | null;
          servings_basis?: number | null;
          stores?: string[];
          breakdown?: Json;
          priced_at?: string | null;
          attempted_at?: string;
        };
        Relationships: [];
      };
      ingredient_price_overrides: {
        Row: {
          country: string;
          currency: string;
          prices: Json;
          priced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          country: string;
          currency: string;
          prices?: Json;
          priced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          prices?: Json;
          priced_at?: string;
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
      recipe_imports: {
        Row: {
          id: string;
          input_url: string;
          canonical_url: string;
          source_kind: string | null;
          status: string;
          progress: number;
          phase_label: string;
          error_code: string | null;
          error_message: string | null;
          recipe: Json | null;
          extraction_method: string | null;
          provider: string | null;
          confidence: number | null;
          created_at: string;
          updated_at: string;
          expires_at: string;
          last_accessed_at: string;
        };
        Insert: {
          id?: string;
          input_url: string;
          canonical_url: string;
          source_kind?: string | null;
          status: string;
          progress?: number;
          phase_label?: string;
          error_code?: string | null;
          error_message?: string | null;
          recipe?: Json | null;
          extraction_method?: string | null;
          provider?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
          expires_at: string;
          last_accessed_at?: string;
        };
        Update: {
          input_url?: string;
          canonical_url?: string;
          source_kind?: string | null;
          status?: string;
          progress?: number;
          phase_label?: string;
          error_code?: string | null;
          error_message?: string | null;
          recipe?: Json | null;
          extraction_method?: string | null;
          provider?: string | null;
          confidence?: number | null;
          updated_at?: string;
          expires_at?: string;
          last_accessed_at?: string;
        };
        Relationships: [];
      };
      recipe_import_rate: {
        Row: {
          bucket: string;
          window_start: string;
          count: number;
        };
        Insert: {
          bucket: string;
          window_start: string;
          count?: number;
        };
        Update: {
          count?: number;
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
      household_hidden_recipes: {
        Row: {
          household_id: string;
          recipe_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          household_id: string;
          recipe_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          created_by?: string | null;
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
          assigned_person_id: string | null;
          audience_person_ids: string[];
          side_recipe_ids: string[];
          target_servings: number | null;
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
          assigned_person_id?: string | null;
          audience_person_ids?: string[];
          side_recipe_ids?: string[];
          target_servings?: number | null;
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
          assigned_person_id?: string | null;
          audience_person_ids?: string[];
          side_recipe_ids?: string[];
          target_servings?: number | null;
          client_updated_at?: string;
        };
        Relationships: [];
      };
      household_person_slot_recipes: {
        Row: {
          household_id: string;
          person_id: string;
          slot_key: string;
          recipe_id: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          household_id: string;
          person_id: string;
          slot_key: string;
          recipe_id: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          household_id?: string;
          person_id?: string;
          slot_key?: string;
          recipe_id?: string;
          created_by?: string | null;
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
          grocery_quote: Json | null;
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
          grocery_quote?: Json | null;
          client_updated_at?: string;
        };
        Update: {
          name?: string;
          amount?: string | null;
          category?: string | null;
          checked?: boolean;
          metadata?: Json;
          grocery_quote?: Json | null;
          client_updated_at?: string;
        };
        Relationships: [];
      };
      stash_products: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          title: string;
          current_price: number | null;
          original_price: number | null;
          is_on_sale: boolean;
          image_url: string | null;
          source_url: string;
          store_name: string | null;
          description: string | null;
          sku: string | null;
          price_source: 'manual' | 'scraped' | null;
          detail_status: 'ready' | 'pending';
          detail_attempts: number;
          detail_checked_on: string | null;
          is_owned: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          title: string;
          current_price?: number | null;
          original_price?: number | null;
          is_on_sale?: boolean;
          image_url?: string | null;
          source_url?: string;
          store_name?: string | null;
          description?: string | null;
          sku?: string | null;
          price_source?: 'manual' | 'scraped' | null;
          detail_status?: 'ready' | 'pending';
          detail_attempts?: number;
          detail_checked_on?: string | null;
          is_owned?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          current_price?: number | null;
          original_price?: number | null;
          is_on_sale?: boolean;
          image_url?: string | null;
          source_url?: string;
          store_name?: string | null;
          description?: string | null;
          sku?: string | null;
          price_source?: 'manual' | 'scraped' | null;
          detail_status?: 'ready' | 'pending';
          detail_attempts?: number;
          detail_checked_on?: string | null;
          is_owned?: boolean;
          notes?: string | null;
        };
        Relationships: [];
      };
      stash_lists: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          name: string;
          kind: 'checklist' | 'wishlist';
          visibility: 'household' | 'private' | 'people';
          parent_list_id: string | null;
          share_token: string | null;
          is_shared: boolean;
          emoji: string | null;
          theme: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          kind?: 'checklist' | 'wishlist';
          visibility?: 'household' | 'private' | 'people';
          parent_list_id?: string | null;
          share_token?: string | null;
          is_shared?: boolean;
          emoji?: string | null;
          theme?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          kind?: 'checklist' | 'wishlist';
          visibility?: 'household' | 'private' | 'people';
          parent_list_id?: string | null;
          share_token?: string | null;
          is_shared?: boolean;
          emoji?: string | null;
          theme?: string | null;
        };
        Relationships: [];
      };
      stash_list_people: {
        Row: {
          household_id: string;
          list_id: string;
          person_id: string;
          added_at: string;
        };
        Insert: {
          household_id: string;
          list_id: string;
          person_id: string;
          added_at?: string;
        };
        Update: {
          person_id?: string;
        };
        Relationships: [];
      };
      stash_list_products: {
        Row: {
          household_id: string;
          list_id: string;
          product_id: string;
          added_by: string | null;
          added_at: string;
        };
        Insert: {
          household_id: string;
          list_id: string;
          product_id: string;
          added_by?: string | null;
          added_at?: string;
        };
        Update: {
          added_by?: string | null;
        };
        Relationships: [];
      };
      stash_list_items: {
        Row: {
          id: string;
          household_id: string;
          list_id: string;
          created_by: string | null;
          title: string;
          notes: string | null;
          category: string | null;
          priority: number;
          due_on: string | null;
          recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
          assigned_person_id: string | null;
          is_checked: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          list_id: string;
          created_by?: string | null;
          title: string;
          notes?: string | null;
          category?: string | null;
          priority?: number;
          due_on?: string | null;
          recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
          assigned_person_id?: string | null;
          is_checked?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          notes?: string | null;
          category?: string | null;
          priority?: number;
          due_on?: string | null;
          recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
          assigned_person_id?: string | null;
          is_checked?: boolean;
          position?: number;
        };
        Relationships: [];
      };
      stash_link_collections: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          name: string;
          description: string | null;
          color: string | null;
          visibility: 'household' | 'private' | 'people';
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          description?: string | null;
          color?: string | null;
          visibility?: 'household' | 'private' | 'people';
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          color?: string | null;
          visibility?: 'household' | 'private' | 'people';
          position?: number;
        };
        Relationships: [];
      };
      stash_links: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          url: string;
          canonical_url: string;
          title: string;
          description: string | null;
          image_url: string | null;
          site_name: string | null;
          favicon_url: string | null;
          link_type: 'recipe' | 'video' | 'article' | 'tool' | 'place' | 'product' | 'other';
          status: 'saved' | 'try_next' | 'tried' | 'liked' | 'not_for_me' | 'archived';
          priority: number;
          tags: string[];
          notes: string | null;
          visibility: 'household' | 'private' | 'people';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          url: string;
          canonical_url: string;
          title: string;
          description?: string | null;
          image_url?: string | null;
          site_name?: string | null;
          favicon_url?: string | null;
          link_type?: 'recipe' | 'video' | 'article' | 'tool' | 'place' | 'product' | 'other';
          status?: 'saved' | 'try_next' | 'tried' | 'liked' | 'not_for_me' | 'archived';
          priority?: number;
          tags?: string[];
          notes?: string | null;
          visibility?: 'household' | 'private' | 'people';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          url?: string;
          canonical_url?: string;
          title?: string;
          description?: string | null;
          image_url?: string | null;
          site_name?: string | null;
          favicon_url?: string | null;
          link_type?: 'recipe' | 'video' | 'article' | 'tool' | 'place' | 'product' | 'other';
          status?: 'saved' | 'try_next' | 'tried' | 'liked' | 'not_for_me' | 'archived';
          priority?: number;
          tags?: string[];
          notes?: string | null;
          visibility?: 'household' | 'private' | 'people';
        };
        Relationships: [];
      };
      stash_link_people: {
        Row: {
          household_id: string;
          link_id: string;
          person_id: string;
          added_at: string;
        };
        Insert: {
          household_id: string;
          link_id: string;
          person_id: string;
          added_at?: string;
        };
        Update: {
          added_at?: string;
        };
        Relationships: [];
      };
      stash_link_collection_people: {
        Row: {
          household_id: string;
          collection_id: string;
          person_id: string;
          added_at: string;
        };
        Insert: {
          household_id: string;
          collection_id: string;
          person_id: string;
          added_at?: string;
        };
        Update: {
          added_at?: string;
        };
        Relationships: [];
      };
      watchlist_list_people: {
        Row: {
          household_id: string;
          list_id: string;
          person_id: string;
          added_at: string;
        };
        Insert: {
          household_id: string;
          list_id: string;
          person_id: string;
          added_at?: string;
        };
        Update: {
          added_at?: string;
        };
        Relationships: [];
      };
      stash_link_collection_items: {
        Row: {
          household_id: string;
          collection_id: string;
          link_id: string;
          added_at: string;
        };
        Insert: {
          household_id: string;
          collection_id: string;
          link_id: string;
          added_at?: string;
        };
        Update: {
          added_at?: string;
        };
        Relationships: [];
      };
      watchlist_lists: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          name: string;
          visibility: 'household' | 'private' | 'people' | 'global';
          kind: 'custom' | 'watched_family' | 'watched_private';
          audience: 'all' | '7+' | '13+' | '16+' | '18+';
          blurb: string | null;
          sample_poster_paths: Json;
          share_token: string | null;
          is_shared: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          visibility?: 'household' | 'private' | 'people' | 'global';
          kind?: 'custom' | 'watched_family' | 'watched_private';
          audience?: 'all' | '7+' | '13+' | '16+' | '18+';
          blurb?: string | null;
          sample_poster_paths?: Json;
          share_token?: string | null;
          is_shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          visibility?: 'household' | 'private' | 'people' | 'global';
          audience?: 'all' | '7+' | '13+' | '16+' | '18+';
          blurb?: string | null;
          sample_poster_paths?: Json;
          share_token?: string | null;
          is_shared?: boolean;
        };
        Relationships: [];
      };
      watchlist_global_list_ratings: {
        Row: {
          list_id: string;
          user_id: string;
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          list_id: string;
          user_id: string;
          score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          score?: number;
        };
        Relationships: [];
      };
      watchlist_titles: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          tmdb_id: number;
          media_type: 'movie' | 'tv';
          title: string;
          year: number | null;
          overview: string | null;
          poster_path: string | null;
          backdrop_path: string | null;
          imdb_id: string | null;
          source_url: string | null;
          tmdb_watch_url: string | null;
          trailer_url: string | null;
          content_rating: string | null;
          audience: 'all' | '7+' | '13+' | '16+' | '18+' | null;
          providers: Json;
          providers_country: string | null;
          providers_fetched_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          tmdb_id: number;
          media_type: 'movie' | 'tv';
          title: string;
          year?: number | null;
          overview?: string | null;
          poster_path?: string | null;
          backdrop_path?: string | null;
          imdb_id?: string | null;
          source_url?: string | null;
          tmdb_watch_url?: string | null;
          trailer_url?: string | null;
          content_rating?: string | null;
          audience?: 'all' | '7+' | '13+' | '16+' | '18+' | null;
          providers?: Json;
          providers_country?: string | null;
          providers_fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          year?: number | null;
          overview?: string | null;
          poster_path?: string | null;
          backdrop_path?: string | null;
          imdb_id?: string | null;
          source_url?: string | null;
          tmdb_watch_url?: string | null;
          trailer_url?: string | null;
          content_rating?: string | null;
          audience?: 'all' | '7+' | '13+' | '16+' | '18+' | null;
          providers?: Json;
          providers_country?: string | null;
          providers_fetched_at?: string | null;
        };
        Relationships: [];
      };
      watchlist_social_aliases: {
        Row: {
          user_id: string;
          alias: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          alias: string;
          created_at?: string;
        };
        Update: {
          alias?: string;
        };
        Relationships: [];
      };
      watchlist_global_reviews: {
        Row: {
          id: string;
          user_id: string;
          tmdb_id: number;
          media_type: 'movie' | 'tv';
          title: string | null;
          year: number | null;
          poster_path: string | null;
          score: number;
          body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tmdb_id: number;
          media_type: 'movie' | 'tv';
          title?: string | null;
          year?: number | null;
          poster_path?: string | null;
          score: number;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          year?: number | null;
          poster_path?: string | null;
          score?: number;
          body?: string | null;
        };
        Relationships: [];
      };
      watchlist_public_watched: {
        Row: {
          id: string;
          user_id: string;
          tmdb_id: number;
          media_type: 'movie' | 'tv';
          title: string;
          year: number | null;
          poster_path: string | null;
          score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tmdb_id: number;
          media_type: 'movie' | 'tv';
          title: string;
          year?: number | null;
          poster_path?: string | null;
          score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          year?: number | null;
          poster_path?: string | null;
          score?: number | null;
        };
        Relationships: [];
      };
      watchlist_global_review_votes: {
        Row: {
          review_id: string;
          user_id: string;
          vote: number;
          created_at: string;
        };
        Insert: {
          review_id: string;
          user_id: string;
          vote: number;
          created_at?: string;
        };
        Update: {
          vote?: number;
        };
        Relationships: [];
      };
      watchlist_items: {
        Row: {
          id: string;
          household_id: string;
          list_id: string;
          title_id: string;
          added_by: string | null;
          status: 'want' | 'watching' | 'watched';
          notes: string | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          list_id: string;
          title_id: string;
          added_by?: string | null;
          status?: 'want' | 'watching' | 'watched';
          notes?: string | null;
          added_at?: string;
        };
        Update: {
          status?: 'want' | 'watching' | 'watched';
          notes?: string | null;
        };
        Relationships: [];
      };
      watchlist_reviews: {
        Row: {
          id: string;
          household_id: string;
          title_id: string;
          person_id: string;
          score: number;
          body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title_id: string;
          person_id: string;
          score: number;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          score?: number;
          body?: string | null;
        };
        Relationships: [];
      };
      platform_staff: {
        Row: {
          user_id: string;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          invited_by?: string | null;
        };
        Relationships: [];
      };
      platform_staff_invites: {
        Row: {
          email: string;
          invited_by: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          email: string;
          invited_by: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          invited_by?: string;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      creators: {
        Row: {
          user_id: string;
          status: CreatorApplicationStatus;
          display_name: string;
          approved_at: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          verified_handle: string | null;
          verified_platform: 'instagram' | 'youtube' | 'tiktok' | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          status: CreatorApplicationStatus;
          display_name: string;
          approved_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          verified_handle?: string | null;
          verified_platform?: 'instagram' | 'youtube' | 'tiktok' | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          status?: CreatorApplicationStatus;
          display_name?: string;
          approved_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          verified_handle?: string | null;
          verified_platform?: 'instagram' | 'youtube' | 'tiktok' | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_applications: {
        Row: {
          id: string;
          user_id: string;
          status: CreatorApplicationStatus;
          display_name: string;
          bio: string;
          expertise: string;
          portfolio_url: string | null;
          instagram_url: string | null;
          youtube_url: string | null;
          tiktok_url: string | null;
          website_url: string | null;
          other_links: string | null;
          value_pitch: string | null;
          originality_attested: boolean;
          requested_username: string | null;
          requested_platform: 'instagram' | 'youtube' | 'tiktok' | null;
          contacted_via_dm: boolean;
          creator_confirmed: boolean;
          verified_by: string | null;
          verified_at: string | null;
          staff_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: CreatorApplicationStatus;
          display_name: string;
          bio: string;
          expertise: string;
          portfolio_url?: string | null;
          instagram_url?: string | null;
          youtube_url?: string | null;
          tiktok_url?: string | null;
          website_url?: string | null;
          other_links?: string | null;
          value_pitch?: string | null;
          originality_attested?: boolean;
          requested_username?: string | null;
          requested_platform?: 'instagram' | 'youtube' | 'tiktok' | null;
          contacted_via_dm?: boolean;
          creator_confirmed?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          staff_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: CreatorApplicationStatus;
          display_name?: string;
          bio?: string;
          expertise?: string;
          portfolio_url?: string | null;
          instagram_url?: string | null;
          youtube_url?: string | null;
          tiktok_url?: string | null;
          website_url?: string | null;
          other_links?: string | null;
          value_pitch?: string | null;
          originality_attested?: boolean;
          requested_username?: string | null;
          requested_platform?: 'instagram' | 'youtube' | 'tiktok' | null;
          contacted_via_dm?: boolean;
          creator_confirmed?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          staff_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reserved_usernames: {
        Row: {
          username: string;
          reason: string | null;
          application_id: string | null;
          held_for_user_id: string | null;
          platform: 'instagram' | 'youtube' | 'tiktok' | null;
          created_at: string;
        };
        Insert: {
          username: string;
          reason?: string | null;
          application_id?: string | null;
          held_for_user_id?: string | null;
          platform?: 'instagram' | 'youtube' | 'tiktok' | null;
          created_at?: string;
        };
        Update: {
          username?: string;
          reason?: string | null;
          application_id?: string | null;
          held_for_user_id?: string | null;
          platform?: 'instagram' | 'youtube' | 'tiktok' | null;
          created_at?: string;
        };
        Relationships: [];
      };
      creator_content_events: {
        Row: {
          id: string;
          kind: CreatorContentKind;
          content_id: string;
          creator_id: string;
          title: string;
          published_at: string;
        };
        Insert: {
          id?: string;
          kind: CreatorContentKind;
          content_id: string;
          creator_id: string;
          title: string;
          published_at?: string;
        };
        Update: {
          kind?: CreatorContentKind;
          content_id?: string;
          creator_id?: string;
          title?: string;
          published_at?: string;
        };
        Relationships: [];
      };
      finance_accounts: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          name: string;
          kind:
            | 'cash'
            | 'bank'
            | 'investment'
            | 'super'
            | 'property'
            | 'vehicle'
            | 'other_asset'
            | 'credit'
            | 'loan'
            | 'mortgage'
            | 'other_liability';
          institution: string | null;
          value: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          kind:
            | 'cash'
            | 'bank'
            | 'investment'
            | 'super'
            | 'property'
            | 'vehicle'
            | 'other_asset'
            | 'credit'
            | 'loan'
            | 'mortgage'
            | 'other_liability';
          institution?: string | null;
          value?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          kind?:
            | 'cash'
            | 'bank'
            | 'investment'
            | 'super'
            | 'property'
            | 'vehicle'
            | 'other_asset'
            | 'credit'
            | 'loan'
            | 'mortgage'
            | 'other_liability';
          institution?: string | null;
          value?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      finance_budgets: {
        Row: {
          id: string;
          household_id: string;
          notes: string | null;
          setup_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          notes?: string | null;
          setup_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          notes?: string | null;
          setup_completed_at?: string | null;
        };
        Relationships: [];
      };
      finance_budget_lines: {
        Row: {
          id: string;
          household_id: string;
          budget_id: string;
          kind: 'income' | 'expense';
          name: string;
          planned: number;
          spent: number;
          position: number;
          cadence: 'monthly' | 'bimonthly' | 'quarterly' | 'half_yearly' | 'yearly';
          anchor_month: number;
          parent_id: string | null;
          auto_apply: boolean;
          auto_applied_month: string | null;
          capture_surplus: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          budget_id: string;
          kind: 'income' | 'expense';
          name: string;
          planned?: number;
          spent?: number;
          position?: number;
          cadence?: 'monthly' | 'bimonthly' | 'quarterly' | 'half_yearly' | 'yearly';
          anchor_month?: number;
          parent_id?: string | null;
          auto_apply?: boolean;
          auto_applied_month?: string | null;
          capture_surplus?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          kind?: 'income' | 'expense';
          name?: string;
          planned?: number;
          spent?: number;
          position?: number;
          cadence?: 'monthly' | 'bimonthly' | 'quarterly' | 'half_yearly' | 'yearly';
          anchor_month?: number;
          parent_id?: string | null;
          auto_apply?: boolean;
          auto_applied_month?: string | null;
          capture_surplus?: boolean;
        };
        Relationships: [];
      };
      finance_budget_txns: {
        Row: {
          id: string;
          household_id: string;
          budget_id: string;
          line_id: string | null;
          txn_date: string;
          description: string;
          merchant_key: string;
          amount: number;
          ignored: boolean;
          source: 'manual' | 'import' | 'auto';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          budget_id: string;
          line_id?: string | null;
          txn_date: string;
          description: string;
          merchant_key: string;
          amount: number;
          ignored?: boolean;
          source?: 'manual' | 'import' | 'auto';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          line_id?: string | null;
          txn_date?: string;
          description?: string;
          merchant_key?: string;
          amount?: number;
          ignored?: boolean;
          source?: 'manual' | 'import' | 'auto';
        };
        Relationships: [];
      };
      finance_share_portfolios: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          name: string;
          broker: string | null;
          holder_kind: 'hin' | 'srn' | null;
          holder_id: string | null;
          postcode: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          broker?: string | null;
          holder_kind?: 'hin' | 'srn' | null;
          holder_id?: string | null;
          postcode?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          broker?: string | null;
          holder_kind?: 'hin' | 'srn' | null;
          holder_id?: string | null;
          postcode?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      finance_share_holdings: {
        Row: {
          id: string;
          household_id: string;
          portfolio_id: string;
          symbol: string;
          name: string | null;
          units: number;
          cost_per_unit: number | null;
          last_price: number | null;
          priced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          portfolio_id: string;
          symbol: string;
          name?: string | null;
          units?: number;
          cost_per_unit?: number | null;
          last_price?: number | null;
          priced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          symbol?: string;
          name?: string | null;
          units?: number;
          cost_per_unit?: number | null;
          last_price?: number | null;
          priced_at?: string | null;
        };
        Relationships: [];
      };
      finance_crypto_holdings: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          symbol: string;
          name: string | null;
          units: number;
          cost_per_unit: number | null;
          last_price: number | null;
          priced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          symbol: string;
          name?: string | null;
          units?: number;
          cost_per_unit?: number | null;
          last_price?: number | null;
          priced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          symbol?: string;
          name?: string | null;
          units?: number;
          cost_per_unit?: number | null;
          last_price?: number | null;
          priced_at?: string | null;
        };
        Relationships: [];
      };
      finance_metal_holdings: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          metal: 'gold' | 'silver' | 'platinum' | 'palladium';
          name: string | null;
          weight: number;
          unit: 'oz' | 'g' | 'kg';
          quantity: number;
          cost_per_unit: number | null;
          premium_percent: number;
          last_price: number | null;
          priced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          metal: 'gold' | 'silver' | 'platinum' | 'palladium';
          name?: string | null;
          weight?: number;
          unit?: 'oz' | 'g' | 'kg';
          quantity?: number;
          cost_per_unit?: number | null;
          premium_percent?: number;
          last_price?: number | null;
          priced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          metal?: 'gold' | 'silver' | 'platinum' | 'palladium';
          name?: string | null;
          weight?: number;
          unit?: 'oz' | 'g' | 'kg';
          quantity?: number;
          cost_per_unit?: number | null;
          premium_percent?: number;
          last_price?: number | null;
          priced_at?: string | null;
        };
        Relationships: [];
      };
      finance_collectibles: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          name: string;
          kind:
            | 'lego'
            | 'minifig'
            | 'trading_card'
            | 'video_game'
            | 'comic'
            | 'funko'
            | 'coin'
            | 'vinyl'
            | 'sneaker'
            | 'watch'
            | 'other';
          condition: 'new' | 'used';
          quantity: number;
          catalog_id: string | null;
          source: 'brickeconomy' | 'brickset' | 'pricecharting' | 'discogs' | 'stockx' | 'chrono24' | 'manual';
          source_url: string | null;
          image_url: string | null;
          purchased_value: number | null;
          market_value: number;
          notes: string | null;
          valued_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          kind:
            | 'lego'
            | 'minifig'
            | 'trading_card'
            | 'video_game'
            | 'comic'
            | 'funko'
            | 'coin'
            | 'vinyl'
            | 'sneaker'
            | 'watch'
            | 'other';
          condition?: 'new' | 'used';
          quantity?: number;
          catalog_id?: string | null;
          source?: 'brickeconomy' | 'brickset' | 'pricecharting' | 'discogs' | 'stockx' | 'chrono24' | 'manual';
          source_url?: string | null;
          image_url?: string | null;
          purchased_value?: number | null;
          market_value?: number;
          notes?: string | null;
          valued_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          kind?:
            | 'lego'
            | 'minifig'
            | 'trading_card'
            | 'video_game'
            | 'comic'
            | 'funko'
            | 'coin'
            | 'vinyl'
            | 'sneaker'
            | 'watch'
            | 'other';
          condition?: 'new' | 'used';
          quantity?: number;
          catalog_id?: string | null;
          source?: 'brickeconomy' | 'brickset' | 'pricecharting' | 'discogs' | 'stockx' | 'chrono24' | 'manual';
          source_url?: string | null;
          image_url?: string | null;
          purchased_value?: number | null;
          market_value?: number;
          notes?: string | null;
          valued_at?: string | null;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          canonical_key: string;
          name: string;
          body_part: string;
          equipment: string;
          target_muscle: string;
          secondary_muscles: string[];
          instructions: string[];
          media_url: string | null;
          media_urls: string[];
          media_kind: 'gif' | 'image' | null;
          source: 'exercisedb' | 'public_domain' | 'wger' | 'user' | 'creator';
          license: string;
          license_author: string | null;
          scope: 'global' | 'household' | 'group' | 'private';
          owner_id: string | null;
          household_id: string | null;
          group_id: string | null;
          status: 'active' | 'hidden';
          category: string | null;
          difficulty: string | null;
          is_compound: boolean | null;
          merged_into: string | null;
          aliases: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          canonical_key?: string;
          name: string;
          body_part?: string;
          equipment?: string;
          target_muscle?: string;
          secondary_muscles?: string[];
          instructions?: string[];
          media_url?: string | null;
          media_urls?: string[];
          media_kind?: 'gif' | 'image' | null;
          source: 'exercisedb' | 'public_domain' | 'wger' | 'user' | 'creator';
          license: string;
          license_author?: string | null;
          scope?: 'global' | 'household' | 'group' | 'private';
          owner_id?: string | null;
          household_id?: string | null;
          group_id?: string | null;
          status?: 'active' | 'hidden';
          category?: string | null;
          difficulty?: string | null;
          is_compound?: boolean | null;
          merged_into?: string | null;
          aliases?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          body_part?: string;
          equipment?: string;
          target_muscle?: string;
          secondary_muscles?: string[];
          instructions?: string[];
          media_url?: string | null;
          media_urls?: string[];
          media_kind?: 'gif' | 'image' | null;
          scope?: 'global' | 'household' | 'group' | 'private';
          owner_id?: string | null;
          household_id?: string | null;
          group_id?: string | null;
          status?: 'active' | 'hidden';
          category?: string | null;
          difficulty?: string | null;
          is_compound?: boolean | null;
          source?: 'exercisedb' | 'public_domain' | 'wger' | 'user' | 'creator';
          merged_into?: string | null;
          aliases?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercises_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_groups: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      exercise_group_members: {
        Row: {
          group_id: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      workouts: {
        Row: {
          id: string;
          household_id: string;
          created_by: string | null;
          name: string;
          visibility: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          split_id: string | null;
          duration_min: number | null;
          share_token: string | null;
          is_shared: boolean;
          plan_only: boolean;
          level: 'beginner' | 'intermediate' | 'advanced' | null;
          goal: 'strength' | 'hypertrophy' | 'conditioning' | 'mobility' | 'fat_loss' | null;
          equipment: string[];
          source_workout_id: string | null;
          source_creator_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          visibility?: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          split_id?: string | null;
          duration_min?: number | null;
          share_token?: string | null;
          is_shared?: boolean;
          plan_only?: boolean;
          level?: 'beginner' | 'intermediate' | 'advanced' | null;
          goal?: 'strength' | 'hypertrophy' | 'conditioning' | 'mobility' | 'fat_loss' | null;
          equipment?: string[];
          source_workout_id?: string | null;
          source_creator_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          visibility?: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          split_id?: string | null;
          duration_min?: number | null;
          share_token?: string | null;
          is_shared?: boolean;
          plan_only?: boolean;
          level?: 'beginner' | 'intermediate' | 'advanced' | null;
          goal?: 'strength' | 'hypertrophy' | 'conditioning' | 'mobility' | 'fat_loss' | null;
          equipment?: string[];
          source_workout_id?: string | null;
          source_creator_id?: string | null;
        };
        Relationships: [];
      };
      workout_exercises: {
        Row: {
          id: string;
          workout_id: string;
          household_id: string;
          exercise_id: string | null;
          name: string;
          position: number;
          target_sets: number;
          target_reps: string;
          superset_id: string | null;
          target_weight: number | null;
          target_effort: 'light' | 'moderate' | 'heavy' | 'max' | null;
          target_rpe: number | null;
          note: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          household_id: string;
          exercise_id?: string | null;
          name: string;
          position: number;
          target_sets?: number;
          target_reps?: string;
          superset_id?: string | null;
          target_weight?: number | null;
          target_effort?: 'light' | 'moderate' | 'heavy' | 'max' | null;
          target_rpe?: number | null;
          note?: string;
        };
        Update: {
          name?: string;
          exercise_id?: string | null;
          position?: number;
          target_sets?: number;
          target_reps?: string;
          superset_id?: string | null;
          target_weight?: number | null;
          target_effort?: 'light' | 'moderate' | 'heavy' | 'max' | null;
          target_rpe?: number | null;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_people: {
        Row: {
          workout_id: string;
          person_id: string;
          household_id: string;
        };
        Insert: {
          workout_id: string;
          person_id: string;
          household_id: string;
        };
        Update: {
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_people_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_ratings: {
        Row: {
          workout_id: string;
          user_id: string;
          household_id: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          workout_id: string;
          user_id: string;
          household_id: string;
          score: number;
          updated_at?: string;
        };
        Update: {
          score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_ratings_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_user_notes: {
        Row: {
          workout_id: string;
          user_id: string;
          household_id: string;
          exercise_position: number;
          body: string;
          updated_at: string;
        };
        Insert: {
          workout_id: string;
          user_id: string;
          household_id: string;
          exercise_position?: number;
          body?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          exercise_position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_user_notes_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_sessions: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          workout_id: string | null;
          name: string;
          remix_spec: string | null;
          duration_min: number | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          workout_id?: string | null;
          name: string;
          remix_spec?: string | null;
          duration_min?: number | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          name?: string;
          workout_id?: string | null;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      workout_sets: {
        Row: {
          id: string;
          session_id: string;
          household_id: string;
          user_id: string;
          exercise_id: string | null;
          exercise_name: string;
          position: number;
          set_index: number;
          weight: string;
          reps: string;
          done: boolean;
        };
        Insert: {
          id?: string;
          session_id: string;
          household_id: string;
          user_id: string;
          exercise_id?: string | null;
          exercise_name: string;
          position: number;
          set_index: number;
          weight?: string;
          reps?: string;
          done?: boolean;
        };
        Update: {
          weight?: string;
          reps?: string;
          done?: boolean;
          exercise_id?: string | null;
          exercise_name?: string;
        };
        Relationships: [];
      };
      exercise_records: {
        Row: {
          user_id: string;
          exercise_id: string;
          last_weight: string;
          last_reps: string;
          best_weight: string;
          best_reps: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          exercise_id: string;
          last_weight?: string;
          last_reps?: string;
          best_weight?: string;
          best_reps?: string;
          updated_at?: string;
        };
        Update: {
          last_weight?: string;
          last_reps?: string;
          best_weight?: string;
          best_reps?: string;
        };
        Relationships: [];
      };
      rest_game_scores: {
        Row: {
          user_id: string;
          game: string;
          rest_seconds: number;
          best_score: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          game: string;
          rest_seconds: number;
          best_score: number;
          updated_at?: string;
        };
        Update: {
          best_score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_train_prefs: {
        Row: {
          user_id: string;
          rest_extra: 'off' | 'quiz' | 'memory';
          default_workout_visibility:
            | 'private'
            | 'household'
            | 'people'
            | 'buddies'
            | 'buddies_selected'
            | 'global';
          family_plan_share: 'off' | 'plan' | 'plan_activity';
          generate_prefs: Record<string, unknown>;
        };
        Insert: {
          user_id: string;
          rest_extra?: 'off' | 'quiz' | 'memory';
          default_workout_visibility?:
            | 'private'
            | 'household'
            | 'people'
            | 'buddies'
            | 'buddies_selected'
            | 'global';
          family_plan_share?: 'off' | 'plan' | 'plan_activity';
          generate_prefs?: Record<string, unknown>;
        };
        Update: {
          rest_extra?: 'off' | 'quiz' | 'memory';
          default_workout_visibility?:
            | 'private'
            | 'household'
            | 'people'
            | 'buddies'
            | 'buddies_selected'
            | 'global';
          family_plan_share?: 'off' | 'plan' | 'plan_activity';
          generate_prefs?: Record<string, unknown>;
        };
        Relationships: [];
      };
      training_plans: {
        Row: {
          id: string;
          household_id: string;
          owner_id: string;
          name: string;
          week_start: string;
          visibility: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          audience_person_ids: string[];
          prefs: Record<string, unknown>;
          calendar_auto_sync: boolean;
          share_token: string | null;
          is_shared: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          owner_id: string;
          name?: string;
          week_start: string;
          visibility?: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          audience_person_ids?: string[];
          prefs?: Record<string, unknown>;
          calendar_auto_sync?: boolean;
          share_token?: string | null;
          is_shared?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          week_start?: string;
          visibility?: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          audience_person_ids?: string[];
          prefs?: Record<string, unknown>;
          calendar_auto_sync?: boolean;
          share_token?: string | null;
          is_shared?: boolean;
        };
        Relationships: [];
      };
      training_plan_day_events: {
        Row: {
          training_plan_day_id: string;
          household_event_id: string;
          created_at: string;
        };
        Insert: {
          training_plan_day_id: string;
          household_event_id: string;
          created_at?: string;
        };
        Update: {
          household_event_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'training_plan_day_events_training_plan_day_id_fkey';
            columns: ['training_plan_day_id'];
            isOneToOne: true;
            referencedRelation: 'training_plan_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'training_plan_day_events_household_event_id_fkey';
            columns: ['household_event_id'];
            isOneToOne: true;
            referencedRelation: 'household_events';
            referencedColumns: ['id'];
          },
        ];
      };
      training_plan_days: {
        Row: {
          id: string;
          plan_id: string;
          day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
          position: number;
          workout_id: string | null;
          generated_spec: Record<string, unknown> | null;
          rest_day: boolean;
          scheduled_time: string | null;
          duration_min: number | null;
          focus: string[];
          status: 'planned' | 'done' | 'skipped';
          session_id: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
          position?: number;
          workout_id?: string | null;
          generated_spec?: Record<string, unknown> | null;
          rest_day?: boolean;
          scheduled_time?: string | null;
          duration_min?: number | null;
          focus?: string[];
          status?: 'planned' | 'done' | 'skipped';
          session_id?: string | null;
        };
        Update: {
          day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
          position?: number;
          workout_id?: string | null;
          generated_spec?: Record<string, unknown> | null;
          rest_day?: boolean;
          scheduled_time?: string | null;
          duration_min?: number | null;
          focus?: string[];
          status?: 'planned' | 'done' | 'skipped';
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'training_plan_days_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'training_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      training_plan_buddy_shares: {
        Row: {
          plan_id: string;
          buddy_user_id: string;
          household_id: string;
        };
        Insert: {
          plan_id: string;
          buddy_user_id: string;
          household_id: string;
        };
        Update: {
          buddy_user_id?: string;
          household_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'training_plan_buddy_shares_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'training_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_buddy_shares: {
        Row: {
          workout_id: string;
          buddy_user_id: string;
          household_id: string;
        };
        Insert: {
          workout_id: string;
          buddy_user_id: string;
          household_id: string;
        };
        Update: {
          buddy_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_buddy_shares_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      train_plans: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          name: string;
          visibility: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          level: 'beginner' | 'intermediate' | 'advanced' | null;
          goal: 'strength' | 'hypertrophy' | 'conditioning' | 'mobility' | 'fat_loss' | null;
          equipment: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          name?: string;
          visibility?: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          level?: 'beginner' | 'intermediate' | 'advanced' | null;
          goal?: 'strength' | 'hypertrophy' | 'conditioning' | 'mobility' | 'fat_loss' | null;
          equipment?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          visibility?: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
          level?: 'beginner' | 'intermediate' | 'advanced' | null;
          goal?: 'strength' | 'hypertrophy' | 'conditioning' | 'mobility' | 'fat_loss' | null;
          equipment?: string[];
        };
        Relationships: [];
      };
      train_plan_days: {
        Row: {
          plan_id: string;
          weekday: number;
          position: number;
          workout_id: string | null;
          label: string;
        };
        Insert: {
          plan_id: string;
          weekday: number;
          position?: number;
          workout_id?: string | null;
          label?: string;
        };
        Update: {
          weekday?: number;
          position?: number;
          workout_id?: string | null;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_plan_days_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'train_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      train_plan_people: {
        Row: {
          plan_id: string;
          person_id: string;
          household_id: string;
        };
        Insert: {
          plan_id: string;
          person_id: string;
          household_id: string;
        };
        Update: {
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_plan_people_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'train_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      train_plan_buddy_shares: {
        Row: {
          plan_id: string;
          buddy_user_id: string;
          household_id: string;
        };
        Insert: {
          plan_id: string;
          buddy_user_id: string;
          household_id: string;
        };
        Update: {
          buddy_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_plan_buddy_shares_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'train_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      train_buddies: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          requester_id?: string;
          addressee_id?: string;
          status?: 'pending' | 'accepted' | 'blocked';
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_buddies_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'train_buddies_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      train_buddy_permissions: {
        Row: {
          owner_id: string;
          buddy_id: string;
          can_view_plan: boolean;
          can_view_workouts: boolean;
          can_copy_workouts: boolean;
          can_view_sessions: boolean;
          can_view_prs: boolean;
          can_coedit_shared: boolean;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          buddy_id: string;
          can_view_plan?: boolean;
          can_view_workouts?: boolean;
          can_copy_workouts?: boolean;
          can_view_sessions?: boolean;
          can_view_prs?: boolean;
          can_coedit_shared?: boolean;
          updated_at?: string;
        };
        Update: {
          can_view_plan?: boolean;
          can_view_workouts?: boolean;
          can_copy_workouts?: boolean;
          can_view_sessions?: boolean;
          can_view_prs?: boolean;
          can_coedit_shared?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_buddy_permissions_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'train_buddy_permissions_buddy_id_fkey';
            columns: ['buddy_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      train_buddy_invites: {
        Row: {
          id: string;
          token_hash: string;
          created_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token_hash: string;
          created_by: string;
          expires_at: string;
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
            foreignKeyName: 'train_buddy_invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      train_together_invites: {
        Row: {
          id: string;
          workout_id: string;
          inviter_id: string;
          invitee_id: string;
          household_id: string;
          scheduled_at: string | null;
          status: 'pending' | 'accepted' | 'declined' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          inviter_id: string;
          invitee_id: string;
          household_id: string;
          scheduled_at?: string | null;
          status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scheduled_at?: string | null;
          status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_together_invites_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      train_buddy_events: {
        Row: {
          id: string;
          actor_id: string;
          event_type: 'completed_workout' | 'new_pr' | 'shared_workout';
          workout_id: string | null;
          session_id: string | null;
          exercise_id: string | null;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          event_type: 'completed_workout' | 'new_pr' | 'shared_workout';
          workout_id?: string | null;
          session_id?: string | null;
          exercise_id?: string | null;
          title?: string;
          created_at?: string;
        };
        Update: {
          title?: string;
        };
        Relationships: [];
      };
      train_buddy_event_high_fives: {
        Row: {
          event_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_buddy_event_high_fives_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'train_buddy_events';
            referencedColumns: ['id'];
          },
        ];
      };
      train_global_workout_ratings: {
        Row: {
          workout_id: string;
          user_id: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          workout_id: string;
          user_id: string;
          score: number;
          updated_at?: string;
        };
        Update: {
          score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'train_global_workout_ratings_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_training_plan: {
        Args: {
          p_household_id: string;
          p_week_start: string;
          p_name?: string;
          p_visibility?: string;
          p_audience_person_ids?: string[];
          p_prefs?: Record<string, unknown>;
        };
        Returns: string;
      };
      create_private_workout: {
        Args: {
          p_household_id: string;
          p_name?: string;
          p_duration_min?: number | null;
        };
        Returns: string;
      };
      save_workout_to_library: {
        Args: {
          p_workout_id: string;
        };
        Returns: undefined;
      };
      start_workout_session: {
        Args: {
          p_household_id: string;
          p_name?: string;
          p_workout_id?: string | null;
          p_remix_spec?: string | null;
          p_duration_min?: number | null;
          p_sets?: unknown;
        };
        Returns: string;
      };
      abandon_workout_session: {
        Args: {
          p_session_id: string;
        };
        Returns: undefined;
      };
      append_workout_set: {
        Args: {
          p_session_id: string;
          p_sets?: unknown;
        };
        Returns: undefined;
      };
      update_workout_set: {
        Args: {
          p_set_id: string;
          p_weight?: string | null;
          p_reps?: string | null;
          p_done?: boolean | null;
        };
        Returns: undefined;
      };
      delete_workout_set: {
        Args: {
          p_set_id: string;
        };
        Returns: undefined;
      };
      delete_workout_sets_at_position: {
        Args: {
          p_session_id: string;
          p_position: number;
        };
        Returns: undefined;
      };
      move_session_exercise: {
        Args: {
          p_session_id: string;
          p_position: number;
          p_direction: number;
        };
        Returns: undefined;
      };
      replace_session_exercise: {
        Args: {
          p_session_id: string;
          p_position: number;
          p_exercise_id: string;
          p_name: string;
          p_weight?: string;
        };
        Returns: undefined;
      };
      rewrite_session_sets: {
        Args: {
          p_session_id: string;
          p_sets?: unknown;
        };
        Returns: undefined;
      };
      link_workout_session: {
        Args: {
          p_session_id: string;
          p_workout_id: string;
          p_name?: string;
        };
        Returns: undefined;
      };
      finish_workout_session: {
        Args: {
          p_session_id: string;
        };
        Returns: undefined;
      };
      create_household: {
        Args: {
          p_name: string;
          p_country?: string | null;
          p_currency?: string | null;
          p_timezone?: string | null;
        };
        Returns: string;
      };
      set_preferred_grocery_chain: {
        Args: {
          p_household_id: string;
          p_chain: string | null;
        };
        Returns: undefined;
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
      delete_household: {
        Args: { p_household_id: string };
        Returns: undefined;
      };
      delete_own_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      set_household_member_role: {
        Args: { p_household_id: string; p_user_id: string; p_role: HouseholdRole };
        Returns: undefined;
      };
      remove_household_member: {
        Args: { p_household_id: string; p_user_id: string };
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
      ensure_finance_budget: {
        Args: { p_household_id: string };
        Returns: string;
      };
      can_view_watchlist_list: {
        Args: { _list_id: string };
        Returns: boolean;
      };
      can_manage_watchlist_list: {
        Args: { _list_id: string };
        Returns: boolean;
      };
      can_view_watchlist_title: {
        Args: { _title_id: string };
        Returns: boolean;
      };
      watchlist_global_score: {
        Args: { _tmdb_id: number; _media_type: string };
        Returns: number | null;
      };
      watchlist_global_list_score: {
        Args: { _list_id: string };
        Returns: number | null;
      };
      is_catalog_editor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      claim_catalog_editor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      ensure_catalog_owner_access: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      review_catalog_image: {
        Args: { p_recipe_id: string; p_action: string; p_image_url?: string | null };
        Returns: undefined;
      };
      review_catalog_recipe: {
        Args: { p_recipe_id: string; p_action: string };
        Returns: undefined;
      };
      is_platform_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      claim_platform_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      invite_platform_staff: {
        Args: { p_email: string };
        Returns: undefined;
      };
      revoke_platform_staff: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      is_approved_creator: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      submit_creator_application: {
        Args: {
          p_display_name: string;
          p_bio: string;
          p_expertise: string;
          p_portfolio_url?: string | null;
          p_instagram_url?: string | null;
          p_youtube_url?: string | null;
          p_tiktok_url?: string | null;
          p_website_url?: string | null;
          p_other_links?: string | null;
          p_value_pitch?: string | null;
          p_originality_attested: boolean;
          p_requested_username: string;
          p_requested_platform: string;
        };
        Returns: string;
      };
      review_creator_application: {
        Args: {
          p_application_id: string;
          p_action: string;
          p_staff_notes?: string | null;
          p_contacted_via_dm?: boolean;
          p_creator_confirmed?: boolean;
        };
        Returns: undefined;
      };
      revoke_creator: {
        Args: { p_user_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      publish_creator_recipe: {
        Args: { p_source_recipe_id: string };
        Returns: string;
      };
      unpublish_creator_recipe: {
        Args: { p_recipe_id: string };
        Returns: undefined;
      };
      publish_global_exercise: {
        Args: { p_source_exercise_id: string };
        Returns: string;
      };
      archive_exercise: {
        Args: { p_exercise_id: string };
        Returns: string;
      };
      is_exercise_group_member: {
        Args: { _group_id: string };
        Returns: boolean;
      };
      can_edit_exercise_group: {
        Args: { _group_id: string };
        Returns: boolean;
      };
      exercise_referenced_by_me: {
        Args: { _exercise_id: string };
        Returns: boolean;
      };
      rest_game_tops: {
        Args: Record<string, never>;
        Returns: {
          game: string;
          rest_seconds: number;
          best_score: number;
        }[];
      };
      are_train_buddies: {
        Args: { _user_a: string; _user_b: string };
        Returns: boolean;
      };
      buddy_can: {
        Args: { _owner: string; _viewer: string; _permission: string };
        Returns: boolean;
      };
      can_view_workout: {
        Args: { _workout_id: string };
        Returns: boolean;
      };
      can_edit_workout: {
        Args: { _workout_id: string };
        Returns: boolean;
      };
      can_view_train_plan: {
        Args: { _plan_id: string };
        Returns: boolean;
      };
      can_edit_train_plan: {
        Args: { _plan_id: string };
        Returns: boolean;
      };
      can_view_session: {
        Args: { _session_id: string };
        Returns: boolean;
      };
      can_view_exercise_records: {
        Args: { _owner: string };
        Returns: boolean;
      };
      family_train_overview: {
        Args: { _household_id: string };
        Returns: {
          user_id: string;
          display_name: string;
          family_plan_share: string;
          plan_id: string | null;
          plan_name: string | null;
          today_workout_id: string | null;
          today_workout_name: string | null;
          recent_completions: Json;
        }[];
      };
      request_train_buddy_by_username: {
        Args: { p_username: string };
        Returns: string;
      };
      respond_train_buddy_request: {
        Args: { p_connection_id: string; p_accept: boolean };
        Returns: undefined;
      };
      remove_train_buddy: {
        Args: { p_other_user_id: string };
        Returns: undefined;
      };
      block_train_buddy: {
        Args: { p_other_user_id: string };
        Returns: undefined;
      };
      create_train_buddy_invite: {
        Args: { p_ttl_hours?: number };
        Returns: { invite_id: string; token: string; expires_at: string }[];
      };
      peek_train_buddy_invite: {
        Args: { p_token: string };
        Returns: {
          inviter_id: string;
          inviter_username: string | null;
          inviter_global_handle: string;
          expires_at: string;
        }[];
      };
      accept_train_buddy_invite: {
        Args: { p_token: string };
        Returns: string;
      };
      revoke_train_buddy_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      invite_train_together: {
        Args: { p_workout_id: string; p_invitee_ids: string[]; p_scheduled_at?: string | null };
        Returns: string[];
      };
      respond_train_together: {
        Args: { p_invite_id: string; p_accept: boolean };
        Returns: undefined;
      };
      cancel_train_together: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      high_five_train_buddy_event: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      can_view_train_buddy_event: {
        Args: { _event_id: string };
        Returns: boolean;
      };
      can_view_train_together_invite: {
        Args: { _invite_id: string };
        Returns: boolean;
      };
      train_global_workout_score: {
        Args: { _workout_id: string };
        Returns: number;
      };
      staff_creator_content_digest: {
        Args: { p_day?: string };
        Returns: {
          event_id: string;
          kind: CreatorContentKind;
          content_id: string;
          creator_id: string;
          creator_display_name: string;
          title: string;
          published_at: string;
        }[];
      };
    };
    Enums: {
      household_role: HouseholdRole;
      person_type: PersonType;
      creator_application_status: CreatorApplicationStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
