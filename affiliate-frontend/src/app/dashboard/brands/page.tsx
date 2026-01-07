"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { affiliateAPI, AffiliatedTeam } from "@/api/affiliate";

const statusColorMap: Record<string, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  pending: "warning",
  churned: "danger",
};

export default function BrandsPage() {
  const [teams, setTeams] = useState<AffiliatedTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const result = await affiliateAPI.getTeams();
      setTeams(result.teams);
    } catch (err) {
      console.error("Failed to load teams:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPlan = (plan: string | null) => {
    if (!plan) return "—";
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Affiliated Brands</h1>
        <p className="text-text-secondary mt-1">
          Brands that signed up using your affiliate code
        </p>
      </div>

      {teams.length === 0 ? (
        <Card className="bg-surface border border-border">
          <CardBody className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-elevated mx-auto mb-4 flex items-center justify-center">
              <Icon
                icon="solar:buildings-bold"
                className="text-3xl text-text-secondary"
              />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No Brands Yet
            </h3>
            <p className="text-text-secondary max-w-md mx-auto">
              Share your affiliate code with brands to start earning commission.
              When they sign up and subscribe, they&apos;ll appear here.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="bg-surface border border-border">
          <CardBody className="p-0">
            <Table
              aria-label="Affiliated brands table"
              classNames={{
                wrapper: "bg-transparent shadow-none",
                th: "bg-surface-elevated text-text-secondary",
                td: "text-text-primary",
              }}
            >
              <TableHeader>
                <TableColumn>BRAND</TableColumn>
                <TableColumn>PLAN</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>COMMISSION EARNED</TableColumn>
                <TableColumn>JOINED</TableColumn>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald/20 flex items-center justify-center">
                          <Icon
                            icon="solar:buildings-bold"
                            className="text-emerald"
                          />
                        </div>
                        <span className="font-medium">{team.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        variant="flat"
                        classNames={{
                          base: "bg-surface-elevated",
                          content: "text-text-primary",
                        }}
                      >
                        {formatPlan(team.plan)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={statusColorMap[team.status] || "default"}
                        variant="flat"
                      >
                        {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-emerald font-medium">
                        ${team.commissionEarned.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-text-secondary">
                        {formatDate(team.joinedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
