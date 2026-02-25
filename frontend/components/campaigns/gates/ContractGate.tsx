"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Button, Input, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  campaignAPI,
  type CampaignContract,
  type CampaignGates,
} from "@/api/campaign";

interface ContractGateProps {
  campaignId: number;
  gate: CampaignGates["contract"];
  contract: CampaignContract | null;
  onRefresh: () => void;
}

export function ContractGate({
  campaignId,
  gate,
  contract,
  onRefresh,
}: ContractGateProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const [legalName, setLegalName] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas helpers ──────────────────────────────────────────────────────────

  const getCanvasPos = (
    canvas: HTMLCanvasElement,
    e: { clientX: number; clientY: number }
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const startDrawing = useCallback(
    (pos: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      isDrawingRef.current = true;
      lastPosRef.current = pos;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = "#e4e4e7";
      ctx.fill();
    },
    []
  );

  const draw = useCallback((pos: { x: number; y: number }) => {
    if (!isDrawingRef.current || !lastPosRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
    setHasDrawn(true);
  }, []);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }, []);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    startDrawing(getCanvasPos(canvas, e.nativeEvent));
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw(getCanvasPos(canvas, e.nativeEvent));
  };

  const onMouseUp = () => stopDrawing();
  const onMouseLeave = () => stopDrawing();

  // Touch events
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;
    startDrawing(getCanvasPos(canvas, e.touches[0]));
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;
    draw(getCanvasPos(canvas, e.touches[0]));
  };

  const onTouchEnd = () => stopDrawing();

  const handleClear = () => {
    setupCanvas();
    setHasDrawn(false);
  };

  // ── Contract actions ────────────────────────────────────────────────────────

  const handleViewContract = async () => {
    if (!selectedTeam?.id) return;
    setIsLoadingPdf(true);
    try {
      const { contract: c } = await campaignAPI.getContract(
        selectedTeam.id,
        campaignId
      );
      if (c?.presigned_pdf_url) {
        window.open(c.presigned_pdf_url, "_blank", "noopener,noreferrer");
      } else {
        addToast({
          title: "Contract not available",
          description: "No PDF is attached to this contract yet.",
          color: "warning",
        });
      }
    } catch (err: any) {
      addToast({
        title: "Failed to load contract",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleSign = async () => {
    if (!selectedTeam?.id) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!legalName.trim()) {
      addToast({
        title: "Legal name required",
        description: "Please enter your full legal name before signing.",
        color: "danger",
      });
      return;
    }

    if (!hasDrawn) {
      addToast({
        title: "Signature required",
        description: "Please draw your signature in the canvas below.",
        color: "danger",
      });
      return;
    }

    const signatureDataUrl = canvas.toDataURL("image/png");
    setIsSigning(true);
    try {
      await campaignAPI.signContract(
        selectedTeam.id,
        campaignId,
        legalName.trim(),
        signatureDataUrl
      );
      addToast({
        title: "Contract signed",
        description: "Your contract has been signed successfully.",
        color: "success",
      });
      onRefresh();
    } catch (err: any) {
      addToast({
        title: "Failed to sign contract",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsSigning(false);
    }
  };

  // ── Signed state ────────────────────────────────────────────────────────────

  if (gate.complete && contract) {
    const signedDate = new Date(contract.signed_at!).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-success-500/10 border border-success-500/20">
          <Icon
            icon="solar:check-circle-bold"
            className="text-success-500 flex-shrink-0"
            width={22}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-success-500">
              Signed on {signedDate}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Signed as: {contract.legal_name}
            </p>
          </div>
        </div>

        {contract.presigned_pdf_url && (
          <Button
            variant="flat"
            size="sm"
            className="bg-surface-elevated text-text-secondary"
            as="a"
            href={contract.presigned_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            startContent={<Icon icon="solar:file-download-bold-duotone" width={16} />}
          >
            Download Contract PDF
          </Button>
        )}
      </div>
    );
  }

  // ── Unsigned state ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* View contract PDF */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border-base">
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:file-text-bold-duotone"
            className="text-text-secondary"
            width={20}
          />
          <span className="text-sm text-text-primary">Campaign Contract</span>
        </div>
        <Button
          size="sm"
          variant="flat"
          className="bg-default-100 text-text-secondary"
          onPress={handleViewContract}
          isLoading={isLoadingPdf}
          startContent={
            !isLoadingPdf && (
              <Icon icon="solar:eye-bold-duotone" width={14} />
            )
          }
        >
          View PDF
        </Button>
      </div>

      {/* Legal name */}
      <Input
        label="Full legal name"
        placeholder="Enter your full legal name"
        value={legalName}
        onValueChange={setLegalName}
        variant="bordered"
        classNames={{
          inputWrapper: "border-border-base bg-surface-elevated",
          input: "text-text-primary",
          label: "text-text-secondary",
        }}
      />

      {/* Signature canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-text-secondary">Signature</label>
          <Button
            size="sm"
            variant="light"
            className="text-text-tertiary h-7 text-xs"
            onPress={handleClear}
          >
            Clear
          </Button>
        </div>
        <div className="rounded-lg overflow-hidden border border-border-base">
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="w-full touch-none cursor-crosshair block"
            style={{ background: "#0f0f1a" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        </div>
        {!hasDrawn && (
          <p className="text-xs text-text-tertiary">
            Draw your signature above using mouse or touch.
          </p>
        )}
      </div>

      {/* Sign button */}
      <Button
        color="primary"
        onPress={handleSign}
        isLoading={isSigning}
        isDisabled={!legalName.trim() || !hasDrawn}
        startContent={
          !isSigning && <Icon icon="solar:pen-bold-duotone" width={16} />
        }
        className="w-full"
      >
        Sign Contract
      </Button>
    </div>
  );
}
