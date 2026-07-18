import { StarToggle } from "../../designsystem/primitives/starToggle";

export function CoreCardToggle({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <StarToggle
      active={active}
      disabled={disabled}
      label={`${active ? "Unstar" : "Star"} ${label} as a core card`}
      onClick={onClick}
      title={active ? "Unstar core card" : "Star core card"}
    />
  );
}
