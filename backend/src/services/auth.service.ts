import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "../config/env";
import { users } from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

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
    const { data: authData, error: authError } =
      await this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth`,
        },
      });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Failed to create user");
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

    return {
      user: authData.user,
      session: null, // Don't return session until email is confirmed
      dbUser: user,
      emailConfirmationRequired: true,
    };
  }

  async signIn(email: string, password: string) {
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

    // Check if email is confirmed
    if (!data.user.email_confirmed_at) {
      throw new Error("Please confirm your email before signing in. Check your inbox for the confirmation link.");
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return {
      user: data.user,
      session: data.session,
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
      .where(eq(users.email, data.user.email!))
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
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { message: "Password reset email sent successfully" };
  }

  async updatePassword(accessToken: string, newPassword: string) {
    const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);

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

    const { data: sessionData, error: sessionError } = await this.supabase.auth.signInWithPassword({
      email: user.email!,
      password: newPassword,
    });

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email!))
      .limit(1);

    return {
      session: sessionData.session,
      user: sessionData.user,
      dbUser,
    };
  }
}

export const authService = new AuthService();
