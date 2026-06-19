import { MaterialIcon } from "./text";

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
    <button
      aria-label={`${active ? "Unstar" : "Star"} ${label} as a core card`}
      className={`core-card-toggle${active ? " active" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={active ? "Unstar core card" : "Star core card"}
      type="button"
    >
      <MaterialIcon name={active ? "star" : "star_outline"} />
    </button>
  );
}
