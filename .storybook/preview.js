import "../web/design-system/tokens.css";
import "../web/styles.css";
import "../web/design-system/design-system.css";
import "../web/design-system/components.js";

/** @type { import('@storybook/html-vite').Preview } */
const preview = {
  parameters: {
    a11y: {
      test: "todo",
    },
    backgrounds: {
      default: "GLL Background",
      values: [
        { name: "GLL Background", value: "#f4f6f9" },
        { name: "Surface", value: "#ffffff" },
        { name: "Sidebar", value: "#111b32" },
      ],
    },
    controls: {
      expanded: true,
    },
    layout: "padded",
    viewport: {
      options: {
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1440px", height: "900px" } },
      },
    },
  },
};

export default preview;
