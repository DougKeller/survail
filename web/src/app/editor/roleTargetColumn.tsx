import {
  RoleQualityControl,
  RoleTargetControl,
} from "../../designsystem/patterns/roleTargetControl";
import {
  ROLE_TARGET_QUALITY_OPTIONS,
  ROLE_TARGET_ROLES,
  type RoleTargetProgress,
  type RoleTargetProgressByRole,
  type RoleTargetQuality,
  type RoleTargetRole,
  type RoleTargetSetting,
  type RoleTargets,
} from "../deck/roleTargets";
import { titleize } from "../deck/text";

export function roleForColumnLabel(label: string): RoleTargetRole | null {
  return ROLE_TARGET_ROLES.find((role) => titleize(role) === label) ?? null;
}

function RoleTargetColumn({
  label,
  onChange,
  progress,
  setting,
}: {
  label: string;
  onChange: (setting: RoleTargetSetting) => void;
  progress: RoleTargetProgress;
  setting: RoleTargetSetting;
}) {
  return (
    <RoleTargetControl
      averageOverallScore={progress.averageOverallScore}
      contribution={progress.contribution}
      onTargetChange={(target) => {
        onChange({ ...setting, target });
      }}
      roleLabel={label}
      target={setting.target}
    />
  );
}

export function RoleTargetForColumn({
  label,
  onChange,
  progress,
  targets,
}: {
  label: string;
  onChange: (role: RoleTargetRole, setting: RoleTargetSetting) => void;
  progress: RoleTargetProgressByRole;
  targets: RoleTargets;
}) {
  const role = roleForColumnLabel(label);
  if (role === null) return null;
  return (
    <RoleTargetColumn
      label={label}
      onChange={(setting) => {
        onChange(role, setting);
      }}
      progress={progress[role]}
      setting={targets.roles[role]}
    />
  );
}

export function RoleQualityPicker({
  onChange,
  quality,
}: {
  onChange: (quality: RoleTargetQuality) => void;
  quality: RoleTargetQuality;
}) {
  return (
    <RoleQualityControl
      onChange={(value) => {
        onChange(value as RoleTargetQuality);
      }}
      options={ROLE_TARGET_QUALITY_OPTIONS}
      quality={quality}
    />
  );
}
