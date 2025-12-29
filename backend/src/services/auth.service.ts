import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "../config/env";
import {
  users,
  teams,
  teamMembers,
  usageStats,
} from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { teamInviteService } from "./teamInvite.service";

class AuthService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
  }

  async signUp(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) {
    // Check if email already exists in our database
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new Error("An account with this email already exists");
    }

    const { data: authData, error: authError } =
      await this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth`,
        },
      });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    // Supabase returns empty identities array if email already exists (but unconfirmed)
    if (authData.user.identities && authData.user.identities.length === 0) {
      throw new Error("An account with this email already exists");
    }

    const [user] = await db
      .insert(users)
      .values({
        supabase_uid: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: "user",
      })
      .returning();

    // Create default personal team for the user
    const teamName = `${firstName}'s Workspace`;
    const [team] = await db
      .insert(teams)
      .values({
        name: teamName,
        type: "personal",
      })
      .returning();

    // Add user as owner of the team
    await db.insert(teamMembers).values({
      team_id: team.id,
      user_id: user.id,
      role: "owner",
    });

    // Create initial usage stats for the team
    const resetsDate = new Date();
    resetsDate.setDate(resetsDate.getDate() + 30); // Set reset date to 30 days from now

    await db.insert(usageStats).values({
      team_id: team.id,
      date: new Date(),
      clips_created: 0,
      limit: 3,
      resets_date: resetsDate,
      rollover: false,
    });

    const acceptedTeams =
      await teamInviteService.acceptAllPendingInvitesForUser(user.id, email);

    return {
      user: authData.user,
      session: null,
      dbUser: user,
      defaultTeam: team,
      emailConfirmationRequired: true,
      acceptedInvites: acceptedTeams,
    };
  }

  async signIn(email: string, password: string, rememberMe: boolean = false) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Invalid credentials");
    }

    if (!data.user.email_confirmed_at) {
      throw new Error(
        "Please confirm your email before signing in. Check your inbox for the confirmation link."
      );
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabase_uid, data.user.id))
      .limit(1);

    return {
      user: data.user,
      session: data.session,
      dbUser,
      rememberMe,
    };
  }

  async signInWithSupabase(accessToken: string, refreshToken: string) {
    // Verify Supabase token
    const { data, error } = await this.supabase.auth.getUser(accessToken);

    if (error || !data.user || !data.user.email) {
      throw new Error("Invalid Supabase token");
    }

    const supabaseUser = data.user;

    // Find user in your DB
    let [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabase_uid, supabaseUser.id))
      .limit(1);

    // If first-time Google user → create DB user
    if (!dbUser) {
      const fullName = supabaseUser.user_metadata?.full_name ?? "";
      const [firstName, ...rest] = fullName.split(" ");
      const lastName = rest.join(" ");

      if (!supabaseUser.email) {
        throw new Error("Supabase user email is required");
      }

      [dbUser] = await db
        .insert(users)
        .values({
          supabase_uid: supabaseUser.id,
          email: supabaseUser.email,
          first_name: firstName || "",
          last_name: lastName || "",
          role: "user",
        })
        .returning();

      // * optional but recommended (matches signUp)
      const teamName = `${firstName || "My"}'s Workspace`;
      const [team] = await db
        .insert(teams)
        .values({
          name: teamName,
          type: "personal",
        })
        .returning();

      await db.insert(teamMembers).values({
        team_id: team.id,
        user_id: dbUser.id,
        role: "owner",
      });

      const resetsDate = new Date();
      resetsDate.setDate(resetsDate.getDate() + 30);

      await db.insert(usageStats).values({
        team_id: team.id,
        date: new Date(),
        clips_created: 0,
        limit: 3,
        resets_date: resetsDate,
        rollover: false,
      });

      await teamInviteService.acceptAllPendingInvitesForUser(
        dbUser.id,
        supabaseUser.email
      );
    }

    // Create Supabase session for frontend
    // ! IMPORTANT: You do NOT refresh here — frontend already has tokens
    return {
      user: data.user,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
      },
      dbUser,
    };
  }

  async signOut(accessToken: string) {
    const { error } = await this.supabase.auth.admin.signOut(accessToken);

    if (error) {
      throw new Error(error.message);
    }

    return { message: "Signed out successfully" };
  }

  async getUser(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("User not found");
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabase_uid, data.user.id))
      .limit(1);

    return {
      user: data.user,
      dbUser,
    };
  }

  async refreshSession(refreshToken: string) {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      session: data.session,
      user: data.user,
    };
  }

  async verifyToken(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return null;
    }

    return data.user;
  }

  async resetPassword(email: string) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || "https://platform.cuttr.com"}/auth/callback`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { message: "Password reset email sent successfully" };
  }

  async updatePassword(accessToken: string, newPassword: string) {
    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser(accessToken);

    if (userError || !user) {
      throw new Error("Invalid or expired token");
    }

    const { data, error } = await this.supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (error) {
      throw new Error(error.message);
    }

    const { data: sessionData, error: sessionError } =
      await this.supabase.auth.signInWithPassword({
        email: user.email!,
        password: newPassword,
      });

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabase_uid, user.id))
      .limit(1);

    return {
      session: sessionData.session,
      user: sessionData.user,
      dbUser,
    };
  }
}

export const authService = new AuthService();
