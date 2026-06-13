import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";
import type { ScryfallCard } from "../contracts";

import { displayPrice } from "./cardPresentationShared";

function titleize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CardInfoPanel({
  card,
  finish,
}: {
  card: ScryfallCard;
  finish: string | null;
}) {
  return (
    <>
      {card.mana_cost !== null && (
        <p className="card-details-mana">
          <strong>Mana cost</strong>
          <span>{card.mana_cost}</span>
        </p>
      )}
      <p className="card-details-oracle">
        {card.oracle_text ?? "Oracle text unavailable."}
      </p>
      <dl className="card-details-facts">
        <span>
          <dt>Set</dt>
          <dd>
            {card.set_name} ({card.set.toUpperCase()})
          </dd>
        </span>
        <span>
          <dt>Rarity</dt>
          <dd>{card.rarity}</dd>
        </span>
        {finish !== null && (
          <span>
            <dt>Finish</dt>
            <dd>{finish}</dd>
          </span>
        )}
        {finish === null && card.finishes.length > 0 && (
          <span>
            <dt>Finishes</dt>
            <dd>{card.finishes.join(", ")}</dd>
          </span>
        )}
        {card.released_at !== undefined && card.released_at !== null && (
          <span>
            <dt>Released</dt>
            <dd>{card.released_at}</dd>
          </span>
        )}
      </dl>
      {card.prices !== undefined && (
        <section
          aria-labelledby="card-details-prices"
          className="card-details-prices"
        >
          <h3 id="card-details-prices">Market prices</h3>
          <dl>
            {displayPrice("TCGplayer", card.prices.usd)}
            {displayPrice("TCGplayer foil", card.prices.usd_foil)}
            {displayPrice("TCGplayer etched", card.prices.usd_etched)}
            {displayPrice("Cardmarket", card.prices.eur)}
            {displayPrice("Cardmarket foil", card.prices.eur_foil)}
            {displayPrice("Cardhoarder", card.prices.tix)}
          </dl>
        </section>
      )}
    </>
  );
}

export function CardAnalysisPanel({
  error,
  evaluation,
  loading,
}: {
  error: string | null;
  evaluation: CardRoleEvaluation | null;
  loading: boolean;
}) {
  if (loading)
    return (
      <p className="card-analysis-status" role="status">
        Loading deck-specific analysis…
      </p>
    );
  if (error !== null)
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    );
  if (evaluation === null)
    return (
      <p className="card-analysis-status">
        No deck-specific analysis is available.
      </p>
    );
  return (
    <div className="card-analysis">
      <div className="card-analysis-summary">
        <div>
          <span className="card-analysis-label">Overall score</span>
          <strong>{evaluation.overall_score}</strong>
        </div>
        <small>
          {evaluation.cached
            ? "Loaded from current deck cache"
            : "Generated for the current deck"}
        </small>
      </div>
      <p className="card-analysis-comment">{evaluation.overall_comment}</p>
      <div className="card-analysis-roles">
        {evaluation.roles.map((role) => (
          <section className="card-analysis-role" key={role.role}>
            <header>
              <b className={`role-tag ${role.role}`}>{titleize(role.role)}</b>
              <strong>{role.score}</strong>
            </header>
            <p>{role.description}</p>
            <ul>
              {role.answers.map((answer) => (
                <li key={answer.criterion_id}>
                  <strong>{titleize(answer.criterion_id)}</strong>
                  <span>
                    {titleize(answer.rating)} · {answer.score}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
