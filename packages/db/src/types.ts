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
          removed: boolean;
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
          removed?: boolean;
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
          removed?: boolean;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          kind?: 'checklist' | 'wishlist';
          visibility?: 'household' | 'private' | 'people';
          parent_list_id?: string | null;
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
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          color?: string | null;
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
          visibility: 'household' | 'personal';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by?: string | null;
          name: string;
          visibility?: 'household' | 'personal';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          visibility?: 'household' | 'personal';
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
          providers?: Json;
          providers_country?: string | null;
          providers_fetched_at?: string | null;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          kind?: 'income' | 'expense';
          name?: string;
          planned?: number;
          spent?: number;
          position?: number;
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
      review_catalog_recipe: {
        Args: { p_recipe_id: string; p_action: string };
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
