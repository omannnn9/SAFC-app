import { supabase } from "@/integrations/supabase/client";

// Untyped client used while the auto-generated Supabase types are catching up
// with the new tables/columns from the latest migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;
