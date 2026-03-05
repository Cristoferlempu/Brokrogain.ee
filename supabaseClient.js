/*
  Supabase client bootstrap for static hosting (GitHub Pages).
  Replace placeholders below with your own Supabase project values.
*/
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

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
    title text not null,
    date date,
    location text,
    description text
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

  Demo-only RLS policy guidance (configure in Supabase dashboard):
  1) Enable RLS for all four tables.
  2) Add policy for public read and write:
     - USING (true)
     - WITH CHECK (true)

  IMPORTANT: Public write is only for demo/testing.
  In production, restrict INSERT/UPDATE/DELETE with auth-based policies.
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
})();
