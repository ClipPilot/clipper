"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom, userTeamsAtom } from "@/store/auth";
import { teamAPI, InviteDetails } from "@/api/team";
import Image from "next/image";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import CuttrLogo from "@/public/branding/cuttr_logo.png";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [user] = useAtom(userAtom);
  const [, setUserTeams] = useAtom(userTeamsAtom);

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const inviteData = await teamAPI.getInviteByToken(token);
        setInvite(inviteData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Invalid or expired invite"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!user) {
      localStorage.setItem("pendingInviteToken", token);
      router.push("/auth");
      return;
    }

    setIsAccepting(true);
    setError("");

    try {
      await teamAPI.acceptInvite(token);
      setSuccess(true);
      const teams = await teamAPI.getUserTeams();
      setUserTeams(teams);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignIn = () => {
    localStorage.setItem("pendingInviteToken", token);
    router.push("/auth");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
          <p className="text-text-secondary">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-dark p-4">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-status-error/20 flex items-center justify-center">
            <Icon
              icon="solar:close-circle-bold"
              width={40}
              className="text-status-error"
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-accent mb-2">
              Invalid Invite
            </h1>
            <p className="text-text-secondary">{error}</p>
          </div>
          <Button variant="primary"
 className="bg-accent-400"
 onPress={() => router.push("/auth")}
 >
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-dark p-4">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center">
            <Icon
              icon="solar:check-circle-bold"
              width={40}
              className="text-status-success"
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-accent mb-2">
              Welcome to {invite?.team.name}!
            </h1>
            <p className="text-text-secondary">
              You've successfully joined the workspace. Redirecting to
              dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface-dark p-4">
      <div className="flex flex-col items-center gap-8 max-w-md w-full">
        <Image
          src={CuttrLogo}
          alt="Cuttr"
          width={120}
          height={34}
          className="object-contain"
          unoptimized
        />

        <div className="w-full bg-surface-base border border-border-base rounded-2xl p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-14 h-14 rounded-full bg-accent-400/20 flex items-center justify-center">
              <Icon
                icon="solar:users-group-rounded-bold-duotone"
                width={32}
                className="text-accent-400"
              />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-text-accent mb-2">
                You're invited to join
              </h1>
              <p className="text-xl font-medium text-accent-400">
                {invite?.team.name}
              </p>
            </div>

            <div className="w-full bg-surface-elevated rounded-lg p-4 border border-border-base">
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary text-sm">Invited by</span>
                <span className="text-text-accent text-sm font-medium">
                  {invite?.invitedBy.firstName} {invite?.invitedBy.lastName}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary text-sm">Your role</span>
                <span className="text-accent-400 text-sm font-medium capitalize">
                  {invite?.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">
                  Workspace plan
                </span>
                <span className="text-text-accent text-sm font-medium capitalize">
                  {invite?.team.plan}
                </span>
              </div>
            </div>

            {error && (
              <div className="w-full bg-status-error/10 border border-status-error/30 rounded-lg p-3">
                <p className="text-status-error text-sm">{error}</p>
              </div>
            )}

            {user ? (
              <div className="w-full space-y-3">
                <p className="text-text-secondary text-sm">
                  Signed in as{" "}
                  <span className="text-text-accent font-medium">
                    {user.email}
                  </span>
                </p>
                <Button variant="primary"
 className="w-full bg-accent-400"
 size="lg"
 isPending={isAccepting}
 onPress={handleAcceptInvite}
 >
                  Accept Invitation
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <p className="text-text-secondary text-sm">
                  Sign in or create an account to accept this invitation
                </p>
                <Button variant="primary"
 className="w-full bg-accent-400"
 size="lg"
 onPress={handleSignIn}
 >
                  Sign In to Accept
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-text-muted text-xs">
          By accepting, you agree to the Cuttr Terms of Service
        </p>
      </div>
    </div>
  );
}
