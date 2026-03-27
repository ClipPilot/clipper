"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Button, Input, toast, TextField, Label, FieldError} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  campaignAPI,
  type MasterAgreement,
  type CampaignGates,
} from "@/api/campaign";

interface ContractGateProps {
  gate: CampaignGates["contract"];
  agreement: MasterAgreement | null;
  onAgreementSigned: (agreement: MasterAgreement) => void;
}

export function ContractGate({
  gate,
  agreement,
  onAgreementSigned,
}: ContractGateProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const [legalEntityName, setLegalEntityName] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
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
      ctx.fillStyle = "#000000";
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

  // ── Agreement actions ─────────────────────────────────────────────────────

  const handleViewAgreement = async () => {
    if (!selectedTeam?.id) return;
    setIsLoadingPdf(true);
    try {
      const { agreement: a } = await campaignAPI.getMasterAgreement(
        selectedTeam.id
      );
      if (a?.presigned_pdf_url) {
        window.open(a.presigned_pdf_url, "_blank", "noopener,noreferrer");
      } else {
        toast.warning("Agreement not available", { description: "No PDF is attached to this agreement yet." });
      }
    } catch (err: any) {
      toast.danger("Failed to load agreement", { description: err.message || "Something went wrong" });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleSign = async () => {
    if (!selectedTeam?.id) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!legalEntityName.trim() || !signerName.trim() || !signerTitle.trim() || !signerEmail.trim()) {
      toast.danger("All fields required", { description: "Please fill in all fields before signing." });
      return;
    }

    if (!hasDrawn) {
      toast.danger("Signature required", { description: "Please draw your signature in the canvas below." });
      return;
    }

    const signatureDataUrl = canvas.toDataURL("image/png");
    setIsSigning(true);
    try {
      const { agreement: signed } = await campaignAPI.signMasterAgreement(
        selectedTeam.id,
        {
          legalEntityName: legalEntityName.trim(),
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          signerEmail: signerEmail.trim(),
          signatureDataUrl,
        }
      );
      toast.success("Agreement signed", { description: "Your agreement has been signed successfully." });
      onAgreementSigned(signed);
    } catch (err: any) {
      toast.danger("Failed to sign agreement", { description: err.message || "Something went wrong" });
    } finally {
      setIsSigning(false);
    }
  };

  // ── Signed state ────────────────────────────────────────────────────────────

  if (gate.complete && agreement?.status === "signed") {
    const signedDate = new Date(agreement.signed_at!).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-success-500/20">
          <Icon
            icon="solar:check-circle-bold"
            className="text-green-500 flex-shrink-0"
            width={22}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-500">
              Agreement signed on {signedDate}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Signed by: {agreement.signer_name}
              {agreement.signer_legal_entity_name && ` (${agreement.signer_legal_entity_name})`}
            </p>
          </div>
        </div>

        {agreement.presigned_pdf_url && (
          <a href={agreement.presigned_pdf_url} target="_blank" rel="noopener noreferrer">
            <Button variant="tertiary" size="sm" className="bg-white/[0.04] text-text-secondary">
              <Icon icon="solar:file-download-bold-duotone" width={16} />
              Download Agreement PDF
            </Button>
          </a>
        )}
      </div>
    );
  }

  // ── Unsigned state ──────────────────────────────────────────────────────────

  const isFormValid =
    legalEntityName.trim() &&
    signerName.trim() &&
    signerTitle.trim() &&
    signerEmail.trim() &&
    hasDrawn;

  return (
    <div className="space-y-4">
      {/* View agreement PDF */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04]">
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:file-text-bold-duotone"
            className="text-text-secondary"
            width={20}
          />
          <span className="text-sm text-text-primary">Cuttr Campaign Services Agreement</span>
        </div>
        <Button
 size="sm"
 variant="tertiary"
 className="bg-default-100 text-text-secondary"
 onPress={handleViewAgreement}
 isPending={isLoadingPdf}
 >
          {!isLoadingPdf && (
              <Icon icon="solar:eye-bold-duotone" width={14} />
            )}
          View PDF
        </Button>
      </div>

      {/* Signer info form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField>
          <Label>Legal entity name</Label>
          <Input onChange={(e) => (setLegalEntityName)(e.target.value)}
 placeholder="Company / LLC name"
 value={legalEntityName}
 />
          <FieldError />
        </TextField>
                <TextField>
          <Label>Signatory name</Label>
          <Input onChange={(e) => (setSignerName)(e.target.value)}
 placeholder="Your full name"
 value={signerName}
 />
          <FieldError />
        </TextField>
                <TextField>
          <Label>Title</Label>
          <Input onChange={(e) => (setSignerTitle)(e.target.value)}
 placeholder="CEO, Managing Member, etc."
 value={signerTitle}
 />
          <FieldError />
        </TextField>
                <TextField type="email">
          <Label>Email</Label>
          <Input onChange={(e) => (setSignerEmail)(e.target.value)}
 placeholder="signer@company.com"
 value={signerEmail}
 />
          <FieldError />
        </TextField>
      </div>

      {/* Signature canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-text-secondary">Signature</label>
          <Button
 size="sm"
 variant="tertiary"
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
            style={{ background: "#ffffff" }}
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
      <Button variant="primary"
 onPress={handleSign}
 isPending={isSigning}
 isDisabled={!isFormValid}
 className="w-full"
 >
        {!isSigning && <Icon icon="solar:pen-bold-duotone" width={16} />}
        Sign Agreement
      </Button>
    </div>
  );
}
