import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://dlbwwmqfnlgtechyqfly.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsYnd3bXFmbmxndGVjaHlxZmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTU2MTMsImV4cCI6MjA2NjAzMTYxM30.STF8sDIXyXOlMVI4bUO97rD_SaT0QIcboQR621yep4E";
export const supabase = createClient(supabaseUrl, supabaseKey);
