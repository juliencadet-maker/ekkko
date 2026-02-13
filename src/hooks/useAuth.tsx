import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, OrgMembership, Org, Policy, UserContext } from "@/types/database";

export function useAuth(): UserContext & {
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<OrgMembership | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      setProfile(profileData as Profile | null);

      // Fetch org membership
      const { data: membershipData } = await supabase
        .from("org_memberships")
        .select("*, orgs(*)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (membershipData) {
        setMembership(membershipData as unknown as OrgMembership);
        setOrg((membershipData as any).orgs as Org);

        // Fetch org policy
        const { data: policyData } = await supabase
          .from("policies")
          .select("*")
          .eq("org_id", membershipData.org_id)
          .maybeSingle();

        setPolicy(policyData as Policy | null);
      } else {
        setMembership(null);
        setOrg(null);
        setPolicy(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout, keep loading until data is fetched
          setTimeout(async () => {
            await fetchUserData(session.user.id);
            setIsLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setMembership(null);
          setOrg(null);
          setPolicy(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setMembership(null);
    setOrg(null);
    setPolicy(null);
  }, []);

  const isAuthenticated = !!user && !!session;
  const needsOnboarding = isAuthenticated && profile && !profile.onboarding_completed;

  return {
    user: user ? { id: user.id, email: user.email || "" } : { id: "", email: "" },
    profile,
    membership,
    org,
    policy,
    isLoading,
    isAuthenticated,
    needsOnboarding: needsOnboarding || false,
    signOut,
    refreshUser,
  };
}
