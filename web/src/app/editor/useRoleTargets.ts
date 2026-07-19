import { useCallback, useEffect, useState } from "react";

import {
  storedRoleTargets,
  storeRoleTargets,
  withRoleTargetQuality,
  withRoleTargetSetting,
  type RoleTargetQuality,
  type RoleTargetRole,
  type RoleTargetSetting,
} from "../deck/roleTargets";

export function useRoleTargets(deckId: string) {
  const [roleTargets, setRoleTargets] = useState(() =>
    storedRoleTargets(deckId),
  );

  useEffect(() => {
    setRoleTargets(storedRoleTargets(deckId));
  }, [deckId]);

  const changeRoleTarget = useCallback(
    (role: RoleTargetRole, setting: RoleTargetSetting) => {
      setRoleTargets((current) => {
        const next = withRoleTargetSetting(current, role, setting);
        storeRoleTargets(deckId, next);
        return next;
      });
    },
    [deckId],
  );

  const changeRoleQuality = useCallback(
    (quality: RoleTargetQuality) => {
      setRoleTargets((current) => {
        const next = withRoleTargetQuality(current, quality);
        storeRoleTargets(deckId, next);
        return next;
      });
    },
    [deckId],
  );

  return { changeRoleQuality, changeRoleTarget, roleTargets };
}
