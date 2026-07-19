import { useId } from "react";

import { Select } from "../primitives/select";
import { Input } from "../primitives/input";
import { Meter } from "../primitives/progress";

import "./roleTargetControl.css";

interface QualityOption {
  label: string;
  value: string;
}

export function RoleTargetControl({
  contribution,
  onQualityChange,
  onTargetChange,
  quality,
  qualityOptions,
  roleLabel,
  target,
}: {
  contribution: number;
  onQualityChange: (quality: string) => void;
  onTargetChange: (target: number) => void;
  quality: string;
  qualityOptions: readonly QualityOption[];
  roleLabel: string;
  target: number;
}) {
  const targetId = useId();
  const qualityId = useId();
  const roundedContribution = Math.round(contribution * 10) / 10;
  const progressLabel =
    target === 0
      ? `${roleLabel} target is not configured`
      : `${String(roundedContribution)} of ${String(target)} ${roleLabel} target`;
  return (
    <div className="ds-role-target">
      <div className="ds-role-target-fields">
        <label className="ds-role-target-field" htmlFor={targetId}>
          <span>Target</span>
          <Input
            aria-label={`${roleLabel} target`}
            id={targetId}
            min={0}
            onChange={(event) => {
              onTargetChange(
                Math.max(0, event.currentTarget.valueAsNumber || 0),
              );
            }}
            step={1}
            type="number"
            value={target}
          />
        </label>
        <label className="ds-role-target-field" htmlFor={qualityId}>
          <span>Quality</span>
          <Select
            aria-label={`${roleLabel} quality`}
            id={qualityId}
            onChange={(event) => {
              onQualityChange(event.currentTarget.value);
            }}
            options={[...qualityOptions]}
            value={quality}
          />
        </label>
      </div>
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
    </div>
  );
}
