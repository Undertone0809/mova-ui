import { supportedRegistryIds } from './supportedRegistryIds';

const supported = new Set(supportedRegistryIds);
export const COPY_SOURCE_GUIDANCE = 'Copy the source from the @mova-ui/react/catalog/... export listed in registry/manifest.json. This example is not available as an Mova CLI component.';

/** Only advertise install commands for components in the published registry. */
export function getInstallCommand(id: string): string {
  return supported.has(id) ? `npx @mova-ui/react add ${id}` : COPY_SOURCE_GUIDANCE;
}
