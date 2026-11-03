import { freeModule } from './modes/free';
import { killerModule } from './modes/killer';
import { pointsModule } from './modes/points';
import { shortSnookerModule, snookerModule } from './modes/snooker';
import type { ModeId, RulesModule } from './types';

export const MODULES: Record<ModeId, RulesModule> = {
  snooker: snookerModule,
  short: shortSnookerModule,
  points: pointsModule,
  killer: killerModule,
  free: freeModule,
};

export function getModule(mode: ModeId): RulesModule {
  return MODULES[mode];
}
