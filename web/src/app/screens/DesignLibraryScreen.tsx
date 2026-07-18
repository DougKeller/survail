import { Page, PageHeader } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";

import { LayoutSection } from "../design/layoutSection";
import { PatternsSection } from "../design/patternsSection";
import { PrimitivesSection } from "../design/primitivesSection";
import { TokensSection } from "../design/tokensSection";
import { TypographySection } from "../design/typographySection";

/** Living showcase of the Organic design system at /design. */
export function DesignLibraryScreen() {
  return (
    <Page>
      <PageHeader>
        <Stack gap={1}>
          <Kicker tone="accent">Survail design system</Kicker>
          <Heading level={1} size="3xl">
            Design library
          </Heading>
          <Text muted size="md">
            The Organic system in one place: tokens, typography, primitives,
            patterns, and layout, composed exactly as product screens use them.
          </Text>
        </Stack>
      </PageHeader>
      <Stack gap={8}>
        <TokensSection />
        <TypographySection />
        <PrimitivesSection />
        <PatternsSection />
        <LayoutSection />
      </Stack>
    </Page>
  );
}
