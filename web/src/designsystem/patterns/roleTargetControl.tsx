import { useId } from "react";

import { Input } from "../primitives/input";
import { Meter } from "../primitives/progress";
import { Select } from "../primitives/select";
import { TooltipSurface } from "../primitives/tooltip";

import "./roleTargetControl.css";

interface QualityOption {
  label: string;
  value: string;
}

export function RoleTargetControl({
  averageOverallScore,
  contribution,
  onTargetChange,
  roleLabel,
  target,
}: {
  averageOverallScore: number | null;
  contribution: number;
  onTargetChange: (target: number) => void;
  roleLabel: string;
  target: number;
}) {
  const targetId = useId();
  const roundedContribution = Math.round(contribution * 10) / 10;
  const progressLabel =
    target === 0
      ? `${roleLabel} target is not configured`
      : `${String(roundedContribution)} of ${String(target)} ${roleLabel} target`;
  return (
    <div className="ds-role-target">
      <label className="ds-role-target-field" htmlFor={targetId}>
        <span>Target</span>
        <Input
          aria-label={`${roleLabel} target`}
          id={targetId}
          min={0}
          onChange={(event) => {
            onTargetChange(Math.max(0, event.currentTarget.valueAsNumber || 0));
          }}
          step={1}
          type="number"
          value={target}
        />
      </label>
      {target === 0 ? (
        <span className="ds-role-target-progress">Not configured</span>
      ) : (
        <>
          <Meter
            label={progressLabel}
            max={target}
            size="sm"
            value={roundedContribution}
          />
          <span className="ds-role-target-progress">
            {roundedContribution} / {target}
          </span>
        </>
      )}
      <span className="ds-role-target-progress">
        Average overall score:{" "}
        {averageOverallScore === null
          ? "Not scored"
          : String(Math.round(averageOverallScore * 10) / 10)}
      </span>
    </div>
  );
}

export function RoleQualityControl({
  onChange,
  options,
  quality,
}: {
  onChange: (quality: string) => void;
  options: readonly QualityOption[];
  quality: string;
}) {
  const qualityId = useId();
  const hintId = useId();
  return (
    <div className="ds-role-quality">
      <span className="ds-role-quality-label">
        <label htmlFor={qualityId}>Quality Threshold</label>
        <span className="ds-role-quality-hint">
          <button
            aria-describedby={hintId}
            aria-label="How the quality threshold works"
            className="ds-role-quality-hint-trigger"
            type="button"
          >
            ?
          </button>
          <TooltipSurface className="ds-role-quality-tooltip" id={hintId}>
            For nonland roles, this weights how much each card counts toward a
            target. A card at or above the threshold counts as one; lower scores
            count as a fraction. Lands always count one-for-one.
          </TooltipSurface>
        </span>
      </span>
      <Select
        aria-label="Quality Threshold"
        id={qualityId}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        options={[...options]}
        value={quality}
      />
    </div>
  );
}
