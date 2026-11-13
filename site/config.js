// ------------------------------------------------------------------
// Fill these in after creating your Supabase project (see README.md).
// The anon key is meant to be public. Row Level Security (set up by
// supabase-setup.sql) is what keeps strangers from editing your gallery.
// NEVER put the "service_role" key in this file.
// ------------------------------------------------------------------
window.APP_CONFIG = {
  SUPABASE_URL: "https://ohnatcfqcqusnvbmwbjy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obmF0Y2ZxY3F1c252Ym13Ymp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODQ0NTEsImV4cCI6MjEwNzQ2MDQ1MX0.bSHjEqoYB5mE9htOmagsoooN8A44-U3c81fhSAnKJN4",
  BUCKET: "photos",

  // The day you two started. The counter and the month numbers count from here.
  START_DATE: "2026-02-14",

  // Text shown on the gallery page. {months} becomes how many months you've been together.
  TITLE: "Kiligram",
  SUBTITLE: "Month {months} with you",
  CLOSING_MESSAGE: "Happy monthsary, langga. Here's to many more months, and a lot more photos.",

  // ---- DRAFTS: edit these so they sound like you --------------------
  // Tap-to-flip cards. Add, remove or reorder freely.
  REASONS: [
    "You laugh at my jokes, bahalag wala naka kasabot",
    "You make ordinary days feel like dates.",
    "You are so good towards me, it feels like a damgo",
    "You're patient with me, even when I'm being samok hehe.",
    "Your hugs fix my bad days, your kisses makes me kilig hehe",
    "You're beautiful and cute kaayu hehehe",
    "You make me want to be better, someday, I'll buy you everything",
    "You chose me, and you keep choosing me."
  ],

  // The letter at the end of the page. {months} works here too.
  LETTER: {
    greeting: "Dear Langga,",
    paragraphs: [
      "{months} months. Some days it feels like our first date was yesterday, and some days it feels like I've known you forever.",
      "Thank you for every photo on this page, and for all the moments we never got to take a picture of. The food trips, the late-night Roblox, the silly faces, and the quiet days too.",
      "I might not have everything, but everything I have, I'll give to you. That's a promise. Bahalag unsa paka ka maldita nako",
      "Here's to more months, more photos, and more us."
    ],
    signoff: "Palangga kaayo ka nako, langg",
    signature: "John 'The Big D'"
  }
};
