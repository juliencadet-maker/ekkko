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
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // If profile not found (e.g. user was deleted and recreated), sign out stale session
      if (!profileData && !profileError) {
        console.warn("No profile found for authenticated user — signing out stale session");
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setMembership(null);
        setOrg(null);
        setPolicy(null);
        setIsLoading(false);
        return;
      }

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
    } catch {
      console.error("Failed to fetch user data");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

  useEffect(() => {
    let initialLoadDone = false;

    const loadUserData = async (userId: string) => {
      await fetchUserData(userId);
      setIsLoading(false);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          initialLoadDone = true;
          loadUserData(session.user.id);
        } else {
          setProfile(null);
          setMembership(null);
          setOrg(null);
          setPolicy(null);
          setIsLoading(false);
          initialLoadDone = true;
        }
      }
    );

    // THEN check for existing session (only if onAuthStateChange hasn't fired yet)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialLoadDone) return;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    // Reset onboarding for demo accounts so next login restarts the wizard
    const demoEmails = ["demo@ekko.app", "exec@ekko.app"];
    if (user?.email && demoEmails.includes(user.email) && user?.id) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: false, onboarding_step: 0, default_identity_id: null })
        .eq("user_id", user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setMembership(null);
    setOrg(null);
    setPolicy(null);
  }, [user?.email, user?.id]);

  const isAuthenticated = !!user && !!session;
  // If authenticated but profile not yet loaded, we're still loading
  const profileLoading = isAuthenticated && !profile;
  const needsOnboarding = isAuthenticated && profile ? !profile.onboarding_completed : false;

  return {
    user: user ? { id: user.id, email: user.email || "" } : { id: "", email: "" },
    profile,
    membership,
    org,
    policy,
    isLoading: isLoading || profileLoading,
    isAuthenticated,
    needsOnboarding: needsOnboarding || false,
    signOut,
    refreshUser,
  };
}
