export {
  listGaps,
  getTrace,
  checkChangeImpact,
  findRequirementsForPath,
  generateEvidencePack,
  assignGap,
} from './surfaces/actions';
export { handler as uiResolver } from './surfaces/ui';
export { onEvent, reindex, nightlySweep } from './surfaces/events';
