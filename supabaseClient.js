/*
  Supabase client bootstrap for static hosting (GitHub Pages).
  Replace placeholders below with your own Supabase project values.
*/
const SUPABASE_URL = 'https://nopbjnlekekvkaewljos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcGJqbmxla2VrdmthZXdsam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzA2ODYsImV4cCI6MjA4ODEwNjY4Nn0.94OgCMRkcfrbhxJx9CitfzP66fcaqqhryOUSOf8c00c';

/*
  Database schema to create in Supabase (SQL Editor):

  create extension if not exists "uuid-ossp";

  create table if not exists public.trip_diary_comments (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    name text not null,
    comment text not null
  );

  create table if not exists public.trips (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    user_id uuid references auth.users(id) on delete set null,
    participant_user_ids uuid[],
    title text not null,
    date date,
    location text,
    trip_length text,
    description text,
    image_url text
  );

  create table if not exists public.gallery_images (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    image_url text not null,
    title text,
    author_name text
  );

  create table if not exists public.blog_posts (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamptz not null default now(),
    title text not null,
    author_name text,
    excerpt text,
    content text not null
  );

  create table if not exists public.user_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('moderator','user')),
    created_at timestamptz not null default now()
  );

  create table if not exists public.user_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    email text not null,
    created_at timestamptz not null default now()
  );

  Demo-only RLS policy guidance (configure in Supabase dashboard):
  1) Enable RLS for all four tables.
  2) Add policy for public read and write:
     - USING (true)
     - WITH CHECK (true)

  IMPORTANT: Public write is only for demo/testing.
  In production, restrict INSERT/UPDATE/DELETE with auth-based policies.

  Moderator setup idea:
  - Keep SELECT/INSERT public for your content tables if you want open posting.
  - Add DELETE policy that allows only moderators:
      using (
        exists (
          select 1
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.role = 'moderator'
        )
      )
*/

(function initSupabaseClient() {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase SDK is missing. Add the CDN script before supabaseClient.js');
    return;
  }

  if (SUPABASE_URL.includes('YOUR_PROJECT_ID') || SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY_HERE')) {
    console.warn('Supabase placeholders are active. Replace SUPABASE_URL and SUPABASE_ANON_KEY in supabaseClient.js');
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let moderatorCache = null;

  window.appAuth = {
    async getCurrentUser() {
      const { data, error } = await window.supabaseClient.auth.getUser();
      if (error) return null;
      return data?.user || null;
    },
    async isModerator() {
      if (moderatorCache !== null) return moderatorCache;

      const user = await this.getCurrentUser();
      if (!user) {
        moderatorCache = false;
        return false;
      }

      const { data, error } = await window.supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        moderatorCache = false;
        return false;
      }

      moderatorCache = data?.role === 'moderator';
      return moderatorCache;
    },
    clearRoleCache() {
      moderatorCache = null;
    }
  };

  window.supabaseClient.auth.onAuthStateChange(() => {
    if (window.appAuth) window.appAuth.clearRoleCache();
  });
})();
