import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://dthorjjuocurcnmcqtqn.supabase.co";
const supabaseAnonKey = "sb_publishable_ug_JKewHnvJFSOF3ljphAg_NXDFAa5T";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);