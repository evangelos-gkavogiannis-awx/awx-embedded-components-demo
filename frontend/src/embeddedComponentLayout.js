/**
 * Airwallex embedded component layout.
 *
 * Adjust EMBEDDED_COMPONENT_MAX_WIDTH to control how wide the component appears.
 * Airwallex suggests 500px minimum; the component is responsive and can go wider.
 *
 * Height: 750px (with scrollbar) or 2000px (without scrollbar).
 *
 * Theme customization requires your Account Manager to enable a theme schema.
 * Pass `theme` in createElement() options once you have one from Airwallex.
 */
export const EMBEDDED_COMPONENT_MAX_WIDTH = 1200;
export const EMBEDDED_COMPONENT_HEIGHT = 2000;

export const embeddedPageContainerStyle = {
  width: '100%',
  maxWidth: `${EMBEDDED_COMPONENT_MAX_WIDTH}px`,
  margin: '0 auto',
};

export const embeddedMountContainerStyle = {
  width: '100%',
  margin: '0 auto',
  height: `${EMBEDDED_COMPONENT_HEIGHT}px`,
  minHeight: `${EMBEDDED_COMPONENT_HEIGHT}px`,
  backgroundColor: '#fff',
  borderRadius: '16px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  overflow: 'auto',
};

export const embeddedIframeStyles = `
  .awx-embedded-mount iframe {
    width: 100% !important;
    min-height: ${EMBEDDED_COMPONENT_HEIGHT}px !important;
    border: none;
    display: block;
  }
`;
