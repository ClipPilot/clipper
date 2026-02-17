"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody, Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { intakeAPI, IntakeFormData } from "@/api/intake";
import type { CompanySocial, CompetitorSocial, ICP } from "@/types/massPosting";
import { INTAKE_STEPS, emptySocial, emptyCompetitor, emptyICP } from "@/constants/massPosting";
import { LoadingView } from "./StatusViews";
import { StepBrandInfo } from "./StepBrandInfo";
import { StepSocials } from "./StepSocials";
import { StepICPs } from "./StepICPs";
import { StepReview } from "./StepReview";

interface IntakeFormProps {
  teamId: number | null;
  isAppeal: boolean;
  onSubmitted: () => void;
}

export function IntakeForm({ teamId, isAppeal, onSubmitted }: IntakeFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [justCompleted, setJustCompleted] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(true);

  // ── Form state (concrete types, never undefined) ──
  const [brandDescription, setBrandDescription] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companySocials, setCompanySocials] = useState<CompanySocial[]>([
    emptySocial(),
  ]);
  const [competitorSocials, setCompetitorSocials] = useState<CompetitorSocial[]>([
    emptyCompetitor(),
  ]);
  const [icps, setIcps] = useState<ICP[]>([emptyICP()]);

  // ── Load existing form data ──
  useEffect(() => {
    if (!teamId) return;
    intakeAPI
      .getIntakeForm(teamId)
      .then(({ form }) => {
        if (form) {
          setBrandDescription(form.brand_description ?? "");
          setCompanyWebsite(form.company_website_url ?? "");
          if (form.company_socials?.length)
            setCompanySocials(form.company_socials as CompanySocial[]);
          if (form.competitor_socials?.length)
            setCompetitorSocials(form.competitor_socials as CompetitorSocial[]);
          if (form.icps?.length) setIcps(form.icps as ICP[]);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingForm(false));
  }, [teamId]);

  const buildFormData = useCallback((): IntakeFormData => {
    return {
      brand_description: brandDescription,
      company_website_url: companyWebsite,
      company_socials: companySocials,
      competitor_socials: competitorSocials,
      icps,
    };
  }, [brandDescription, companyWebsite, companySocials, competitorSocials, icps]);

  // ── Auto-save on step change ──
  const saveForm = useCallback(async () => {
    if (!teamId) return;
    setIsSaving(true);
    try {
      await intakeAPI.saveIntakeForm(teamId, buildFormData());
    } catch {
      // silent — auto-save is best-effort
    } finally {
      setIsSaving(false);
    }
  }, [teamId, buildFormData]);

  const goToStep = (step: number) => {
    saveForm();
    if (step > currentStep) {
      setJustCompleted(currentStep);
      setTimeout(() => setJustCompleted(null), 600);
    }
    setCurrentStep(step);
  };

  const handleNext = () => goToStep(currentStep + 1);
  const handleBack = () => goToStep(currentStep - 1);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!teamId) return;
    setIsSubmitting(true);
    try {
      const data: IntakeFormData = { ...buildFormData(), completed: true };
      if (isAppeal) {
        await intakeAPI.submitAppeal(teamId, data);
        addToast({
          title: "Appeal submitted",
          description: "Your updated application has been submitted for review.",
          color: "success",
        });
      } else {
        await intakeAPI.submitApplication(teamId, data);
        addToast({
          title: "Application submitted",
          description: "Your application is now under review.",
          color: "success",
        });
      }
      onSubmitted();
    } catch (err: any) {
      addToast({
        title: "Submission failed",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingForm) {
    return <LoadingView />;
  }

  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1">
            {isAppeal ? "Update Your Application" : "Mass Posting Application"}
          </h1>
          <p className="text-sm sm:text-base text-text-secondary">
            {isAppeal
              ? "Update your details and resubmit for review."
              : "Tell us about your brand so we can tailor mass posting to your needs."}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {INTAKE_STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              <button
                onClick={() => i <= currentStep && goToStep(i)}
                disabled={i > currentStep}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  i === currentStep
                    ? "bg-accent-400/10 text-accent-400"
                    : i < currentStep
                      ? "text-success-500 hover:bg-surface-elevated cursor-pointer"
                      : "text-text-tertiary opacity-50 cursor-not-allowed"
                }`}
              >
                <Icon
                  icon={i < currentStep ? "solar:check-circle-bold" : step.icon}
                  className={`text-lg ${
                    i === justCompleted
                      ? "animate-[checkPop_0.4s_ease-out]"
                      : ""
                  }`}
                />
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < INTAKE_STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 flex-shrink-0 ${
                    i < currentStep ? "bg-success-500" : "bg-border-base"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
          {isSaving && (
            <span className="ml-auto text-xs text-text-tertiary flex items-center gap-1">
              <Icon icon="solar:cloud-upload-line-duotone" className="text-sm" />
              Saving...
            </span>
          )}
        </div>

        {/* Step Content */}
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-4 sm:p-6 lg:p-8">
            {currentStep === 0 && (
              <StepBrandInfo
                brandDescription={brandDescription}
                setBrandDescription={setBrandDescription}
                companyWebsite={companyWebsite}
                setCompanyWebsite={setCompanyWebsite}
              />
            )}
            {currentStep === 1 && (
              <StepSocials
                companySocials={companySocials}
                setCompanySocials={setCompanySocials}
                competitorSocials={competitorSocials}
                setCompetitorSocials={setCompetitorSocials}
              />
            )}
            {currentStep === 2 && (
              <StepICPs icps={icps} setIcps={setIcps} />
            )}
            {currentStep === 3 && (
              <StepReview
                data={buildFormData()}
                isAppeal={isAppeal}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
              />
            )}
          </CardBody>
        </Card>

        {/* Navigation */}
        {currentStep < 3 && (
          <div className="flex justify-between mt-6">
            <Button
              variant="flat"
              isDisabled={currentStep === 0}
              onPress={handleBack}
              startContent={<Icon icon="solar:arrow-left-linear" />}
            >
              Back
            </Button>
            <Button
              color="primary"
              onPress={handleNext}
              endContent={<Icon icon="solar:arrow-right-linear" />}
            >
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
