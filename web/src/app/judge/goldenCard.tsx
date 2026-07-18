import { FlexSpacer, Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Kicker, Text } from "../../designsystem/layout/typography";
import { ImageTile } from "../../designsystem/patterns/imageTile";
import { RangeBand } from "../../designsystem/patterns/rangeBand";
import { Art } from "../../designsystem/primitives/artPlaceholder";
import { Card, CardTitle } from "../../designsystem/primitives/card";
import { Chip } from "../../designsystem/primitives/chip";
import { Disclosure } from "../../designsystem/primitives/disclosure";
import { Notice } from "../../designsystem/primitives/notice";
import { ManaCost } from "../../designsystem/primitives/pip";
import { Tag, type TagTone } from "../../designsystem/primitives/tag";
import { titleize } from "../deckPrimitives";

import {
  boundsText,
  failureText,
  rangeBounds,
  withinBounds,
  type ScoreBounds,
} from "./judgeFormat";

import type {
  JudgeGoldenExpectation,
  JudgeReferenceCard,
} from "../../modules/decks/evaluations/contracts";

type RoleScore = NonNullable<JudgeReferenceCard["result"]>["roles"][number];

function roleBounds(
  expectation: JudgeGoldenExpectation,
  role: string,
): ScoreBounds | null {
  const range = expectation.role_score_ranges[role];
  return range === undefined ? null : rangeBounds(range);
}

function roleTone(expected: boolean, forbidden: boolean): TagTone {
  if (forbidden) return "accent";
  return expected ? "accent2" : "neutral";
}

function sameBounds(a: ScoreBounds | null, b: ScoreBounds | null): boolean {
  if (a === null || b === null) return a === b;
  return a.high === b.high && a.low === b.low;
}

/** True when a lone role already tells the overall story — the overall
    score and allowed range just repeat that role's. */
function overallRedundant(
  expectation: JudgeGoldenExpectation,
  result: NonNullable<JudgeReferenceCard["result"]>,
): boolean {
  if (result.roles.length !== 1) return false;
  const only = result.roles[0];
  if (only?.score !== result.overall_score) return false;
  return sameBounds(
    rangeBounds(expectation.overall_range),
    roleBounds(expectation, only.role),
  );
}

/** "Scored 80 — allowed 68–92" reading beside a role or overall tag. */
function ScoreReading({
  bounds,
  score,
}: {
  bounds: ScoreBounds | null;
  score: number;
}) {
  return (
    <Text as="span" size="sm">
      Scored <strong>{score}</strong>
      {bounds !== null && ` — allowed ${boundsText(bounds)}`}
    </Text>
  );
}

/** One judged role: name, score vs allowed range, sentence, criteria. */
function RoleResult({
  expectation,
  role,
}: {
  expectation: JudgeGoldenExpectation;
  role: RoleScore;
}) {
  const bounds = roleBounds(expectation, role.role);
  const forbidden = expectation.forbid_roles.includes(role.role);
  const expected = expectation.must_roles.includes(role.role);
  const inBounds = bounds === null || withinBounds(role.score, bounds);
  return (
    <Stack gap={1}>
      <Inline gap={2} wrap>
        <Tag tone={roleTone(expected, forbidden)}>{titleize(role.role)}</Tag>
        <ScoreReading bounds={bounds} score={role.score} />
        {bounds !== null && (
          <RangeBand
            high={bounds.high}
            label={`${titleize(role.role)} score`}
            low={bounds.low}
            tone={inBounds && !forbidden ? "pass" : "fail"}
            value={role.score}
          />
        )}
      </Inline>
      <Text muted size="sm">
        {role.description}
      </Text>
      <Inline gap={1} wrap>
        {Object.entries(role.answers).map(([criterion, rating]) => (
          <Chip count={titleize(rating)} key={criterion}>
            {titleize(criterion)}
          </Chip>
        ))}
      </Inline>
    </Stack>
  );
}

/** Overall score with its allowed range band and the judge's comment. */
function OverallResult({
  expectation,
  result,
}: {
  expectation: JudgeGoldenExpectation;
  result: NonNullable<JudgeReferenceCard["result"]>;
}) {
  const bounds = rangeBounds(expectation.overall_range);
  const inBounds =
    bounds === null || withinBounds(result.overall_score, bounds);
  return (
    <Stack gap={1}>
      <Inline gap={2} wrap>
        <Tag tone="outline">Overall</Tag>
        <ScoreReading bounds={bounds} score={result.overall_score} />
        {bounds !== null && (
          <RangeBand
            high={bounds.high}
            label="Overall score"
            low={bounds.low}
            tone={inBounds ? "pass" : "fail"}
            value={result.overall_score}
          />
        )}
      </Inline>
      <Text muted size="sm">
        {result.overall_comment}
      </Text>
    </Stack>
  );
}

/** Title row: small art thumbnail beside name, cost, type, verdict tag. */
function CardIdentity({ card }: { card: JudgeReferenceCard }) {
  return (
    <Inline align="start" gap={3}>
      <ImageTile thumbnail>
        {card.image_uri === null ? (
          <Art label="No card art" rounded size="sm" />
        ) : (
          <img alt="" src={card.image_uri} />
        )}
      </ImageTile>
      <Stack gap={1}>
        <Inline gap={2} wrap>
          <CardTitle>{card.name}</CardTitle>
          <ManaCost cost={card.mana_cost} />
        </Inline>
        {card.type_line !== null && (
          <Text muted size="sm">
            {card.type_line}
          </Text>
        )}
      </Stack>
      <FlexSpacer />
      <Tag tone="neutral">{card.deck_title}</Tag>
      <Tag tone={card.passed ? "accent2" : "accent"}>
        {card.passed ? "Passed" : "Failed"}
      </Tag>
    </Inline>
  );
}

/** Full entry body: identity, failure notices, then the judge verdict. */
function GoldenCardBody({ card }: { card: JudgeReferenceCard }) {
  const result = card.result;
  return (
    <Stack gap={3}>
      <CardIdentity card={card} />
      {card.failures.map((failure) => (
        <Notice key={failure} role="alert" tone="error">
          {failureText(failure)}
        </Notice>
      ))}
      {result !== null && (
        <Stack gap={3}>
          <Kicker>Judge verdict</Kicker>
          {result.roles.map((role) => (
            <RoleResult
              expectation={card.expectation}
              key={role.role}
              role={role}
            />
          ))}
          {!overallRedundant(card.expectation, result) && (
            <OverallResult expectation={card.expectation} result={result} />
          )}
        </Stack>
      )}
    </Stack>
  );
}

/** One golden dataset entry. Failures render expanded so misjudged cards
    are scannable; passed cards collapse to a compact disclosure row. */
export function GoldenCardView({ card }: { card: JudgeReferenceCard }) {
  if (!card.passed) {
    return (
      <Card as="article" elevation="lg">
        <GoldenCardBody card={card} />
      </Card>
    );
  }
  return (
    <Disclosure
      inline
      label={
        <Inline as="span" gap={2} wrap>
          <Text as="span" size="md">
            <strong>{card.name}</strong>
          </Text>
          <ManaCost cost={card.mana_cost} />
          {card.result !== null && (
            <Text as="span" muted size="sm">
              Scored {card.result.overall_score}
            </Text>
          )}
          <Tag tone="neutral">{card.deck_title}</Tag>
          <Tag tone="accent2">Passed</Tag>
        </Inline>
      }
    >
      <Card as="article" elevation="sm">
        <GoldenCardBody card={card} />
      </Card>
    </Disclosure>
  );
}
